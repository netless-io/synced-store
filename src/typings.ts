import type {
  EventPhase as WhiteEventPhase,
  Scope as WhiteScope,
  MagixEventListenerOptions,
} from "white-web-sdk";
import type { StorageEventListener } from "./storage-event";

export type DiffOne<T> = { oldValue?: T; newValue?: T };

export type Diff<T> = { [K in keyof T]?: DiffOne<T[K]> };

export type StorageStateChangedEvent<TState = any> = Diff<TState>;

export type StorageStateChangedListener<TState = any> = StorageEventListener<
  StorageStateChangedEvent<TState>
>;

export type StorageStateChangedListenerDisposer = () => void;

export interface MagixEventMessage<
  TEventData = any,
  TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
> {
  /** Event name */
  event: TEvent;
  /** Event Payload */
  payload: TEventData[TEvent];
  /** Whiteboard ID of the client who dispatched the event. It will be AdminObserverId for system events. */
  authorId: number;
  scope: `${WhiteScope}`;
  phase: `${WhiteEventPhase}`;
}

export type MagixEventTypes<TEventData = any> = Extract<
  keyof TEventData,
  string
>;

export type MagixEventDispatcher<TEventData = any> = <
  TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
>(
  event: TEvent,
  payload: TEventData[TEvent]
) => void;

export type MagixEventHandler<
  TEventData = any,
  TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
> = (message: MagixEventMessage<TEventData, TEvent>) => void;

export type MagixEventListenerDisposer = () => void;

export type MagixEventAddListener<TEventData = any> = <
  TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
>(
  event: TEvent,
  handler: MagixEventHandler<TEventData, TEvent>,
  options?: MagixEventListenerOptions | undefined
) => MagixEventListenerDisposer;

export type MagixEventRemoveListener<TEventData = any> = <
  TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
>(
  event: TEvent,
  handler?: MagixEventHandler<TEventData, TEvent>
) => void;
