import type { Room, RoomPhase } from "white-web-sdk";
import { DeviceType, WhiteWebSdk } from "white-web-sdk";
import { genUID } from "side-effect-manager";
import { SyncedStorePlugin } from "../../src";
import type { JoinRoomConfig } from "../typings";

const whiteboard = new WhiteWebSdk({
  appIdentifier: import.meta.env.VITE_WHITEBOARD_ID,
  useMobXState: true,
  deviceType: DeviceType.Surface,
});

main();

async function main(): Promise<void> {
  const url = new URLSearchParams(window.location.search);
  const urlConfigParam = url.get("config") || null;
  const urlConfig: JoinRoomConfig =
    urlConfigParam && JSON.parse(decodeURIComponent(urlConfigParam));

  const room = await joinRoom(urlConfig);
  (window as any).room = room;

  (window as any).onRoomPhaseChanged?.(room.phase);
  room.callbacks.on("onPhaseChanged", (phase: RoomPhase) => {
    (window as any).onRoomPhaseChanged?.(phase);
  });

  const syncedStore = await SyncedStorePlugin.init(room);
  (window as any).syncedStore = syncedStore;

  syncedStore.addRoomWritableChangeListener(isWritable => {
    (window as any).onRoomWritableChanged?.(isWritable);
  });

  syncedStore.addPluginWritableChangeListener(isWritable => {
    (window as any).onPluginWritableChanged?.(isWritable);
  });

  syncedStore._plugin$.reaction(plugin => {
    (window as any).onHasPluginChanged?.(Boolean(plugin));
  });

  const mainStorage = syncedStore.connectStorage<{
    hello: string;
    world?: string;
  }>("main", { hello: "hello", world: "world" });
  (window as any).mainStorage = mainStorage;

  mainStorage.on("stateChanged", diff => {
    (window as any).onStateChanged?.(diff);
  });
}

async function joinRoom({
  uuid,
  token,
  isWritable,
}: JoinRoomConfig): Promise<Room> {
  const uid = genUID();
  return whiteboard.joinRoom({
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
  });
}
