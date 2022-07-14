import { expect, test } from "@playwright/test";
import { createTestingPageWithRoom } from "./helper";

test("Send and Receive Events", async ({ page, browser }) => {
  const page1 = await createTestingPageWithRoom(browser, page);
  const page2 = await page1.duplicatePageWithRoom();

  let eventPayload1: any;
  let eventPayload2: any;

  let onPage1Received: () => void;
  const pPage1Received = new Promise<void>(
    resolve => (onPage1Received = resolve)
  );

  await page1.page.exposeFunction("onTestingEventAA", payload => {
    eventPayload1 = payload;
    onPage1Received();
  });
  await page1.page.evaluate(() => {
    (window as any).syncedStore.addEventListener("testingEventAA", details => {
      (window as any).onTestingEventAA(details.payload);
    });
  });

  await page2.page.exposeFunction(
    "onTestingEventAA",
    payload => (eventPayload2 = payload)
  );
  await page2.page.evaluate(() => {
    (window as any).syncedStore.addEventListener("testingEventAA", details => {
      (window as any).onTestingEventAA(details.payload);
    });
  });

  expect(eventPayload1).toBeUndefined();
  expect(eventPayload2).toBeUndefined();

  await page2.page.evaluate(() => {
    (window as any).syncedStore.dispatchEvent("testingEventAA", {
      hello: "world",
    });
  });

  await Promise.race([
    pPage1Received,
    new Promise((resolve, reject) =>
      setTimeout(() => {
        reject(new Error(`Timeout waiting for syncedStore event`));
      }, 10000)
    ),
  ]);

  expect(eventPayload1).toEqual({ hello: "world" });
  expect(eventPayload2).toEqual({ hello: "world" });
});
