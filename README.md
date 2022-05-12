# SyncedStore

A `white-web-sdk` plugin for storing shared replayable states and sending/receiving replayable events.

### Install

```bash
npm add @netless/synced-store
```

### Example

Init SyncedStore right after joining room:

```ts
const whiteboard = new WhiteWebSdk({
  appIdentifier: "xxxxxxxxxxxxxx",
  useMobXState: true,
  deviceType: DeviceType.Surface,
});

const room = await whiteboard.joinRoom({
  uuid: roomUUID,
  roomToken: roomToken,
  uid: userID,
  invisiblePlugins: [SyncedStore],
});

// Define typed event keys and payloads
type EventData = {
  click: { id: string };
};

const syncedStore = await SyncedStore.init<EventData>(room);
```

```ts
interface State {
  count: number;
}

// connect to a namespaced storage
const storage = await syncedStore.connectStorage<State>("a-name", { count: 0 });

storage.state; // => { count: 0 }
storage.setState({ count: 2 });
const stateChangedDisposer = storage.addStateChangedListener(diff => {
  if (diff.count) {
    // count: 0 -> 2
    console.log("count:", diff.count.oldValue, "->", diff.count.newValue);
    console.log(diff.count.newValue === app.state.count);
  }
});

syncedStore.dispatchEvent("click", { id: "item1" });
const eventDisposer = syncedStore.addEventListener("click", ({ payload }) => {
  console.log(payload.id); // item1
});
```

### Develop

Add `.env` at project root following the `.env.example` reference.

```bash
pnpm i
pnpm start
```

### API

- **SyncedStore.init(room)**

  A static method that inits the SyncedStore. Should be called right after joining room.

  Returns: `Promise<SyncedStore<EventData>>`

- **isWritable**

  Type: `boolean`

  When it is `false`, calling `storage.setState()` and `dispatchEvent()` has no effect.

- **addWritableChangedListener(listener)**

  It fires when app writable state changes.

  Type: `(isWritable: boolean) => void`

  Returns: `() => void`

  ```js
  const disposer = syncedStore.addWritableChangedListener(isWritable => {
    console.log("my writable becomes", isWritable);
    disposer();
  });
  ```

- **dispatchEvent(event, payload)**

  Broadcast an event message to other clients.

  ```js
  syncedStore.dispatchEvent("click", { data: "data" });
  ```

- **addEventListener(event, listener)**

  It fires when receiving messages from other clients (when other clients called `syncedStore.dispatchEvent()`).

  Returns: `() => void` a disposer function.

  ```js
  const disposer = syncedStore.addEventListener("click", ({ payload }) => {
    console.log(payload.data);
    disposer();
  });

  syncedStore.dispatchEvent("click", { data: "data" });
  ```

- **connectStorage(namespace, defaultState)**

  Connect to a namespaced storage.

  **namespace**

  Name for the storage. Storages with the same namespace share the same state.

  Type: `string`

  **defaultState**

  Type: `State`

  Returns: `Storage<State>`

  ```js
  const storage = syncedStore.connectStorage("my-storage", { count: 0 });
  ```

- **storage.state**

  Type: `State`\
  Default: `initialState`

  The synchronized state across all clients. To change it, call `storage.setState()`.

- **storage.setState(partialState)**

  Works like React's `setState`, it updates `storage.state` and synchronize it to other clients.

  When some field's value is `undefined`, it will be removed from `storage.state`.

  > **Important:** Do not rely on the order of state changes:
  >
  > - `storage.setState()` alters `storage.state` synchronously but `onStateChanged` will wait until the data is successfully synced.
  > - State syncing time span varies due to network status and data size. It is recommended to store only necessary data in the store.

  **partialState**

  Type: `Partial<State>`

  ```js
  storage.state; //=> { count: 0, a: 1 }
  storage.setState({ count: storage.state.count + 1, a: undefined, b: 2 });
  storage.state; //=> { count: 1, b: 2 }
  ```

- **storage.ensureState(partialState)**

  Ensure `storage.state` has specified values.

  **partialState**

  Type: `Partial<State>`

  ```js
  storage.state; // { a: 1 }
  storage.ensureState({ a: 0, b: 0 });
  storage.state; // { a: 1, b: 0 }
  ```

- **storage.addStateChangedListener(listener)**

  It fires after someone called `storage.setState()` (including the current syncedStore itself).

  Returns: `() => void`

  ```js
  const disposer = storage.addStateChangedListener(diff => {
    console.log("state changed", diff.oldValue, diff.newValue);
    disposer(); // remove listener by calling disposer
  });
  ```

### License

MIT @ [netless](https://github.com/netless-io)
