import { expect, test } from "@playwright/test";
import { createTestingPageWithRoom } from "./helper";

test("Next Frame", async ({ page, browser }) => {
  const page1 = await createTestingPageWithRoom(browser, page);
  const page2 = await page1.duplicatePageWithRoom();

  expect(await page1.roomPhase()).toBe("connected");
  expect(await page2.roomPhase()).toBe("connected");

  expect(await page1.isRoomWritable()).toBe(true);
  expect(await page2.isRoomWritable()).toBe(true);
  expect(await page1.getStorageState()).not.toHaveProperty("foo", "bar");
  expect(await page2.getStorageState()).not.toHaveProperty("foo", "bar");

  const pPage2StateChanged = page2.waitForNextEvent("stateChanged");

  await page1.page.evaluate(
    async state => {
      (window as any).mainStorage.setState(state);
      await (window as any).syncedStore.nextFrame();
      await (window as any).syncedStore.setRoomWritable(false);
    },
    { foo: "bar" }
  );

  await pPage2StateChanged;

  expect(await page1.isRoomWritable()).toBe(false);
  expect(await page2.isRoomWritable()).toBe(true);
  expect(await page1.getStorageState()).toHaveProperty("foo", "bar");
  expect(await page2.getStorageState()).toHaveProperty("foo", "bar");
});
