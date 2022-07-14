import type { Room } from "white-web-sdk";
import { DeviceType, WhiteWebSdk } from "white-web-sdk";
import { genUID } from "side-effect-manager";
import { SyncedStorePlugin } from "../src";
import type { JoinRoomConfig } from "../e2e/typings";

const whiteboard = new WhiteWebSdk({
  appIdentifier: import.meta.env.VITE_WHITEBOARD_ID,
  useMobXState: true,
  deviceType: DeviceType.Surface,
});

main();

async function main(): Promise<void> {
  const roomUUID = localStorage.getItem("roomUUID");
  const roomToken = localStorage.getItem("roomToken");
  const search = window.location.search;
  const url = new URLSearchParams(search);
  const urlConfigParam = url.get("config") || null;
  const urlConfig: JoinRoomConfig =
    urlConfigParam && JSON.parse(decodeURIComponent(urlConfigParam));

  let room: Room;
  if (urlConfig) {
    room = await joinRoom(urlConfig);
  } else {
    room = await (roomUUID && roomToken
      ? joinRoom({ uuid: roomUUID, token: roomToken })
      : createRoom());
  }

  (window as any).room = room;

  const syncedStore = await SyncedStorePlugin.init(room);
  (window as any).syncedStore = syncedStore;

  const mainStorage = syncedStore.connectStorage<{
    hello: string;
    world?: string;
  }>("main", { hello: "hello", world: "world" });
  (window as any).mainStorage = mainStorage;

  mainStorage.on("stateChanged", diff => {
    (window as any).lastDiff = diff;
    console.log("-- diff:", JSON.stringify(diff));
  });

  (window as any).broadcast = (message: any) => {
    syncedStore.dispatchEvent("broadcast", message);
  };

  // it also receives self messages
  syncedStore.addEventListener("broadcast", ev => {
    (window as any).lastMessage = ev.payload;
    console.log("-- message:", ev.payload);
  });
}

async function createRoom(): Promise<Room> {
  const { uuid } = await post<{ uuid: string }>("rooms", {
    limit: 0,
    isRecord: false,
  });
  const roomToken = await post<string>(`tokens/rooms/${uuid}`, {
    lifespan: 0,
    role: "admin",
  });
  localStorage.setItem("roomUUID", uuid);
  localStorage.setItem("roomToken", roomToken);
  return joinRoom({ uuid, token: roomToken });
}

async function joinRoom({
  uuid,
  token,
  isWritable,
}: JoinRoomConfig): Promise<Room> {
  const uid = genUID();
  return whiteboard.joinRoom(
    {
      uuid,
      roomToken: token,
      uid,
      invisiblePlugins: [SyncedStorePlugin],
      disableMagixEventDispatchLimit: true,
      isWritable,
      userPayload: {
        uid,
        nickName: uid,
      },
    },
    {
      onPhaseChanged(phase) {
        console.log("-- phase:", phase);
      },
    }
  );
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`https://api.netless.link/v5/${path}`, {
    method: "POST",
    headers: {
      token: import.meta.env.VITE_WHITEBOARD_SECRET,
      region: "cn-hz",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json();
}
