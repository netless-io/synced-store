import type { ReadonlyVal } from "value-enhancer";
import type { AkkoObjectUpdatedListener, InvisiblePlugin } from "white-web-sdk";
import {
  listenUpdated,
  reaction,
  RoomPhase,
  unlistenUpdated,
  toJS,
} from "white-web-sdk";
import type { Diff } from "./typings";
import { isObject, plainObjectKeys } from "./utils";
import type { RefineState } from "./refine";
import { Refine } from "./refine";
import type { SideEffectDisposer } from "side-effect-manager";
import { SideEffectManager } from "side-effect-manager";
import type {
  RemitterDisposer,
  RemitterEventNames,
  RemitterListener,
} from "remitter";
import { Remitter } from "remitter";

export const STORAGE_NS = "_WM-StOrAgE_";

export const MAIN_STORAGE = "_WM-MaIn-StOrAgE_";

export interface StorageEventData<TState> {
  stateChanged: Diff<TState>;
  disconnected: void;
}

export interface StorageConfig<TState = any> {
  namespace?: string;
  plugin$: ReadonlyVal<InvisiblePlugin<any> | null>;
  isWritable$: ReadonlyVal<boolean>;
  defaultState?: TState;
}

export class Storage<TState extends Record<string, any> = any> {
  public readonly namespace: string;
  public defaultState: Readonly<TState>;
  private _plugin$: StorageConfig["plugin$"];
  private _isWritable$: StorageConfig["isWritable$"];
  private _refine: Refine<TState>;
  private _sideEffect = new SideEffectManager();
  private _events = new Remitter<StorageEventData<TState>>();

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

    this.on = this._events.on.bind(this._events);
    this.off = this._events.off.bind(this._events);

    const getRawState = (): RefineState<TState> =>
      plugin$.value?.attributes[STORAGE_NS]?.[namespace];

    this.namespace = namespace;
    this.defaultState = defaultState;
    this._plugin$ = plugin$;
    this._isWritable$ = isWritable$;
    this._refine = new Refine(toJS(getRawState()), defaultState);

    const onDiff = (diff: Diff<TState> | null): void => {
      if (diff) {
        this._events.emit("stateChanged", diff);
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
          if (!isObject(toJS(getRawState()))) {
            plugin.updateAttributes(
              [STORAGE_NS, namespace],
              this._refine.toRefState()
            );
          }
        }
      });
    };

    const listenNamespaceProps = (
      rawState: RefineState<TState>
    ): SideEffectDisposer => {
      const handler: AkkoObjectUpdatedListener<TState> = actions => {
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
      };
      listenUpdated(rawState, handler);
      return () => unlistenUpdated(rawState, handler);
    };

    const listenNamespace = (): SideEffectDisposer => {
      let propsDisposer: SideEffectDisposer | undefined;
      const reactionDisposer = reaction(
        getRawState,
        () => {
          const rawState = getRawState();
          if (rawState) {
            onDiff(this._refine.replaceState(toJS(rawState)));
            propsDisposer?.();
            propsDisposer = listenNamespaceProps(rawState);
          }
        },
        { fireImmediately: true }
      );
      return () => {
        reactionDisposer();
        propsDisposer?.();
      };
    };

    const listenStorageChange = (
      plugin: InvisiblePlugin<any>
    ): SideEffectDisposer => {
      let disposer = listenNamespace();

      const handler = async (phase: RoomPhase): Promise<void> => {
        if (phase === RoomPhase.Connected) {
          disposer();
          disposer = listenNamespace();
        }
      };
      plugin.displayer.callbacks.on("onPhaseChanged", handler);

      return () => {
        plugin.displayer.callbacks.off("onPhaseChanged", handler);
        disposer();
      };
    };

    this._sideEffect.addDisposer(
      this._plugin$.subscribe(plugin => {
        const disposers: SideEffectDisposer[] = [];
        this._sideEffect.flush("plugin-init");
        if (plugin) {
          const rawState = toJS(getRawState());
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

  /** reset storage state to default state */
  public resetState(): void {
    const plugin = this._requireAccess("resetState");
    plugin.updateAttributes([STORAGE_NS, this.namespace], this.defaultState);
  }

  /** delete synced storage data and disconnect from synced storage */
  public deleteStorage(): void {
    const plugin = this._requireAccess("deleteStorage");
    this.disconnect();
    plugin.updateAttributes([STORAGE_NS, this.namespace], undefined);
  }

  /**
   * Add a listener to the eventName.
   */
  public on: <TEventName extends RemitterEventNames<StorageEventData<TState>>>(
    eventName: TEventName,
    listener: RemitterListener<StorageEventData<TState>, TEventName>
  ) => RemitterDisposer;

  /**
   * Remove a listener from the eventName.
   */
  public off: <TEventName extends RemitterEventNames<StorageEventData<TState>>>(
    eventName: TEventName,
    listener: RemitterListener<StorageEventData<TState>, TEventName>
  ) => boolean;

  /** Disconnect from synced storage and release listeners */
  public disconnect(): void {
    this._disconnected = true;
    this._sideEffect.flushAll();
    this._events.emit("disconnected");
    this._events.destroy();
  }

  public get disconnected(): boolean {
    return this._disconnected;
  }

  private _disconnected = false;

  private _requireAccess(method: string): InvisiblePlugin<any> {
    if (this._disconnected) {
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
