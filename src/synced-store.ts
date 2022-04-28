import type {
  InvisiblePluginContext,
  Room,
  EventListener as WhiteEventListener,
  MagixEventListenerOptions,
} from "white-web-sdk";
import { isRoom, InvisiblePlugin } from "white-web-sdk";
import type {
  MagixEventHandler,
  MagixEventListenerDisposer,
  MagixEventTypes,
} from "./storage";
import { Storage } from "./storage";

export class SyncedStore<
  TEventData extends Record<string, any> = any
> extends InvisiblePlugin<any> {
  public static kind = "SyncedStore";
  public errorLog = true;

  public constructor(context: InvisiblePluginContext) {
    super(context);
  }

  public static async init<TEventData extends Record<string, any> = any>(
    room: Room
  ): Promise<SyncedStore<TEventData>> {
    let syncedStore = room.getInvisiblePlugin(SyncedStore.kind) as SyncedStore;
    if (!syncedStore) {
      if (!room.isWritable) {
        throw new Error("room is not writable");
      }
      syncedStore = (await room.createInvisiblePlugin(
        SyncedStore,
        {}
      )) as SyncedStore;
    }
    return syncedStore;
  }

  public connectStorage<TState extends Record<string, unknown> = any>(
    storageID: string | null | undefined = null,
    defaultState?: TState
  ): Storage<TState> {
    return new Storage(this, storageID, defaultState);
  }

  public get isWritable(): boolean {
    return isRoom(this.displayer) && (this.displayer as Room).isWritable;
  }

  public addWritableChangedListener(
    listener: (isWritable: boolean) => void
  ): () => void {
    const handler = (isReadonly: boolean) => listener(!isReadonly);
    this.displayer.callbacks.on("onEnableWriteNowChanged", handler);
    return () =>
      this.displayer.callbacks.off("onEnableWriteNowChanged", handler);
  }

  /** Dispatch events to other clients (and self). */
  public dispatchEvent<
    TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
  >(event: TEvent, payload: TEventData[TEvent]): void {
    if (!isRoom(this.displayer)) {
      // can't dispatch events on replay mode
      return;
    }

    const room = this.displayer as Room;
    if (!room.isWritable) {
      this._logError(
        new Error(
          `SyncedStore: ${event} event can't be dispatched without writable access`
        )
      );
      return;
    }

    return room.dispatchMagixEvent(event, payload);
  }

  /** Listen to events from others clients (and self messages). */
  public addEventListener<
    TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
  >(
    event: TEvent,
    listener: MagixEventHandler<TEventData, TEvent>,
    options?: MagixEventListenerOptions | undefined
  ): MagixEventListenerDisposer {
    this.displayer.addMagixEventListener(
      event,
      listener as WhiteEventListener,
      options
    );
    return () =>
      this.displayer.removeMagixEventListener(
        event,
        listener as WhiteEventListener
      );
  }

  /** Remove a Magix event listener. */
  public removeEventListener<
    TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
  >(event: TEvent, listener?: MagixEventHandler<TEventData, TEvent>): void {
    return this.displayer.removeMagixEventListener(
      event,
      listener as WhiteEventListener
    );
  }

  public _logError(...messages: any[]): void {
    if (this.errorLog) {
      console.error(...messages);
    }
  }
}
