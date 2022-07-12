# SyncedStore

A `white-web-sdk` plugin for storing shared replayable states and sending/receiving replayable events.

### Install

```bash
npm add @netless/synced-store
```

### Example

Init SyncedStore right after joining room:

```ts
import { SyncedStorePlugin } from "@netless/synced-store";

const whiteboard = new WhiteWebSdk({
  appIdentifier: "xxxxxxxxxxxxxx",
  useMobXState: true, // This is required to use SyncedStorePlugin
  deviceType: DeviceType.Surface,
});

const room = await whiteboard.joinRoom({
  uuid: roomUUID,
  roomToken: roomToken,
  uid: userID,
  invisiblePlugins: [SyncedStorePlugin],
  // Only writable users can modify states and dispatch events.
  // Set this to false for readonly users(audience) for better performance
  isWritable: true,
});

// Define typed event keys and payloads
type EventData = {
  "click-event": { id: string };
};

const syncedStore = await SyncedStorePlugin.init<EventData>(room);
```

```ts
interface State {
  count: number;
}

// connect to a namespaced storage
const storage = await syncedStore.connectStorage<State>("a-name", { count: 0 });

storage.state; // => { count: 0 }

if (storage.isWritable) {
  storage.setState({ count: 2 });
}

const stateChangedDisposer = storage.on("stateChanged", diff => {
  if (diff.count) {
    // count: 0 -> 2
    console.log("count:", diff.count.oldValue, "->", diff.count.newValue);
    console.log(diff.count.newValue === app.state.count);
  }
});

if (syncStore.isRoomWritable) {
  syncedStore.dispatchEvent("click-event", { id: "item1" });
}

const eventDisposer = syncedStore.addEventListener(
  "click-event",
  ({ payload }) => {
    console.log(payload.id); // item1
  }
);
```

### Develop

Add `.env` at project root following the `.env.example` reference.

```bash
pnpm i
pnpm start
```

Unit Test:

```bash
pnpm t
```

End-to-end Test:

```bash
pnpm dev
# then start a new terminal tab
pnpm e2e
```

### API

- **static SyncedStorePlugin.init(room)**

  A `static` method that inits the SyncedStore. Should be called right after joining room.

  Returns: `Promise<SyncedStore<EventData>>`

- **SyncedStore.isRoomWritable**

  Type: `boolean`

  Shortcut to whiteboard room writable state. When it is `false`, calling `storage.setState()` and `dispatchEvent()` will throw errors.

- **SyncedStore.setRoomWritable(isWritable)**

  Shortcut to change whiteboard room writable state.

- **SyncedStore.addRoomWritableChangeListener(listener)**

  It fires when whiteboard room writable state changes.

  Type: `(isRoomWritable: boolean) => void`

  Returns: `() => void` - a disposable function that can be called to remove the listener.

- **SyncedStore.isPluginWritable**

  Type: `boolean`

  It is `true` if `isRoomWritable === true` and plugin finished initialization. When it is `false`, calling `storage.setState()` will throw errors.

- **SyncedStore.addPluginWritableChangeListener(listener)**

  It fires when plugin writable state changes.

  Type: `(isPluginWritable: boolean) => void`

  Returns: `() => void` - a disposable function that can be called to remove the listener.

- **SyncedStore.dispatchEvent(event, payload)**

  Broadcast an event message to other clients.

  ```js
  syncedStore.dispatchEvent("click", { data: "data" });
  ```

- **SyncedStore.addEventListener(event, listener)**

  It fires when receiving messages from other clients (when other clients called `syncedStore.dispatchEvent()`).

  Returns: `() => void` a disposer function.

  ```js
  const disposer = syncedStore.addEventListener(
    "click-event",
    ({ payload }) => {
      console.log(payload.data);
      disposer();
    }
  );

  syncedStore.dispatchEvent("click-event", { data: "data" });
  ```

- **SyncedStore.connectStorage(namespace, defaultState)**

  Connect to a namespaced storage. Each call returns an fresh storage instance with its own life-cycle. Calling multiple times with same namespace will result in different storage instances sharing the same data.

  **namespace**

  Name for the storage. Storages with the same namespace share the same state(but each storage instance keeps it own life-cycle).

  Type: `string`

  **defaultState**

  Type: `State`

  Returns: `Storage<State>`

  ```js
  const storage = syncedStore.connectStorage("my-storage", { count: 0 });
  ```

- **Storage.state**

  Type: `State`

  Default: `initialState`

  The synchronized state across all clients. To change it, call `storage.setState()`.

- **Storage.setState(partialState)**

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

- **Storage.on("stateChanged", listener)**

  A state changed event that fires after someone called `storage.setState()` (including the current syncedStore itself).

  Returns: `() => void` - A disposable function that can be called to remove the listener.

  ```js
  const disposer = storage.on("stateChanged", diff => {
    console.log("state changed", diff.oldValue, diff.newValue);
    disposer(); // remove listener by calling disposer
  });
  ```

- **Storage.on("destroyed", listener)**

  An event that fires after the storage instance is destroyed.

  Returns: `() => void` - A disposable function that can be called to remove the listener.

  ```js
  const disposer = storage.on("destroyed", () => {
    console.log(storage.destroyed); // true
  });
  ```

### License

MIT @ [netless](https://github.com/netless-io)
