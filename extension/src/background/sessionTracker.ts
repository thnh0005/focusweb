import {
  DEFAULT_APP_URL,
  DEFAULT_BACKEND_API_URL,
  FLUSH_ALARM_NAME,
  FLUSH_INTERVAL_MINUTES,
  HEARTBEAT_ALARM_NAME,
  STORAGE_KEYS,
} from "../shared/constants";
import { broadcastToFocusOS, EVENT_TYPES } from "../shared/messages";
import {
  getStorageValue,
  removeStorageValue,
  setStorageValue,
} from "../shared/storage";
import { normalizeBlacklist } from "./blacklist";
import { clearQueue, flushQueue, getQueue } from "./eventQueue";
import {
  captureActiveTab,
  recordCurrentTabDuration,
} from "./tabTracker";
import type {
  ExtensionSessionStartPayload,
  ExtensionSnapshot,
  FocusSessionState,
  RuntimeMessage,
} from "./types";

const VERSION = chrome.runtime.getManifest().version;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSessionId(payload: unknown): string | null {
  if (!isObject(payload)) return null;
  return typeof payload.sessionId === "string" ? payload.sessionId : null;
}

function isStartPayload(payload: unknown): payload is ExtensionSessionStartPayload {
  return (
    isObject(payload) &&
    typeof payload.sessionId === "string" &&
    (payload.mode === "normal" || payload.mode === "deep-work") &&
    Array.isArray(payload.blacklist)
  );
}

export async function getActiveSession(): Promise<FocusSessionState | null> {
  return getStorageValue<FocusSessionState | null>(
    STORAGE_KEYS.activeSession,
    null
  );
}

export async function saveActiveSession(
  session: FocusSessionState
): Promise<void> {
  await setStorageValue(STORAGE_KEYS.activeSession, session);
}

export async function clearActiveSession(): Promise<void> {
  await removeStorageValue(STORAGE_KEYS.activeSession);
}

async function ensureAlarms(): Promise<void> {
  await chrome.alarms.create(FLUSH_ALARM_NAME, {
    periodInMinutes: FLUSH_INTERVAL_MINUTES,
  });
  await chrome.alarms.create(HEARTBEAT_ALARM_NAME, {
    periodInMinutes: 1,
  });
}

async function clearAlarms(): Promise<void> {
  await chrome.alarms.clear(FLUSH_ALARM_NAME);
  await chrome.alarms.clear(HEARTBEAT_ALARM_NAME);
}

export async function startSession(
  payload: ExtensionSessionStartPayload
): Promise<{ ok: boolean; session: FocusSessionState }> {
  await clearQueue();

  let session: FocusSessionState = {
    sessionId: payload.sessionId,
    goal: payload.goal,
    mode: payload.mode,
    status: "active",
    startedAt: new Date().toISOString(),
    backendApiUrl: payload.backendApiUrl || DEFAULT_BACKEND_API_URL,
    appUrl: payload.appUrl || DEFAULT_APP_URL,
    plannedDurationMinutes: payload.plannedDurationMinutes,
    blacklist: normalizeBlacklist(payload.blacklist),
    tabSwitchCount: 0,
  };

  session = await captureActiveTab(session, "active");
  await saveActiveSession(session);
  await ensureAlarms();

  await broadcastToFocusOS({
    type: EVENT_TYPES.pong,
    payload: {
      installed: true,
      connected: true,
      version: VERSION,
      timestamp: Date.now(),
    },
  });

  return { ok: true, session };
}

export async function pauseSession(sessionId: string): Promise<{ ok: boolean }> {
  const session = await getActiveSession();
  if (!session || session.sessionId !== sessionId) return { ok: true };

  const updated = await recordCurrentTabDuration(session, {
    continueCurrent: false,
  });
  await saveActiveSession({
    ...updated,
    status: "paused",
    pausedAt: new Date().toISOString(),
  });
  await flushActiveSession();

  return { ok: true };
}

export async function resumeSession(sessionId: string): Promise<{ ok: boolean }> {
  const session = await getActiveSession();
  if (!session || session.sessionId !== sessionId) return { ok: true };

  const updated = await captureActiveTab({
    ...session,
    status: "active",
    pausedAt: undefined,
  });
  await saveActiveSession(updated);
  await ensureAlarms();

  return { ok: true };
}

export async function endSession(sessionId: string): Promise<{ ok: boolean }> {
  const session = await getActiveSession();
  if (!session || session.sessionId !== sessionId) {
    await clearAlarms();
    return { ok: true };
  }

  const updated = await recordCurrentTabDuration(session, {
    continueCurrent: false,
  });
  await saveActiveSession(updated);
  await flushActiveSession();
  await clearActiveSession();
  await clearAlarms();

  await broadcastToFocusOS({
    type: EVENT_TYPES.disconnected,
    payload: { sessionId },
  });

  return { ok: true };
}

export async function syncBlacklist(payload: unknown): Promise<{ ok: boolean }> {
  if (!isObject(payload) || !Array.isArray(payload.entries)) {
    return { ok: false };
  }

  const session = await getActiveSession();
  if (session) {
    await saveActiveSession({
      ...session,
      blacklist: normalizeBlacklist(payload.entries as ExtensionSessionStartPayload["blacklist"]),
    });
  }

  await broadcastToFocusOS({
    type: EVENT_TYPES.syncComplete,
    payload: {},
  });

  return { ok: true };
}

export async function flushActiveSession(): Promise<void> {
  const session = await getActiveSession();
  if (!session) return;

  const result = await flushQueue(session);
  await saveActiveSession({
    ...session,
    lastSyncAt: result.ok ? new Date().toISOString() : session.lastSyncAt,
    lastError: result.ok ? undefined : result.error,
  });
}

export async function heartbeat(): Promise<{
  installed: boolean;
  connected: boolean;
  version: string;
  timestamp: number;
}> {
  const session = await getActiveSession();
  return {
    installed: true,
    connected: Boolean(session),
    version: VERSION,
    timestamp: Date.now(),
  };
}

export async function getSnapshot(): Promise<ExtensionSnapshot> {
  const [session, queue] = await Promise.all([getActiveSession(), getQueue()]);

  return {
    installed: true,
    connected: Boolean(session),
    version: VERSION,
    activeSession: session,
    pendingEvents: queue.length,
    lastSyncAt: session?.lastSyncAt,
    lastError: session?.lastError,
    currentDomain: session?.currentTab?.domain,
    currentTitle: session?.currentTab?.title,
    lastWarning: session?.lastWarning,
  };
}

export async function handleRuntimeMessage(
  message: RuntimeMessage
): Promise<unknown> {
  switch (message.type) {
    case "PING":
      return heartbeat();
    case "SESSION_START":
      if (!isStartPayload(message.payload)) return { ok: false };
      return startSession(message.payload);
    case "SESSION_PAUSE": {
      const sessionId = getSessionId(message.payload);
      return sessionId ? pauseSession(sessionId) : { ok: false };
    }
    case "SESSION_RESUME": {
      const sessionId = getSessionId(message.payload);
      return sessionId ? resumeSession(sessionId) : { ok: false };
    }
    case "SESSION_END":
    case "SESSION_CANCEL": {
      const sessionId = getSessionId(message.payload);
      return sessionId ? endSession(sessionId) : { ok: false };
    }
    case "BLACKLIST_SYNC":
      return syncBlacklist(message.payload);
    case "GET_STATUS":
      return getSnapshot();
    default:
      return { ok: false };
  }
}
