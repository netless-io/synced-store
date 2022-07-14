import { Val } from "value-enhancer";
import type { Displayer, InvisiblePluginContext } from "white-web-sdk";
import { RoomPhase } from "white-web-sdk";
import { InvisiblePlugin, isRoom } from "white-web-sdk";
import { STORAGE_NS } from "./storage";
import { SyncedStore } from "./synced-store";

export class SyncedStorePlugin extends InvisiblePlugin<any> {
  public static readonly kind: string = "SyncedStore";
  public static readonly invisiblePlugins = new Map<
    Displayer,
    Val<InvisiblePlugin<any> | null>
  >();

  public static async init<TEventData extends Record<string, any> = any>(
    displayer: Displayer
  ): Promise<SyncedStore<TEventData>> {
    const isRoomWritable$ = new Val(false);
    const updateRoomWritable = () =>
      isRoomWritable$.setValue(isRoom(displayer) && displayer.isWritable);
    updateRoomWritable();
    displayer.callbacks.on("onEnableWriteNowChanged", updateRoomWritable);

    const invisiblePlugin$ = new Val<InvisiblePlugin<any> | null>(
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
          invisiblePlugin$.setValue(plugin);
          isRoomWritable$.unsubscribe(createSyncedStore);
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
        isRoomWritable$.unsubscribe(createSyncedStore);
        invisiblePlugin$.unsubscribe(removeWritableListener);
      }
    };

    if (!invisiblePlugin$.value && isRoom(displayer)) {
      isRoomWritable$.subscribe(createSyncedStore);
      invisiblePlugin$.subscribe(removeWritableListener);
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
        isRoomWritable$.destroy();
        invisiblePlugin$.destroy();
        SyncedStorePlugin.invisiblePlugins.delete(displayer);
      }
    };
    displayer.callbacks.on("onPhaseChanged", onPhaseChanged);

    return syncedStore;
  }

  public static onCreate(plugin: SyncedStorePlugin): void {
    SyncedStorePlugin.invisiblePlugins.get(plugin.displayer)?.setValue(plugin);
  }

  public constructor(context: InvisiblePluginContext) {
    super(context);
    SyncedStorePlugin.invisiblePlugins.get(this.displayer)?.setValue(this);
  }
}
