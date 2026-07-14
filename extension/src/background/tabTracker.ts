import { MIN_ACTIVE_SECONDS } from "../shared/constants";
import { broadcastToFocusOS, EVENT_TYPES } from "../shared/messages";
import { handleBlacklistEnforcement } from "./blacklistEnforcement";
import { getDomainFromUrl, isTrackableUrl, sanitizeTitle } from "./domain";
import { createQueuedEvent, enqueueEvent } from "./eventQueue";
import type {
  FocusSessionState,
  QueuedEvent,
  TrackedTab,
} from "./types";

function secondsBetween(startedAt: string, endedAt = new Date()): number {
  const startMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) return 0;
  return Math.max(0, Math.round((endedAt.getTime() - startMs) / 1000));
}

function shouldTrackSession(session: FocusSessionState): boolean {
  return session.status === "active";
}

function createTrackedTab(tab: chrome.tabs.Tab): TrackedTab | null {
  if (!isTrackableUrl(tab.url)) return null;
  const domain = getDomainFromUrl(tab.url);
  if (!domain) return null;

  return {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url as string,
    domain,
    title: sanitizeTitle(tab.title),
    startedAt: new Date().toISOString(),
  };
}

async function getCurrentActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tabs[0] ?? null;
}

async function enqueueActiveDuration(
  session: FocusSessionState,
  options: { continueCurrent: boolean }
): Promise<FocusSessionState> {
  if (!shouldTrackSession(session) || !session.currentTab) {
    return session;
  }

  const activeSeconds = secondsBetween(session.currentTab.startedAt);
  let nextSession = session;

  if (activeSeconds >= MIN_ACTIVE_SECONDS) {
    await enqueueEvent(
      createQueuedEvent(session.sessionId, {
        event_type: "active",
        url: session.currentTab.url,
        domain: session.currentTab.domain,
        page_title: session.currentTab.title,
        active_seconds: activeSeconds,
      })
    );
  }

  if (options.continueCurrent) {
    nextSession = {
      ...session,
      currentTab: {
        ...session.currentTab,
        startedAt: new Date().toISOString(),
      },
    };
  } else {
    nextSession = {
      ...session,
      currentTab: undefined,
    };
  }

  return nextSession;
}

export async function captureActiveTab(
  session: FocusSessionState,
  eventType: "url_change" | "tab_switch" | "active" = "active"
): Promise<FocusSessionState> {
  let nextSession = await enqueueActiveDuration(session, {
    continueCurrent: false,
  });

  if (!shouldTrackSession(nextSession)) {
    return nextSession;
  }

  const tab = await getCurrentActiveTab();
  if (!tab) return nextSession;

  const trackedTab = createTrackedTab(tab);
  if (!trackedTab) {
    return {
      ...nextSession,
      currentTab: undefined,
    };
  }

  if (eventType !== "active") {
    const event: QueuedEvent = createQueuedEvent(nextSession.sessionId, {
      event_type: eventType,
      url: trackedTab.url,
      domain: trackedTab.domain,
      page_title: trackedTab.title,
      tab_switch_count: nextSession.tabSwitchCount,
    });
    await enqueueEvent(event);
  }

  await broadcastToFocusOS({
    type: EVENT_TYPES.contentChanged,
    payload: {
      sessionId: nextSession.sessionId,
      url: trackedTab.url,
      domain: trackedTab.domain,
      title: trackedTab.title ?? "",
    },
  });

  nextSession = {
    ...nextSession,
    currentTab: trackedTab,
  };

  return handleBlacklistEnforcement(nextSession, trackedTab);
}

export async function recordCurrentTabDuration(
  session: FocusSessionState,
  options: { continueCurrent: boolean }
): Promise<FocusSessionState> {
  return enqueueActiveDuration(session, options);
}

export async function handleTabActivated(
  session: FocusSessionState
): Promise<FocusSessionState> {
  if (!shouldTrackSession(session)) return session;

  const nextCount = session.tabSwitchCount + 1;
  await broadcastToFocusOS({
    type: EVENT_TYPES.tabSwitch,
    payload: {
      sessionId: session.sessionId,
      count: nextCount,
    },
  });

  return captureActiveTab(
    {
      ...session,
      tabSwitchCount: nextCount,
    },
    "tab_switch"
  );
}

export async function handleTabUpdated(
  session: FocusSessionState,
  tabId: number
): Promise<FocusSessionState> {
  if (!shouldTrackSession(session)) return session;

  const activeTab = await getCurrentActiveTab();
  if (!activeTab || activeTab.id !== tabId) {
    return session;
  }

  return captureActiveTab(session, "url_change");
}

export async function handleWindowFocusChanged(
  session: FocusSessionState,
  windowId: number
): Promise<FocusSessionState> {
  if (!shouldTrackSession(session)) return session;

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return recordCurrentTabDuration(session, { continueCurrent: false });
  }

  return captureActiveTab(session, "active");
}

export async function handleIdleStateChanged(
  session: FocusSessionState,
  state: "active" | "idle" | "locked"
): Promise<FocusSessionState> {
  if (!shouldTrackSession(session)) return session;

  if (state === "idle" || state === "locked") {
    await enqueueEvent(
      createQueuedEvent(session.sessionId, {
        event_type: "idle",
        idle_seconds: state === "locked" ? 300 : 60,
      })
    );
    return recordCurrentTabDuration(session, { continueCurrent: false });
  }

  return captureActiveTab(session, "active");
}
