import {
  STORAGE_KEYS,
  WARNING_INTERVAL_SECONDS,
  WARNING_MAX_LEVEL,
} from "../shared/constants";
import { broadcastToFocusOS, EVENT_TYPES, sendContentScriptMessage } from "../shared/messages";
import { getStorageValue, setStorageValue } from "../shared/storage";
import { findBlacklistWarning } from "./blacklist";
import { createQueuedEvent, enqueueEvent } from "./eventQueue";
import { domainsMatch } from "./domain";
import type {
  BlacklistEnforcementState,
  BlacklistRiskLevel,
  BlacklistWarning,
  FocusSessionState,
  TrackedTab,
  WarningLevel,
} from "./types";

const timers = new Map<string, number>();

function nowMs() {
  return Date.now();
}

function stateKey(sessionId: string, tabId: number | undefined, domain: string) {
  return `${sessionId}:${tabId ?? -1}:${domain}`;
}

function shouldEnforce(session: FocusSessionState) {
  return session.mode === "deep-work" && session.status === "active";
}

function warningLevel(count: number): WarningLevel {
  return Math.max(1, Math.min(WARNING_MAX_LEVEL, count)) as WarningLevel;
}

function getStates(session: FocusSessionState): BlacklistEnforcementState[] {
  return Array.isArray(session.blacklistEnforcement) ? session.blacklistEnforcement : [];
}

function upsertState(
  session: FocusSessionState,
  state: BlacklistEnforcementState
): FocusSessionState {
  const key = stateKey(state.sessionId, state.tabId, state.domain);
  const next = getStates(session).filter(
    (item) => stateKey(item.sessionId, item.tabId, item.domain) !== key
  );
  next.push(state);
  return { ...session, blacklistEnforcement: next };
}

function clearTimersForSession(sessionId: string) {
  for (const [key, timerId] of timers) {
    if (key.startsWith(`${sessionId}:`)) {
      clearTimeout(timerId);
      timers.delete(key);
    }
  }
}

async function sendContentMessage(tabId: number | undefined, message: unknown) {
  await sendContentScriptMessage(tabId, message, { injectIfMissing: true });
}

async function logBlacklistEvent(
  session: FocusSessionState,
  eventName: string,
  domain: string,
  riskLevel: BlacklistRiskLevel,
  warningCount = 0
) {
  await enqueueEvent(
    createQueuedEvent(session.sessionId, {
      event_type: "warning",
      domain,
      page_title: eventName,
      tab_switch_count: warningCount,
    })
  );
}

async function showWarning(
  session: FocusSessionState,
  trackedTab: TrackedTab,
  warning: BlacklistWarning,
  state: BlacklistEnforcementState
) {
  const count = warningLevel(state.warningCount);
  await sendContentMessage(trackedTab.tabId, {
    type: "BLACKLIST_WARNING_OVERLAY",
    payload: {
      sessionId: session.sessionId,
      domain: state.domain,
      riskLevel: state.riskLevel,
      warningCount: count,
      maxWarnings: WARNING_MAX_LEVEL,
      language: session.language || "vi",
    },
  });
  await broadcastToFocusOS({
    type: EVENT_TYPES.warning,
    payload: {
      sessionId: session.sessionId,
      domain: state.domain,
      level: count,
      reason: "blacklist",
      riskLevel: state.riskLevel,
    },
  });
  await logBlacklistEvent(
    session,
    "BLACKLIST_WARNING_SHOWN",
    state.domain,
    state.riskLevel,
    count
  );
  session.lastWarning = {
    ...warning,
    level: count,
    warningCount: count,
    occurredAt: new Date().toISOString(),
  };
}

async function showMediumReminder(
  session: FocusSessionState,
  trackedTab: TrackedTab,
  warning: BlacklistWarning
) {
  const previous = session.lastWarning;
  const previousAt = previous?.occurredAt ? new Date(previous.occurredAt).getTime() : 0;
  if (
    previous?.domain === warning.domain &&
    previous.riskLevel === "MEDIUM" &&
    nowMs() - previousAt < 60_000
  ) {
    return;
  }

  await sendContentMessage(trackedTab.tabId, {
    type: "BLACKLIST_REMINDER_OVERLAY",
    payload: {
      sessionId: session.sessionId,
      domain: warning.domain,
      riskLevel: "MEDIUM",
      language: session.language || "vi",
    },
  });
  await broadcastToFocusOS({
    type: EVENT_TYPES.warning,
    payload: {
      sessionId: session.sessionId,
      domain: warning.domain,
      level: warning.level,
      reason: "blacklist",
      riskLevel: "MEDIUM",
    },
  });
  await logBlacklistEvent(session, "BLACKLIST_DOMAIN_ENTERED", warning.domain, "MEDIUM", 0);
  session.lastWarning = { ...warning, riskLevel: "MEDIUM", occurredAt: new Date().toISOString() };
}

