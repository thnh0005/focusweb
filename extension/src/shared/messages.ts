import type { ExtensionEvent, ExtensionEventType } from "../background/types";
import { APP_ORIGIN_PATTERNS } from "./constants";

export const MESSAGE_TYPES = {
  ping: "PING",
  sessionStart: "SESSION_START",
  sessionPause: "SESSION_PAUSE",
  sessionResume: "SESSION_RESUME",
  sessionEnd: "SESSION_END",
  sessionCancel: "SESSION_CANCEL",
  blacklistSync: "BLACKLIST_SYNC",
  getStatus: "GET_STATUS",
} as const;

export const EVENT_TYPES = {
  pong: "PONG",
  warning: "WARNING",
  tabSwitch: "TAB_SWITCH",
  contentChanged: "CONTENT_CHANGED",
  syncComplete: "SYNC_COMPLETE",
  disconnected: "DISCONNECTED",
} as const satisfies Record<string, ExtensionEventType>;

export async function broadcastToFocusOS(event: ExtensionEvent): Promise<void> {
  const tabs = await chrome.tabs.query({ url: [...APP_ORIGIN_PATTERNS] });

  await Promise.allSettled(
    tabs
      .filter((tab) => typeof tab.id === "number")
      .map((tab) => chrome.tabs.sendMessage(tab.id as number, event))
  );
}
