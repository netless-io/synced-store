import { expect, test } from "@playwright/test";
import {
  block,
  createAnotherPage,
  createRoom,
  getLastDiff,
  getWindow,
  gotoRoom,
  setMainStoreState,
} from "./helper";

test("监听状态变更", async ({ page, browser }) => {
  const { uuid, token } = await createRoom();
  await gotoRoom(page, uuid, token);

  const handle = await getWindow(page);

  const [page2ready, resolvePage2] = block();

  const page1 = async () => {
    await page2ready;

    await setMainStoreState(handle, { hello: 42 });
    const diff = await getLastDiff(handle);
    expect(diff).toBeDefined();
    expect(diff?.hello).toMatchObject({ oldValue: "hello", newValue: 42 });
  };

  const page2 = async () => {
    const { page, handle } = await createAnotherPage(browser, uuid, token);
    resolvePage2();

    await page.waitForTimeout(1000);
    const diff = await getLastDiff(handle);
    expect(diff).toBeDefined();
    expect(diff?.hello).toMatchObject({ oldValue: "hello", newValue: 42 });
  };

  await Promise.all([page1(), page2()]);
});
