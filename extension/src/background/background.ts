import { FLUSH_ALARM_NAME } from "../shared/constants";
import { logger } from "../shared/logger";
import { broadcastToFocusOS, EVENT_TYPES } from "../shared/messages";
import {
  flushActiveSession,
  getActiveSession,
  handleRuntimeMessage,
  heartbeat,
  saveActiveSession,
} from "./sessionTracker";
import {
  handleIdleStateChanged,
  handleTabActivated,
  handleTabUpdated,
  handleWindowFocusChanged,
  recordCurrentTabDuration,
} from "./tabTracker";
import type { RuntimeMessage } from "./types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(60);
  logger.info("Installed");
});

chrome.runtime.onStartup.addListener(() => {
  chrome.idle.setDetectionInterval(60);
});

function routeRuntimeMessage(
  message: RuntimeMessage,
  sendResponse: (response?: unknown) => void
): boolean {
  void handleRuntimeMessage(message)
    .then(sendResponse)
    .catch((error) => {
      logger.error("Runtime message failed", error);
      sendResponse({ ok: false, error: "runtime_message_failed" });
    });
  return true;
}

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) =>
  routeRuntimeMessage(message as RuntimeMessage, sendResponse)
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) =>
  routeRuntimeMessage(message as RuntimeMessage, sendResponse)
);

chrome.tabs.onActivated.addListener(() => {
  void (async () => {
    const session = await getActiveSession();
    if (!session) return;
    const updated = await handleTabActivated(session);
    await saveActiveSession(updated);
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url && !changeInfo.title && changeInfo.status !== "complete") {
    return;
  }

  void (async () => {
    const session = await getActiveSession();
    if (!session) return;
    const updated = await handleTabUpdated(session, tabId);
    await saveActiveSession(updated);
  })();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  void (async () => {
    const session = await getActiveSession();
    if (!session) return;
    const updated = await handleWindowFocusChanged(session, windowId);
    await saveActiveSession(updated);
  })();
});

chrome.idle.onStateChanged.addListener((state) => {
  void (async () => {
    const session = await getActiveSession();
    if (!session) return;
    const updated = await handleIdleStateChanged(session, state);
    await saveActiveSession(updated);
  })();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    const session = await getActiveSession();
    if (!session) return;

    if (alarm.name === FLUSH_ALARM_NAME) {
      const updated = await recordCurrentTabDuration(session, {
        continueCurrent: true,
      });
      await saveActiveSession(updated);
      await flushActiveSession();
      return;
    }

    const pong = await heartbeat();
    await broadcastToFocusOS({
      type: EVENT_TYPES.pong,
      payload: pong,
    });
  })();
});
