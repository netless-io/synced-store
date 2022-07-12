import { test, expect } from "@playwright/test";
import { getWindow, gotoRoom, createRoom, getRoomPhase } from "./helper";

test.describe("正常流程", () => {
  test.beforeEach(async ({ page }) => {
    const { uuid, token } = await createRoom();
    await gotoRoom(page, uuid, token);
  });

  test("挂载成功", async ({ page }) => {
    const handle = await getWindow(page);

    expect(await getRoomPhase(handle)).toBe("connected");
    expect(
      await handle.evaluate(window => window.mainStorage.state)
    ).toMatchObject({ hello: "hello", world: "world" });
  });
});
