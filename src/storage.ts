import type { AkkoObjectUpdatedProperty } from "white-web-sdk";
import { get, has, mapValues, isObject, size, noop } from "lodash-es";
import { SideEffectManager } from "side-effect-manager";
import {
  isRef,
  makeRef,
  plainObjectKeys,
  safeListenPropsUpdated,
} from "./utils";
import type {
  Diff,
  MaybeRefValue,
  RefValue,
  StorageStateChangedEvent,
  StorageStateChangedListener,
  StorageStateChangedListenerDisposer,
} from "./typings";
import { StorageEvent } from "./storage-event";
import type { SyncedStore } from "./synced-store";

export * from "./typings";

export const STORAGE_NS = "_WM-STORAGE_";

export const MAIN_STORAGE = "_WM-MAIN-STORAGE_";

export class Storage<TState extends Record<string, any> = any> {
  readonly id: string;

  private readonly _sideEffect = new SideEffectManager();
  private _context: SyncedStore;
  private _state: TState;
  private _destroyed = false;

  private _refMap = new WeakMap<any, RefValue>();

  /**
   * `setState` alters local state immediately before sending to server. This will cache the old value for onStateChanged diffing.
   */
  private _lastValue = new Map<
    string | number | symbol,
    TState[Extract<keyof TState, string>]
  >();

  public constructor(
    context: SyncedStore,
    id?: string | null,
    defaultState?: TState
  ) {
    if (defaultState && !isObject(defaultState)) {
      throw new Error(`Default state for Storage ${id} is not an object.`);
    }

    this._context = context;
    this.id = id || MAIN_STORAGE;

    this._state = {} as TState;

    const rawState: TState = get(
      this._context.attributes,
      [STORAGE_NS, this.id],
      this._state
    );

    if (this.isWritable) {
      if (rawState === this._state || !isObject(rawState)) {
        if (!get(this._context.attributes, [STORAGE_NS])) {
          this._context.updateAttributes([STORAGE_NS], {});
        }
        this._context.updateAttributes([STORAGE_NS, this.id], this._state);
        if (defaultState) {
          this.setState(defaultState);
        }
      }
    }

    // strip mobx
    plainObjectKeys(rawState).forEach(key => {
      if (key === STORAGE_NS) {
        return;
      }
      try {
        const rawValue = isObject(rawState[key])
          ? JSON.parse(JSON.stringify(rawState[key]))
          : rawState[key];
        if (isRef<TState[Extract<keyof TState, string>]>(rawValue)) {
          this._state[key] = rawValue.v;
          if (isObject(rawValue.v)) {
            this._refMap.set(rawValue.v, rawValue);
          }
        } else {
          this._state[key] = rawValue;
        }
      } catch (e) {
        this._context._logError(e);
      }
    });

    const _updateProperties = (
      actions: ReadonlyArray<AkkoObjectUpdatedProperty<TState, string>>
    ): void => {
      if (this._destroyed) {
        this._context._logError(
          new Error(
            `Cannot call _updateProperties on destroyed Storage "${this.id}".`
          )
        );
        return;
      }

      if (actions.length > 0) {
        const diffs: Diff<TState> = {};

        for (let i = 0; i < actions.length; i++) {
          try {
            const action = actions[i];
            const key = action.key as Extract<keyof TState, string>;

            if (key === STORAGE_NS) {
              continue;
            }

            const value = isObject(action.value)
              ? JSON.parse(JSON.stringify(action.value))
              : action.value;
            let oldValue: TState[Extract<keyof TState, string>] | undefined;
            if (this._lastValue.has(key)) {
              oldValue = this._lastValue.get(key);
              this._lastValue.delete(key);
            }

            switch (action.kind) {
              case 2: {
                // Removed
                if (has(this._state, key)) {
                  oldValue = this._state[key];
                  delete this._state[key];
                }
                diffs[key] = { oldValue };
                break;
              }
              default: {
                let newValue = value;

                if (isRef<TState[Extract<keyof TState, string>]>(value)) {
                  const { k, v } = value;
                  const curValue = this._state[key];
                  if (
                    isObject(curValue) &&
                    this._refMap.get(curValue)?.k === k
                  ) {
                    newValue = curValue;
                  } else {
                    newValue = v;
                    if (isObject(v)) {
                      this._refMap.set(v, value);
                    }
                  }
                }

                if (newValue !== this._state[key]) {
                  oldValue = this._state[key];
                  this._state[key] = newValue;
                }

                diffs[key] = { newValue, oldValue };
                break;
              }
            }
          } catch (e) {
            this._context._logError(e);
          }
        }

        this.onStateChanged.dispatch(diffs);
      }
    };

    this._sideEffect.addDisposer(
      safeListenPropsUpdated(
        () => get(context.attributes, [STORAGE_NS, this.id]),
        _updateProperties,
        this.destroy.bind(this)
      )
    );
  }

