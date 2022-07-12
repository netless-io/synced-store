import { genUID } from "side-effect-manager";
import type { Diff, DiffOne } from "./typings";
import { has, isObject, plainObjectKeys } from "./utils";

const REFINE_KEY = "__IsReFiNe";

export type RefineValue<TValue = any> = {
  k: string;
  v: TValue;
  [REFINE_KEY]: 1;
};

export type MaybeRefineValue<TValue = any> = TValue | RefineValue<TValue>;

export type RefineState<TState = any> = {
  [K in keyof TState]: MaybeRefineValue<TState[K]>;
};

export type ExtractRawValue<TValue> = TValue extends RefineValue<
  infer TRefineValue
>
  ? TRefineValue
  : TValue;

export function isRefineValue<TValue>(
  value: MaybeRefineValue<TValue>
): value is RefineValue<TValue> {
  return isObject(value) && (value as RefineValue<TValue>)[REFINE_KEY] === 1;
}

export function isMaybeRefineValue<TValue>(
  value: MaybeRefineValue<TValue>
): value is MaybeRefineValue<TValue> {
  return !isObject(value) || (value as RefineValue<TValue>)[REFINE_KEY] === 1;
}

export function makeRefineValue<TValue>(
  value: TValue,
  key: string = genUID()
): RefineValue<TValue> {
  return { [REFINE_KEY]: 1, k: key, v: value };
}

export class Refine<TState = any> {
  public defaultState: TState;
  public state: TState;

  public constructor(refState?: RefineState<TState>, defaultState?: TState) {
    this.defaultState = defaultState || ({} as TState);
    this.state = {} as TState;
    this.replaceState(refState);
  }

  public replaceState(
    state: RefineState<TState> = this.defaultState
  ): Diff<TState> | null {
    if (!isObject(state)) {
      throw new Error("[SyncedStore] replaceState: state must be an object");
    }
    const diff = {} as Diff<TState>;
    let hasDiff = false;
    new Set([
      ...plainObjectKeys(this.state),
      ...plainObjectKeys(state),
    ]).forEach(key => {
      const diffOne = this.setValue(key, state[key]);
      if (diffOne) {
        hasDiff = true;
        diff[key] = diffOne;
      }
    });
    return hasDiff ? diff : null;
  }

  public toRefState(): RefineState<TState> {
    return plainObjectKeys(this.state).reduce((refState, key) => {
      refState[key] = this.toRefValue(this.state[key]);
      return refState;
    }, {} as RefineState<TState>);
  }

  public setValue<TKey extends Extract<keyof TState, string>>(
    key: TKey,
    maybeRefValue: MaybeRefineValue<TState[TKey]> | undefined
  ): DiffOne<TState[TKey]> | null {
    if (isObject(maybeRefValue)) {
      const refValue = this.ensureRefValue(maybeRefValue);
      if (this.state[key] !== refValue.v) {
        const oldValue = this.deleteRefKey(key);
        this.state[key] = refValue.v;
        return { oldValue, newValue: refValue.v };
      }
    } else if (typeof maybeRefValue === "undefined") {
      if (has(this.state, key)) {
        const oldValue = this.deleteRefKey(key);
        delete this.state[key];
        return { oldValue };
      }
    } else {
      const value = maybeRefValue as TState[TKey];
      if (this.state[key] !== value) {
        const oldValue = this.deleteRefKey(key);
        this.state[key] = value;
        return { oldValue, newValue: value };
      }
    }
    return null;
  }

  public toRefValue<TKey extends Extract<keyof TState, string>>(
    maybeRefValue: MaybeRefineValue<TState[TKey]>
  ): RefineValue<TState[TKey]> {
    return isObject(maybeRefValue)
      ? this.ensureRefValue(maybeRefValue)
      : maybeRefValue;
  }

  public ensureRefValue<TValue>(
    value: MaybeRefineValue<TValue>
  ): RefineValue<TValue> {
    if (isRefineValue(value)) {
      this.refMap.set(value.v, value);
      return value;
    }
    let refValue = this.refMap.get(value);
    if (!refValue) {
      refValue = makeRefineValue(value, this.genKey());
      this.refMap.set(value, refValue);
    }
    this.refKeys.add(refValue.k);
    return refValue;
  }

  private refMap: Map<any, RefineValue<any>> = new Map();

  private refKeys = new Set<string>();
  private genKey = (): string => {
    let key: string;
    do {
      key = genUID();
    } while (this.refKeys.has(key));
    this.refKeys.add(key);
    return key;
  };

  private deleteRefKey<TKey extends Extract<keyof TState, string>>(
    key: TKey
  ): TState[TKey] {
    const value = this.state[key];
    const refValue = this.refMap.get(value);
    if (refValue) {
      this.refKeys.delete(refValue.k);
    }
    return value;
  }
}
