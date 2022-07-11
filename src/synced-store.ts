import { SideEffectManager } from "side-effect-manager";
import type { ReadonlyVal } from "value-enhancer";
import { combine, Val } from "value-enhancer";
import type {
  Room,
  EventListener as WhiteEventListener,
  MagixEventListenerOptions,
  Displayer,
  InvisiblePlugin,
} from "white-web-sdk";
import { isRoom } from "white-web-sdk";
import { Storage } from "./storage";
import type {
  MagixEventTypes,
  MagixEventHandler,
  MagixEventListenerDisposer,
} from "./typings";

export class SyncedStore<TEventData extends Record<string, any> = any> {
  public readonly displayer: Displayer;
  public readonly plugin$: Val<InvisiblePlugin<any> | null>;

  private readonly _isPluginWritable$: ReadonlyVal<boolean>;
  private readonly _isRoomWritable$ = new Val(false);
  private readonly _sideEffect = new SideEffectManager();
  private _room: Room | null;

  public constructor(
    displayer: Displayer,
    invisiblePlugin$: Val<InvisiblePlugin<any> | null>
  ) {
    this.displayer = displayer;
    this._room = null;
    this.plugin$ = invisiblePlugin$;

    this._sideEffect.add(() => {
      const update = () =>
        this._isRoomWritable$.setValue(
          isRoom(this.displayer) && Boolean(this.displayer.isWritable)
        );
      update();
      this.displayer.callbacks.on("onEnableWriteNowChanged", update);
      return () =>
        this.displayer.callbacks.off("onEnableWriteNowChanged", update);
    });

    this._isPluginWritable$ = combine(
      [this.plugin$, this._isRoomWritable$],
      ([plugin, isRoomWritable]) => plugin !== null && isRoomWritable
    );

    this._sideEffect.addDisposer(
      this._isRoomWritable$.subscribe(isRoomWritable => {
        this._room = isRoomWritable && isRoom(displayer) ? displayer : null;
      })
    );
  }

  public connectStorage<TState extends Record<string, unknown> = any>(
    namespace?: string,
    defaultState?: TState
  ): Storage<TState> {
    const storage = new Storage({
      plugin$: this.plugin$,
      isWritable$: this._isPluginWritable$,
      namespace,
      defaultState,
    });
    const destroyDisposerID = this._sideEffect.addDisposer(() =>
      storage.destroy()
    );
    const disposerID = this._sideEffect.addDisposer(
      storage.on("destroyed", () => {
        this._sideEffect.remove(destroyDisposerID);
        this._sideEffect.flush(disposerID);
      })
    );
    return storage;
  }

  get room(): Room | null {
    return this._room;
  }

  public get isPluginWritable(): boolean {
    return this._isPluginWritable$.value;
  }

  public addPluginWritableChangeListener(
    listener: (isWritable: boolean) => void
  ): () => void {
    return this._isPluginWritable$.reaction(listener);
  }

  public get isRoomWritable(): boolean {
    return this._isRoomWritable$.value;
  }

  public async setRoomWritable(isWritable: boolean): Promise<void> {
    if (!this.room) {
      throw new Error("[SyncedStore]: cannot set room writable in replay mode");
    }
    await this.room.setWritable(isWritable);
  }

  public addRoomWritableChangeListener(
    listener: (isWritable: boolean) => void
  ): () => void {
    return this._isRoomWritable$.reaction(listener);
  }

  /** Dispatch events to other clients (and self). */
  public dispatchEvent<
    TEvent extends MagixEventTypes<TEventData> = MagixEventTypes<TEventData>
  >(event: TEvent, payload: TEventData[TEvent]): void {
    if (!this.room) {
      throw new Error(
        "[SyncedStore] cannot dispatch event without writable access"
      );
    }
    this.room.dispatchMagixEvent(event, payload);
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

  public destroy(): void {
    this._sideEffect.flushAll();
    this._isPluginWritable$.destroy();
    this.plugin$.destroy();
    this._isRoomWritable$.destroy();
  }
}
