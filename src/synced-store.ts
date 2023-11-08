import type { ReadonlyVal } from "value-enhancer";
import type {
  Displayer,
  InvisiblePlugin,
  MagixEventListenerOptions,
  Room,
  EventListener as WhiteEventListener,
} from "white-web-sdk";
import type {
  MagixEventHandler,
  MagixEventListenerDisposer,
  MagixEventTypes,
} from "./typings";

import { SideEffectManager, genUID } from "side-effect-manager";
import { combine, reaction } from "value-enhancer";
import { isRoom } from "white-web-sdk";
import { Storage } from "./storage";

export class SyncedStore<TEventData extends Record<string, any> = any> {
  public readonly displayer: Displayer;
  public readonly _plugin$: ReadonlyVal<InvisiblePlugin<any, any> | null>;

  private readonly _isPluginWritable$: ReadonlyVal<boolean>;
  private readonly _isRoomWritable$: ReadonlyVal<boolean>;
  private readonly _sideEffect = new SideEffectManager();
  private readonly _room: Room | null;

  public constructor(
    displayer: Displayer,
    invisiblePlugin$: ReadonlyVal<InvisiblePlugin<any, any> | null>,
    isRoomWritable$: ReadonlyVal<boolean>
  ) {
    this.displayer = displayer;
    this._plugin$ = invisiblePlugin$;
    this._isRoomWritable$ = isRoomWritable$;
    const room = isRoom(displayer) ? displayer : null;
    this._room = room;

    this._isPluginWritable$ = combine(
      [this._plugin$, this._isRoomWritable$],
      ([plugin, isRoomWritable]) => plugin !== null && isRoomWritable
    );
  }

  public connectStorage<TState extends Record<string, unknown> = any>(
    namespace?: string,
    defaultState?: TState
  ): Storage<TState> {
    const storage = new Storage({
      plugin$: this._plugin$,
      isWritable$: this._isPluginWritable$,
      namespace,
      defaultState,
    });
    const disconnectDisposerID = this._sideEffect.addDisposer(() =>
      storage.disconnect()
    );
    const disposerID = this._sideEffect.addDisposer(
      storage.on("disconnected", () => {
        this._sideEffect.remove(disconnectDisposerID);
        this._sideEffect.flush(disposerID);
      })
    );
    return storage;
  }

  public get isPluginWritable(): boolean {
    return this._isPluginWritable$.value;
  }

  public addPluginWritableChangeListener(
    listener: (isWritable: boolean) => void
  ): () => void {
    return reaction(this._isPluginWritable$, listener);
  }

  public get isRoomWritable(): boolean {
    return this._isRoomWritable$.value;
  }

  public async setRoomWritable(isWritable: boolean): Promise<void> {
    if (!this._room) {
      throw new Error("[SyncedStore]: cannot set room writable in replay mode");
    }
    await this._room.setWritable(isWritable);
  }

  public addRoomWritableChangeListener(
    listener: (isWritable: boolean) => void
  ): () => void {
    return reaction(this._isRoomWritable$, listener);
  }

  /** Dispatch events to other clients (and self). */
  public dispatchEvent<
    TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>,
  >(event: TEvent, payload: TEventData[TEvent]): void {
    if (!this._room) {
      throw new Error("[SyncedStore] cannot dispatch event in replay mode");
    }
    this._room.dispatchMagixEvent(event, payload);
  }

  /** Listen to events from others clients (and self messages). */
  public addEventListener<
    TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>,
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
    TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>,
  >(event: TEvent, listener?: MagixEventHandler<TEventData, TEvent>): void {
    return this.displayer.removeMagixEventListener(
      event,
      listener as WhiteEventListener
    );
  }

  /** Wait for all sync operations being pushed to server. */
  public nextFrame(): Promise<void> {
    return new Promise(resolve => {
      if (isRoom(this.displayer)) {
        const uid = genUID();
        const channel = "SyncedStoreNextFrame";
        const handler: WhiteEventListener = ev => {
          if (ev.payload === uid) {
            this.displayer.removeMagixEventListener(channel, handler);
            resolve();
          }
        };
        this.displayer.addMagixEventListener(channel, handler, {
          fireSelfEventAfterCommit: true,
        });
        try {
          this.displayer.dispatchMagixEvent(channel, uid);
        } catch (error) {
          console.warn(error);
          this.displayer.removeMagixEventListener(channel, handler);
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  /** @deprecated Use `dispose()` instead. */
  public destroy(): void {
    this.dispose();
  }

  public dispose(): void {
    this._sideEffect.flushAll();
    this._isPluginWritable$.dispose();
  }
}
