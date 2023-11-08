import type { ReadonlyVal } from "value-enhancer";
import type { Displayer, InvisiblePluginContext } from "white-web-sdk";

import { setValue, subscribe, unsubscribe, val } from "value-enhancer";
import { InvisiblePlugin, RoomPhase, isRoom } from "white-web-sdk";
import { STORAGE_NS } from "./storage";
import { SyncedStore } from "./synced-store";

export class SyncedStorePlugin extends InvisiblePlugin<any, any> {
  public static readonly kind: string = "SyncedStore";
  public static readonly invisiblePlugins = new Map<
    Displayer,
    ReadonlyVal<InvisiblePlugin<any, any> | null>
  >();

  public static async init<TEventData extends Record<string, any> = any>(
    displayer: Displayer
  ): Promise<SyncedStore<TEventData>> {
    const isRoomWritable$ = val(false);
    const updateRoomWritable = () =>
      setValue(isRoomWritable$, isRoom(displayer) && displayer.isWritable);
    updateRoomWritable();
    displayer.callbacks.on("onEnableWriteNowChanged", updateRoomWritable);

    const invisiblePlugin$ = val<InvisiblePlugin<any, any> | null>(
      displayer.getInvisiblePlugin(SyncedStorePlugin.kind)
    );
    SyncedStorePlugin.invisiblePlugins.set(displayer, invisiblePlugin$);

    const createSyncedStore = async (
      isRoomWritable: boolean
    ): Promise<void> => {
      if (isRoomWritable && isRoom(displayer)) {
        try {
          const plugin = await displayer.createInvisiblePlugin(
            SyncedStorePlugin,
            { [STORAGE_NS]: {} }
          );
          setValue(invisiblePlugin$, plugin);
          unsubscribe(isRoomWritable$, createSyncedStore);
        } catch (e) {
          // could be error if multiple users create plugin at the same time
          await new Promise(resolve => setTimeout(resolve, 200));
          if (!displayer.getInvisiblePlugin(SyncedStorePlugin.kind)) {
            console.error(e);
          }
        }
      }
    };

    const removeWritableListener = (plugin: SyncedStorePlugin | null): void => {
      if (plugin) {
        unsubscribe(isRoomWritable$, createSyncedStore);
        unsubscribe(invisiblePlugin$, removeWritableListener);
      }
    };

    if (!invisiblePlugin$.value && isRoom(displayer)) {
      subscribe(isRoomWritable$, createSyncedStore);
      subscribe(invisiblePlugin$, removeWritableListener);
    }

    const syncedStore = new SyncedStore(
      displayer,
      invisiblePlugin$,
      isRoomWritable$
    );

    const onPhaseChanged = (phase: RoomPhase): void => {
      if (phase === RoomPhase.Disconnected) {
        displayer.callbacks.off("onPhaseChanged", onPhaseChanged);
        displayer.callbacks.off("onEnableWriteNowChanged", updateRoomWritable);
        isRoomWritable$.dispose();
        invisiblePlugin$.dispose();
        SyncedStorePlugin.invisiblePlugins.delete(displayer);
      }
    };
    displayer.callbacks.on("onPhaseChanged", onPhaseChanged);

    return syncedStore;
  }

  public static onCreate(plugin: SyncedStorePlugin): void {
    const invisiblePlugin$ = SyncedStorePlugin.invisiblePlugins.get(
      plugin.displayer
    );
    invisiblePlugin$ && setValue(invisiblePlugin$, plugin);
  }

  public constructor(context: InvisiblePluginContext) {
    super(context);
    const invisiblePlugin$ = SyncedStorePlugin.invisiblePlugins.get(
      this.displayer
    );
    invisiblePlugin$ && setValue(invisiblePlugin$, this);
  }
}
