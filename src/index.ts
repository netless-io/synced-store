import { EventEmitter } from "eventemitter3";
import { InvisiblePlugin, autorun, InvisiblePluginContext, Room, isRoom } from "white-web-sdk";

export class SyncedStore extends InvisiblePlugin<{}> {
    public static kind = "SyncedStore";

    private syncDisposer: any;
    public emitter = new EventEmitter<{ attributesUpdate: any }>();

    constructor(context: InvisiblePluginContext) {
        super(context);
        this.syncDisposer = autorun(() => {
            const attr = this.attributes;
            this.emitter.emit("attributesUpdate", attr);
        });
    }

    /**
     * 创建 syncedStore
     * @static
     * @param {Room} room
     * @returns
     * @memberof SyncedStore
     */
    public static async create(room: Room) {
        let syncedStore = room.getInvisiblePlugin(SyncedStore.kind) as SyncedStore;
        if (!syncedStore) {
            syncedStore = await room.createInvisiblePlugin(SyncedStore, {}) as SyncedStore;
        }
        return syncedStore;
    }

    /**
     * 是否可以调用 store 的写入 api
     * @memberof SyncedStore
     */
    public get canOperate() {
        if (isRoom(this.displayer)) {
            return (this.displayer as Room).isWritable;
        } else {
            return false;
        }
    }

    /**
     * 设置 attributes, 白板只有为可写状态时才可以调用成功
     * @param attributes 
     */
    public safeSetAttributes(attributes: any) {
        if (this.canOperate) {
            this.setAttributes(attributes);
        }
    }
    /**
     * 更新指定的 key, 白板只有为可写状态时才可以调用成功
     * @param {string[]} keys
     * @param {*} value
     * @memberof SyncedStore
     */
    public safeUpdateAttributes(keys: string[], value: any) {
        if (this.canOperate) {
            this.updateAttributes(keys, value);
        }
    }

    public onDestroy() {
        super.onDestroy();
        this.syncDisposer && this.syncDisposer();
    }
}
