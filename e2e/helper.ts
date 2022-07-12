import type { Page, JSHandle, Browser } from "@playwright/test";
import type { RoomPhase } from "white-web-sdk";
import type { Storage } from "../src/storage";
import type { Diff } from "../src/typings";

import { request } from "@playwright/test";

export const getWindow = async (page: Page): Promise<JSHandle> => {
  const handle = await page.evaluateHandle(() => ({ window }));
  const properties = await handle.getProperties();
  const window = properties.get("window");
  if (window) {
    return window;
  } else {
    throw new Error("window is not found");
  }
};

export const gotoRoom = async (page: Page, uuid: string, token: string) => {
  await page.goto(`/?uuid=${uuid}&roomToken=${token}`);
  await waitForPhase(await getWindow(page), "connected");
};

export const createRoom = async () => {
  const context = await request.newContext();
  const roomResult = await context.post("https://api.netless.link/v5/rooms", {
    headers: {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      token: process.env.VITE_WHITEBOARD_SECRET!,
      region: "cn-hz",
      "Content-Type": "application/json",
    },
  });
  const roomBody = await roomResult.json();
  const tokenResult = await context.post(
    `https://api.netless.link/v5/tokens/rooms/${roomBody.uuid}`,
    {
      headers: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        token: process.env.VITE_WHITEBOARD_SECRET!,
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        lifespan: 0,
        role: "admin",
      }),
    }
  );
  const tokenBody = await tokenResult.json();
  return { uuid: roomBody.uuid, token: tokenBody };
};

export const getRoomPhase = (handle: JSHandle) => {
  return handle.evaluate(async window => {
    return window.room?.phase;
  });
};

export const waitForPhase = async (handle: JSHandle, phase: `${RoomPhase}`) => {
  while ((await getRoomPhase(handle)) !== phase) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
};

export const createAnotherPage = async (
  browser: Browser,
  uuid: string,
  token: string
) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await gotoRoom(page, uuid, token);
  const handle = await getWindow(page);
  return { page, context, handle };
};

export const setMainStoreState = async (
  handle: JSHandle,
  state: Record<string, unknown>
) => {
  await handle.evaluate(
    (window, { state }) => {
      const mainStorage: Storage = window.mainStorage;
      mainStorage.setState(state);
    },
    { state }
  );
};

export const getMainStoreState = (
  handle: JSHandle
): Promise<Record<string, unknown>> => {
  return handle.evaluate(window => window.mainStorage.state);
};

export const getLastDiff = (
  handle: JSHandle
): Promise<Diff<Record<string, unknown>> | undefined> => {
  return handle.evaluate(window => window.lastDiff);
};

export const broadcast = async (handle: JSHandle, message: any) => {
  await handle.evaluate(
    (window, { message }) => {
      window.broadcast(message);
    },
    { message }
  );
};

export const getLastMessage = (handle: JSHandle): Promise<any> => {
  return handle.evaluate(window => window.lastMessage);
};

export const block = () => {
  let resolve!: () => void;
  const p = new Promise<void>(r => {
    resolve = r;
  });
  return [p, resolve] as const;
};

export const listenConsole = (page: Page, cb: (line: string) => void) => {
  page.on("console", ev => {
    ev.type() === "log" && cb(ev.text());
  });
};

export const matchPrefix = (line: string, prefix: string) => {
  if (line.startsWith(prefix)) return line.slice(prefix.length);
};
