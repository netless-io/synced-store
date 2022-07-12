import type { RoomPhase } from "white-web-sdk";

import { expect, test } from "@playwright/test";
import {
  block,
  createAnotherPage,
  createRoom,
  getLastDiff,
  getMainStoreState,
  getWindow,
  gotoRoom,
  listenConsole,
  matchPrefix,
  setMainStoreState,
} from "./helper";

test("断网重连", async ({ page, browser }) => {
  const { uuid, token } = await createRoom();
  // listenConsole(page, console.log);

  await gotoRoom(page, uuid, token);
  const handle = await getWindow(page);

  const [page2offline, setOffline] = block();
  const [page2online, setOnline] = block();
  const [diffExist, setDiff] = block();

  const page2 = await createAnotherPage(browser, uuid, token);
  listenConsole(page2.page, line => {
    // console.log("page2:", line);

    const match = matchPrefix(line, "-- phase:");
    if (match && match.trim() === ("reconnecting" as `${RoomPhase}`)) {
      setOffline();
    }
    if (match && match.trim() === ("connected" as `${RoomPhase}`)) {
      setOnline();
    }

    matchPrefix(line, "-- diff:") && setDiff();
  });

  await page2.context.setOffline(true);
  await page2offline;

  // now page2 offline, set state at page1 (online)
  await setMainStoreState(handle, { hello: 42 });

  await page2.context.setOffline(false);
  await page2online;
  await diffExist;

  expect(await getLastDiff(page2.handle)).toBeDefined();
  expect(await getMainStoreState(page2.handle)).toHaveProperty("hello", 42);
});
