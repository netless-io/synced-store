import { expect, test } from "@playwright/test";
import { createTestingPageWithRoom } from "./helper";

test("Listen Writable Changed", async ({ browser, page }) => {
  const page1 = await createTestingPageWithRoom(browser, page, {
    isWritable: false,
  });

  expect(await page1.isRoomWritable()).toBe(false);
  expect(await page1.hasInvisiblePlugin()).toBe(false);

  const page2 = await page1.duplicatePageWithRoom({ isWritable: false });

  expect(await page1.isRoomWritable()).toBe(false);
  expect(await page1.hasInvisiblePlugin()).toBe(false);
  expect(await page2.isRoomWritable()).toBe(false);
  expect(await page2.hasInvisiblePlugin()).toBe(false);

  await page2.setRoomWritable(true);

  await page1.waitForNextEvent("hasPluginChanged");

  expect(await page1.isRoomWritable()).toBe(false);
  expect(await page1.hasInvisiblePlugin()).toBe(true);
  expect(await page2.isRoomWritable()).toBe(true);
  expect(await page2.hasInvisiblePlugin()).toBe(true);
});
