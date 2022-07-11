import { Val } from "value-enhancer";
import type { Displayer, InvisiblePluginContext } from "white-web-sdk";
import { InvisiblePlugin, isRoom } from "white-web-sdk";
import { STORAGE_NS } from "./storage";
import { SyncedStore } from "./synced-store";

export class SyncedStorePlugin extends InvisiblePlugin<any> {
  public static readonly kind: string = "SyncedStore";
  public static readonly invisiblePlugin$ =
    new Val<InvisiblePlugin<any> | null>(null);

  public static async init<TEventData extends Record<string, any> = any>(
    displayer: Displayer
  ): Promise<SyncedStore<TEventData>> {
    let syncedStorePlugin = displayer.getInvisiblePlugin(
      SyncedStorePlugin.kind
    );
    if (!syncedStorePlugin && isRoom(displayer) && displayer.isWritable) {
      // could be error if multiple users create plugin at the same time
      try {
        syncedStorePlugin = await displayer.createInvisiblePlugin(
          SyncedStorePlugin,
          { [STORAGE_NS]: {} }
        );
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 200));
        syncedStorePlugin = displayer.getInvisiblePlugin(
          SyncedStorePlugin.kind
        );
        if (!syncedStorePlugin) {
          console.error(e);
        }
      }
    }
    if (syncedStorePlugin) {
      SyncedStorePlugin.invisiblePlugin$.setValue(syncedStorePlugin);
    }
    return new SyncedStore(displayer, SyncedStorePlugin.invisiblePlugin$);
  }

  public static onCreate(plugin: SyncedStorePlugin): void {
    SyncedStorePlugin.invisiblePlugin$.setValue(plugin);
  }

  public constructor(context: InvisiblePluginContext) {
    super(context);
    SyncedStorePlugin.invisiblePlugin$.setValue(this);
  }
}
