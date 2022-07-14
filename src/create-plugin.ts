import type { InvisiblePluginContext } from "white-web-sdk";
import { SyncedStorePlugin } from "./invisible-plugin";

export function createPlugin(
  kind: string = SyncedStorePlugin.kind
): new (context: InvisiblePluginContext) => SyncedStorePlugin {
  return class SyncedStoreCustomPlugin extends SyncedStorePlugin {
    static override readonly kind = kind;
  };
}
