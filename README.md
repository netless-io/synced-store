# SyncedStore

### install
```
yarn add @netless/synced-store
```

### 使用
```javascript
import { WhiteWebSdk } from "white-web-sdk";
import { SyncedStore } from "@netless/synced-store";

sdk.joinRoom({
    uuid: "room uuid",
    roomToken: "room token",
    invisiblePlugins: [SyncedStore],
}).then(async room => {
    const syncedStore = await SyncedStore.create(room);

    syncedStore.attributes // 当前的 attributes
    
    syncedStore.emitter.on("attributesUpdate", attributes => { //监听 attributes 更新
        // code
    });

    syncedStore.safeSetAttributes({ apps: { box1: { width: 100, height: 200 } }}); // 设置 apps
    syncedStore.safeUpdateAttributes(["apps", "box1"]: { width: 200, height: 300 }); // 更新某个指定的 key

    syncedStore.setAttributes({ apps: { box1: { width: 100, height: 200 } }}); // 非 safe api 会在 room 不可写的情况下报错
    syncedStore.updateAttributes(["apps", "box1"]: { width: 200, height: 300 });
});
```
