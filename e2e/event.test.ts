import { expect, test } from "@playwright/test";
import {
  block,
  broadcast,
  createAnotherPage,
  createRoom,
  getLastMessage,
  getWindow,
  gotoRoom,
  listenConsole,
  matchPrefix,
} from "./helper";

test("收发广播事件", async ({ page, browser }) => {
  const { uuid, token } = await createRoom();
  await gotoRoom(page, uuid, token);

  const handle = await getWindow(page);

  const [page2ready, resolvePage2] = block();

  const page1 = async () => {
    await page2ready;
    await broadcast(handle, "hello world!");
    const message = await getLastMessage(handle);
    expect(message).toBe("hello world!");
  };

  const page2 = async () => {
    const { page } = await createAnotherPage(browser, uuid, token);
    listenConsole(page, line => {
      const match = matchPrefix(line, "-- message:");
      match && expect(match.trim()).toBe("hello world!");
    });
    resolvePage2();
  };

  await Promise.all([page1(), page2()]);
});
