import { expect, test } from "@playwright/test";
import {
  createRoom,
  getMainStoreState,
  getRoomPhase,
  getWindow,
  gotoRoom,
  setMainStoreState,
  waitForPhase,
} from "./helper";

test.describe("正常流程", () => {
  test.beforeEach(async ({ page }) => {
    const { uuid, token } = await createRoom();
    await gotoRoom(page, uuid, token);
  });

  test("挂载成功", async ({ page }) => {
    const handle = await getWindow(page);

    expect(await getRoomPhase(handle)).toBe("connected");
    expect(await getMainStoreState(handle)).toEqual({
      hello: "hello",
      world: "world",
    });
  });

  test("刷新页面 - 保持状态", async ({ page }) => {
    const handle = await getWindow(page);

    await setMainStoreState(handle, { hello: 42 });
    expect(await getMainStoreState(handle)).toHaveProperty("hello", 42);
    await page.waitForTimeout(1000); // wait for sending websocket message

    await page.reload();
    const handle2 = await getWindow(page);
    await waitForPhase(handle2, "connected");

    expect(await getMainStoreState(handle2)).toHaveProperty("hello", 42);
  });
});