  public get isWritable(): boolean {
    return this._context.isWritable;
  }

  public get state(): Readonly<TState> {
    if (this._destroyed) {
      console.warn(`Accessing state on destroyed Storage "${this.id}"`);
    }
    return this._state;
  }

  readonly onStateChanged = new StorageEvent<
    StorageStateChangedEvent<TState>
  >();

  public addStateChangedListener(
    listener: StorageStateChangedListener<TState>
  ): StorageStateChangedListenerDisposer {
    this.onStateChanged.addListener(listener);
    return () => this.onStateChanged.removeListener(listener);
  }

  public ensureState(state: Partial<TState>): void {
    return this.setState(
      plainObjectKeys(state).reduce((payload, key) => {
        if (!has(this._state, key)) {
          payload[key] = state[key];
        }
        return payload;
      }, {} as Partial<TState>)
    );
  }

  public setState(state: Partial<TState>): void {
    if (this._destroyed) {
      this._context._logError(
        new Error(`Cannot call setState on destroyed Storage "${this.id}".`)
      );
      return;
    }

    if (!this.isWritable) {
      this._context._logError(
        new Error(
          `Cannot setState on Storage "${this.id}" without writable access`
        ),
        state
      );
      return;
    }

    const keys = plainObjectKeys(state);
    if (keys.length > 0) {
      keys.forEach(key => {
        const value = state[key];
        if (value === this._state[key]) {
          return;
        }

        let payload: MaybeRefValue<typeof value> = value;

        if (value === void 0) {
          this._lastValue.set(key, this._state[key]);
          delete this._state[key];
        } else {
          this._lastValue.set(key, this._state[key]);
          this._state[key] = value as TState[Extract<keyof TState, string>];

          if (isObject(value)) {
            let refValue = this._refMap.get(value);
            if (!refValue) {
              refValue = makeRef(value);
              this._refMap.set(value, refValue);
            }
            payload = refValue;
          }
        }

        this._context.updateAttributes([STORAGE_NS, this.id, key], payload);
      });
    }
  }

  /**
   * Empty storage data.
   */
  public emptyStorage(): void {
    if (size(this._state) <= 0) {
      return;
    }

    if (this._destroyed) {
      this._context._logError(
        new Error(`Cannot empty destroyed Storage "${this.id}".`)
      );
      return;
    }

    if (!this._context.attributes) {
      this._context._logError(
        new Error(`Cannot empty Storage "${this.id}" without writable access.`)
      );
      return;
    }

    this.setState(mapValues(this._state, noop as () => undefined));
  }

  /**
   * Delete storage index with all of its data and destroy the Storage instance.
   */
  public deleteStorage(): void {
    if (!this._context.attributes) {
      this._context._logError(
        new Error(`Cannot delete Storage "${this.id}" without writable access.`)
      );
      return;
    }

    this.destroy();

    if (this.isWritable) {
      this._context.updateAttributes([STORAGE_NS, this.id], void 0);
    }
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Destroy the Storage instance. The data will be kept.
   */
  public destroy(): void {
    this._destroyed = true;
    this.onStateChanged.listeners.clear();
    this._sideEffect.flushAll();
  }
}
