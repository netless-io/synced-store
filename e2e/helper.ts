import type { Browser, Page } from "@playwright/test";
import type { RoomPhase } from "white-web-sdk";
import type { Diff } from "../src/typings";
import type { JoinRoomConfig } from "./typings";

import { request } from "@playwright/test";
import { Remitter } from "remitter";

export interface TestingPageEventData {
  stateChanged: Diff<Record<string, any>>;
  roomPhaseChanged: RoomPhase;
  roomWritableChanged: boolean;
  pluginWritableChanged: boolean;
  hasPluginChanged: boolean;
}

export class TestingPage {
  events = new Remitter();
  roomConfig?: { uuid: string; token: string };

  constructor(
    public browser: Browser,
    public page: Page
  ) {
    this.page.exposeFunction(
      "onStateChanged",
      (diff: TestingPageEventData["stateChanged"]) => {
        this.events.emit("stateChanged", diff);
      }
    );

    this.page.exposeFunction("onRoomPhaseChanged", (phase: RoomPhase) => {
      this.events.emit("roomPhaseChanged", phase);
    });

    this.page.exposeFunction("onRoomWritableChanged", (isWritable: boolean) => {
      this.events.emit("roomWritableChanged", isWritable);
    });

    this.page.exposeFunction(
      "onPluginWritableChanged",
      (isWritable: boolean) => {
        this.events.emit("pluginWritableChanged", isWritable);
      }
    );

    this.page.exposeFunction("onHasPluginChanged", (hasPlugin: boolean) => {
      this.events.emit("hasPluginChanged", hasPlugin);
    });
  }

  async duplicatePage(): Promise<TestingPage> {
    return new TestingPage(
      this.browser,
      await (await this.browser.newContext()).newPage()
    );
  }

  async duplicatePageWithRoom(
    config: Partial<JoinRoomConfig> = {}
  ): Promise<TestingPage> {
    const page = await this.duplicatePage();
    if (!this.roomConfig && (!config.uuid || !config.token)) {
      throw new Error("uuid and token are required");
    }
    await page.gotoRoom({
      ...(this.roomConfig || {}),
      ...config,
    } as JoinRoomConfig);
    return page;
  }

  async gotoRoom(config: JoinRoomConfig): Promise<void> {
    await this.page.goto(
      `/?config=${encodeURIComponent(JSON.stringify(config))}`
    );
    await this.waitForNextEvent(
      "roomPhaseChanged",
      10000,
      roomPhase => roomPhase === "connected"
    );
  }

  async roomPhase(): Promise<RoomPhase> {
    return this.page.evaluate(() => (window as any).room.phase);
  }

  async isRoomWritable(): Promise<boolean> {
    return this.page.evaluate(() => (window as any).room.isWritable);
  }

  async setRoomWritable(isWritable: boolean): Promise<void> {
    await this.page.evaluate(
      isWritable => (window as any).room.setWritable(isWritable),
      isWritable
    );
  }

  async hasInvisiblePlugin(): Promise<boolean> {
    return this.page.evaluate(() =>
      Boolean((window as any).syncedStore._plugin$.value)
    );
  }

  async getStorageState<TState = any>(): Promise<TState> {
    return this.page.evaluate(() => (window as any).mainStorage.state);
  }

  async setStorageState<TState = any>(state: Partial<TState>): Promise<void> {
    await this.page.evaluate(
      state => (window as any).mainStorage.setState(state),
      state
    );
  }

  async waitForNextEvent<TEventName extends keyof TestingPageEventData>(
    eventName: TEventName,
    timeout = 10000,
    predicate?: (data: TestingPageEventData[TEventName]) => boolean
  ): Promise<void> {
    await Promise.race([
      new Promise<void>(resolve => {
        const handler = (data: TestingPageEventData[TEventName]) => {
          if (!predicate || predicate(data)) {
            this.events.off(eventName, handler);
            resolve();
          }
        };
        this.events.on(eventName, handler);
      }),
      new Promise((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout waiting for event ${eventName}`));
        }, timeout);
      }),
    ]);
  }
}

export async function createTestingPage(browser: Browser) {
  return new TestingPage(browser, await (await browser.newContext()).newPage());
}

export async function createTestingPageWithRoom(
  browser: Browser,
  page: Page,
  config: Partial<JoinRoomConfig> = {}
) {
  const roomConfig =
    config.token && config.uuid
      ? { uuid: config.uuid, token: config.token }
      : await createRoom();
  const page1 = new TestingPage(browser, page);
  await page1.gotoRoom({ ...roomConfig, ...config });
  page1.roomConfig = roomConfig;
  return page1;
}

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
