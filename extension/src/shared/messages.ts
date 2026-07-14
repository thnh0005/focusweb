import type { ExtensionEvent, ExtensionEventType } from "../background/types";
import { APP_ORIGIN_PATTERNS } from "./constants";

const CONTENT_SCRIPT_FILE = "content.js";

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

function isInjectableTabUrl(url?: string): boolean {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isInjectableTabUrl(tab.url)) return false;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE],
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendContentScriptMessage(
  tabId: number | undefined,
  message: unknown,
  options: { injectIfMissing?: boolean } = {}
): Promise<boolean> {
  if (typeof tabId !== "number") return false;

  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    if (!options.injectIfMissing) return false;
  }

  const injected = await injectContentScript(tabId);
  if (!injected) return false;

  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

export async function broadcastToFocusOS(event: ExtensionEvent): Promise<void> {
  const tabs = await chrome.tabs.query({ url: [...APP_ORIGIN_PATTERNS] });

  await Promise.allSettled(
    tabs
      .filter((tab) => typeof tab.id === "number")
      .map((tab) =>
        sendContentScriptMessage(tab.id, event, {
          injectIfMissing: true,
        })
      )
  );
}
