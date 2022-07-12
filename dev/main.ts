import type { Room } from "white-web-sdk";
import { DeviceType, WhiteWebSdk } from "white-web-sdk";
import { genUID } from "side-effect-manager";
import { SyncedStorePlugin } from "../src";

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
  const urlRoomUUID = url.get("uuid");
  const urlRoomToken = url.get("roomToken");

  let room: Room;
  if (urlRoomUUID && urlRoomToken) {
    room = await joinRoom(urlRoomUUID, urlRoomToken);
  } else {
    room = await (roomUUID && roomToken
      ? joinRoom(roomUUID, roomToken)
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
  return joinRoom(uuid, roomToken);
}

async function joinRoom(roomUUID: string, roomToken: string): Promise<Room> {
  const uid = genUID();
  return whiteboard.joinRoom(
    {
      uuid: roomUUID,
      roomToken,
      uid,
      invisiblePlugins: [SyncedStorePlugin],
      disableMagixEventDispatchLimit: true,
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
