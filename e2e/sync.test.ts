import { expect, test } from "@playwright/test";
import { createTestingPageWithRoom } from "./helper";

test("Listening to State Changed", async ({ page, browser }) => {
  const page1 = await createTestingPageWithRoom(browser, page);
  const page2 = await page1.duplicatePageWithRoom();

  let page1Diff;
  let page2Diff;
  page1.events.on("stateChanged", diff => (page1Diff = diff));
  page2.events.on("stateChanged", diff => (page2Diff = diff));

  const page1OldState = await page1.getStorageState();
  const page2OldState = await page2.getStorageState();

  expect(page1OldState).toEqual(page2OldState);

  expect(page1Diff).toBeUndefined();
  expect(page2Diff).toBeUndefined();

  await page1.setStorageState({ hello: "mmmm" });
  await page2.waitForNextEvent("stateChanged");

  expect(await page1.getStorageState()).toEqual(await page2.getStorageState());

  expect(page1Diff).toEqual({
    hello: { newValue: "mmmm", oldValue: page1OldState.hello },
  });
  expect(page1Diff).toEqual({
    hello: { newValue: "mmmm", oldValue: page2OldState.hello },
  });
});
