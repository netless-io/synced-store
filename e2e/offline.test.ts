import { expect, test } from "@playwright/test";
import { createTestingPageWithRoom } from "./helper";

test("Reconnection", async ({ page, browser }) => {
  const page1 = await createTestingPageWithRoom(browser, page);
  const page2 = await page1.duplicatePageWithRoom();

  expect(await page1.roomPhase()).toBe("connected");
  expect(await page2.roomPhase()).toBe("connected");

  const page1OldState = await page1.getStorageState();

  let page1Diff;
  let page2Diff;

  page1.events.on("stateChanged", diff => (page1Diff = diff));
  page2.events.on("stateChanged", diff => (page1Diff = diff));

  await page2.page.context().setOffline(true);
  await page2.waitForNextEvent(
    "roomPhaseChanged",
    30000,
    roomPhase => roomPhase !== "connected"
  );

  await page1.setStorageState({ hello: 422222 });

  await page2.page.context().setOffline(false);
  await page2.waitForNextEvent(
    "roomPhaseChanged",
    30000,
    roomPhase => roomPhase === "connected"
  );

  expect(page1Diff).toEqual({
    hello: { newValue: 422222, oldValue: page1OldState.hello },
  });
  expect(page2Diff).toBeFalsy();
  expect(await page1.getStorageState()).toHaveProperty("hello", 422222);
  expect(await page2.getStorageState()).toHaveProperty("hello", 422222);
});
