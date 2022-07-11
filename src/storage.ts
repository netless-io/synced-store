import type { ReadonlyVal } from "value-enhancer";
import type { InvisiblePlugin } from "white-web-sdk";
import { toJS } from "white-web-sdk";
import type { Diff, StorageStateChangedEvent } from "./typings";
import { StorageEvent } from "./storage-event";
import { isObject, plainObjectKeys, safeListenPropsUpdated } from "./utils";
import type { RefineState } from "./refine";
import { Refine } from "./refine";
import type { SideEffectDisposer } from "side-effect-manager";
import { SideEffectManager } from "side-effect-manager";

export const STORAGE_NS = "_WM-StOrAgE_";

export const MAIN_STORAGE = "_WM-MaIn-StOrAgE_";

export interface StorageConfig<TState = any> {
  namespace?: string;
  plugin$: ReadonlyVal<InvisiblePlugin<any> | null>;
  isWritable$: ReadonlyVal<boolean>;
  defaultState?: TState;
}

export class Storage<TState> {
  public readonly namespace: string;
  public defaultState: Readonly<TState>;
  private _plugin$: StorageConfig["plugin$"];
  private _isWritable$: StorageConfig["isWritable$"];
  private _refine: Refine<TState>;
  private _sideEffect = new SideEffectManager();

  public constructor({
    plugin$,
    isWritable$,
    namespace = MAIN_STORAGE,
    defaultState = {} as TState,
  }: StorageConfig<TState>) {
    if (defaultState && !isObject(defaultState)) {
      throw new Error(
        `Default state for Storage ${namespace} is not an object.`
      );
    }

    const getRawState = (): RefineState<TState> =>
      toJS(plugin$.value?.attributes[STORAGE_NS]?.[namespace]);

    this.namespace = namespace;
    this.defaultState = defaultState;
    this._plugin$ = plugin$;
    this._isWritable$ = isWritable$;
    this._refine = new Refine(getRawState(), defaultState);

    const onDiff = (diff: Diff<TState> | null): void => {
      if (diff) {
        this.onStateChanged.dispatch(diff);
      }
    };

    const ensureInitState = (
      plugin: InvisiblePlugin<any>
    ): SideEffectDisposer => {
      return isWritable$.subscribe(isWritable => {
        if (isWritable) {
          if (!isObject(plugin.attributes[STORAGE_NS])) {
            plugin.updateAttributes([STORAGE_NS], {});
          }
          if (!isObject(getRawState())) {
            plugin.updateAttributes(
              [STORAGE_NS, namespace],
              this._refine.toRefState()
            );
          }
        }
      });
    };

    const listenStorageChange = (
      plugin: InvisiblePlugin<any>
    ): SideEffectDisposer => {
      return safeListenPropsUpdated(
        () => plugin.attributes[STORAGE_NS]?.[namespace],
        actions => {
          if (actions.length <= 0) return;
          const diff = {} as Diff<TState>;
          let hasDiff = false;
          for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            const key = action.key as Extract<keyof TState, string>;
            if (key === STORAGE_NS) {
              continue;
            }

            const value = toJS(action.value);
            const diffOne = this._refine.setValue(key, value);
            if (diffOne) {
              hasDiff = true;
              diff[key] = diffOne;
            }
          }
          if (hasDiff) {
            onDiff(diff);
          }
        }
      );
    };

    this._sideEffect.addDisposer(
      this._plugin$.subscribe(plugin => {
        const disposers: SideEffectDisposer[] = [];
        this._sideEffect.flush("plugin-init");
        if (plugin) {
          const rawState = getRawState();
          if (isObject(rawState)) {
            onDiff(this._refine.replaceState(rawState));
          } else {
            disposers.push(ensureInitState(plugin));
          }
          disposers.push(listenStorageChange(plugin));
        } else {
          onDiff(this._refine.replaceState(defaultState));
        }
        if (disposers.length > 0) {
          this._sideEffect.addDisposer(disposers, "plugin-init");
        }
      })
    );
  }

  public get isWritable(): boolean {
    return this._isWritable$.value;
  }

  public get state(): Readonly<TState> {
    return this._refine.state;
  }

  public readonly onStateChanged = new StorageEvent<
    StorageStateChangedEvent<TState>
  >();

  public setState(state: Partial<TState>): void {
    const plugin = this._requireAccess("setState");

    if (!this.isWritable) {
      throw new Error(
        `Cannot setState on Storage "${this.namespace}" without writable access`
      );
    }

    const keys = plainObjectKeys(state);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = state[key];
      plugin.updateAttributes(
        [STORAGE_NS, this.namespace, key],
        isObject(value) ? this._refine.ensureRefValue(value) : value
      );
    }
  }

  /** reset storage to default state */
  public resetStorage(): void {
    const plugin = this._requireAccess("deleteStorage");
    plugin.updateAttributes([STORAGE_NS, this.namespace], this.defaultState);
  }

  public destroy(): void {
    this._destroyed = true;
    this.onStateChanged.listeners.clear();
    this._sideEffect.flushAll();
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }

  private _destroyed = false;

  private _requireAccess(method: string): InvisiblePlugin<any> {
    if (this._destroyed) {
      throw new Error(
        `Cannot call ${method} on destroyed Storage '${this.namespace}'.`
      );
    }

    const plugin = this._plugin$.value;
    if (!plugin) {
      throw new Error(
        `[SyncedStore]: cannot call '${method}' on Storage '${this.namespace}' because plugin is not initialized.`
      );
    }

    if (!this.isWritable) {
      throw new Error(
        `[SyncedStore]: cannot call '${method}' on Storage '${this.namespace}' without writable permission`
      );
    }

    return plugin;
  }
}