function schedule(key: string, delayMs: number, callback: () => void) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  const timerId = setTimeout(callback, delayMs) as unknown as number;
  timers.set(key, timerId);
}

async function getStoredSession(sessionId: string) {
  const session = await getStorageValue<FocusSessionState | null>(
    STORAGE_KEYS.activeSession,
    null
  );
  if (!session || session.sessionId !== sessionId) return null;
  return session;
}

async function verifyActiveTabStillOnDomain(tabId: number, domain: string) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || !domainsMatch(tab.url || "", domain)) return false;
    const currentWindow = await chrome.windows.get(tab.windowId);
    return Boolean(currentWindow.focused);
  } catch {
    return false;
  }
}

async function persistSession(session: FocusSessionState) {
  await setStorageValue(STORAGE_KEYS.activeSession, session);
}

function scheduleNext(state: BlacklistEnforcementState) {
  const key = stateKey(state.sessionId, state.tabId, state.domain);
  if (state.phase === "WARNING") {
    schedule(key, WARNING_INTERVAL_SECONDS * 1000, () => void advanceWarning(state));
  }
}

async function advanceWarning(state: BlacklistEnforcementState) {
  const session = await getStoredSession(state.sessionId);
  if (!session || !shouldEnforce(session)) return;
  if (!(await verifyActiveTabStillOnDomain(state.tabId, state.domain))) return;

  const current =
    getStates(session).find(
      (item) =>
        item.sessionId === state.sessionId &&
        item.tabId === state.tabId &&
        item.domain === state.domain
    ) || state;

  const nextState = {
    ...current,
    warningCount: Math.min(current.warningCount + 1, WARNING_MAX_LEVEL),
    lastWarningAt: nowMs(),
    phase: "WARNING" as const,
  };
  const warning = findBlacklistWarning(session.sessionId, state.domain, session.blacklist);
  if (!warning) return;
  await showWarning(session, { domain: state.domain, url: "", tabId: state.tabId, startedAt: "" }, warning, nextState);
  await persistSession(upsertState(session, nextState));
  scheduleNext(nextState);
}

export async function handleBlacklistEnforcement(
  session: FocusSessionState,
  trackedTab: TrackedTab
): Promise<FocusSessionState> {
  if (!shouldEnforce(session)) {
    clearTimersForSession(session.sessionId);
    return { ...session, blacklistEnforcement: [] };
  }

  const warning = findBlacklistWarning(session.sessionId, trackedTab.domain, session.blacklist);
  if (!warning || warning.riskLevel === "LOW") {
    clearTimersForSession(session.sessionId);
    await sendContentMessage(trackedTab.tabId, { type: "BLACKLIST_CLEAR_OVERLAY" });
    return session;
  }

  if (warning.riskLevel === "MEDIUM") {
    await showMediumReminder(session, trackedTab, warning);
    return session;
  }

  const key = stateKey(session.sessionId, trackedTab.tabId, warning.domain);
  const existing = getStates(session).find(
    (item) => stateKey(item.sessionId, item.tabId, item.domain) === key
  );
  const state =
    existing ||
    ({
      sessionId: session.sessionId,
      tabId: trackedTab.tabId ?? -1,
      domain: warning.domain,
      riskLevel: "HIGH",
      warningCount: 0,
      lastWarningAt: null,
      enteredAt: nowMs(),
      stopScheduledAt: null,
      phase: "IDLE",
    } satisfies BlacklistEnforcementState);

  if (state.warningCount === 0) {
    const nextState = {
      ...state,
      warningCount: 1,
      lastWarningAt: nowMs(),
      phase: "WARNING" as const,
    };
    await showWarning(session, trackedTab, warning, nextState);
    scheduleNext(nextState);
    return upsertState(session, nextState);
  }

  scheduleNext(state);
  return upsertState(session, state);
}

export function clearBlacklistEnforcement(sessionId: string) {
  clearTimersForSession(sessionId);
}
