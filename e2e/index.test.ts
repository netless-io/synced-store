import { expect, test } from "@playwright/test";
import { createTestingPageWithRoom } from "./helper";

test.describe("Normal Flow", () => {
  test("Mounted", async ({ browser, page }) => {
    const page1 = await createTestingPageWithRoom(browser, page);

    expect(await page1.roomPhase()).toBe("connected");
    expect(await page1.getStorageState()).toEqual({
      hello: "hello",
      world: "world",
    });
  });

  test("State Restored After Refresh", async ({ browser, page }) => {
    const page1 = await createTestingPageWithRoom(browser, page);

    await page1.setStorageState({ hello: 42 });
    expect(await page1.getStorageState()).toHaveProperty("hello", 42);

    await page1.page.reload();
    await page1.waitForNextEvent(
      "roomPhaseChanged",
      10000,
      roomPhase => roomPhase === "connected"
    );

    expect(await page1.getStorageState()).toHaveProperty("hello", 42);
  });
});
