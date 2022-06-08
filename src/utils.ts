import { listenUpdated, unlistenUpdated, reaction } from "white-web-sdk";
import type { AkkoObjectUpdatedListener } from "white-web-sdk";
import { has, isObject } from "lodash-es";
import { genUID } from "side-effect-manager";
import type { AutoRefValue, ExtractRawValue, RefValue } from "./typings";

export const plainObjectKeys = Object.keys as <T>(
  o: T
) => Array<Extract<keyof T, string>>;

export function isRef<TValue = unknown>(e: unknown): e is RefValue<TValue> {
  return Boolean(has(e, "__isRef"));
}

export function makeRef<TValue>(v: TValue): RefValue<TValue> {
  return { k: genUID(), v, __isRef: true };
}

export function makeAutoRef<TValue>(v: TValue): AutoRefValue<TValue> {
  return isRef<ExtractRawValue<TValue>>(v)
    ? v
    : makeRef(v as ExtractRawValue<TValue>);
}

export const safeListenPropsUpdated = <T>(
  getProps: () => T,
  callback: AkkoObjectUpdatedListener<T>,
  onDestroyed?: (props: unknown) => void
): (() => void) => {
  let disposeListenUpdated: (() => void) | null = null;
  const disposeReaction = reaction(
    getProps,
    () => {
      if (disposeListenUpdated) {
        disposeListenUpdated();
        disposeListenUpdated = null;
      }
      const props = getProps();
      if (isObject(props)) {
        disposeListenUpdated = () => unlistenUpdated(props, callback);
        listenUpdated(props, callback);
      } else {
        onDestroyed?.(props);
      }
    },
    { fireImmediately: true }
  );

  return () => {
    disposeListenUpdated?.();
    disposeReaction();
  };
};
