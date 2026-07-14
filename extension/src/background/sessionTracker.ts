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
import { clearBlacklistEnforcement } from "./blacklistEnforcement";
import { sendHeartbeat } from "./apiClient";
import { clearQueue, flushQueue, getQueue } from "./eventQueue";
import { normalizeExtensionLanguage, saveExtensionLanguage } from "../i18n";
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
  const session = await getActiveSession();
  if (session) clearBlacklistEnforcement(session.sessionId);
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
    extensionToken: payload.extensionToken,
    appUrl: payload.appUrl || DEFAULT_APP_URL,
    plannedDurationMinutes: payload.plannedDurationMinutes,
    language: normalizeExtensionLanguage(payload.language),
    blacklist: normalizeBlacklist(payload.blacklist),
    tabSwitchCount: 0,
  };

  session = await captureActiveTab(session, "active");
  await saveActiveSession(session);
  await ensureAlarms();

  const pong = await heartbeat();
  await broadcastToFocusOS({
    type: EVENT_TYPES.pong,
    payload: pong,
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
    blacklistEnforcement: [],
    pausedAt: new Date().toISOString(),
  });
  clearBlacklistEnforcement(sessionId);
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
  clearBlacklistEnforcement(sessionId);

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

export async function syncLanguage(payload: unknown): Promise<{ ok: boolean }> {
  if (!isObject(payload)) return { ok: false };
  const language = normalizeExtensionLanguage(payload.language);
  await saveExtensionLanguage(language);
  const session = await getActiveSession();
  if (session) {
    await saveActiveSession({
      ...session,
      language,
    });
  }
  return { ok: true };
}

async function focusApp(payload: unknown): Promise<{ ok: boolean }> {
  const session = await getActiveSession();
  const appUrl =
    isObject(payload) && typeof payload.appUrl === "string"
      ? payload.appUrl
      : session?.appUrl || DEFAULT_APP_URL;
  const tabs = await chrome.tabs.query({ url: `${appUrl.replace(/\/+$/, "")}/*` });
  const tab = tabs.find((item) => typeof item.id === "number");
  if (tab?.id) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
    return { ok: true };
  }
  await chrome.tabs.create({ url: appUrl });
  return { ok: true };
}

export async function flushActiveSession(): Promise<void> {
  const session = await getActiveSession();
  if (!session) return;

  const result = await flushQueue(session);
  if (result.sessionClosed) {
    await clearActiveSession();
    await clearAlarms();
    await broadcastToFocusOS({
      type: EVENT_TYPES.disconnected,
      payload: { sessionId: session.sessionId },
    });
    return;
  }

  await saveActiveSession({
    ...session,
    lastSyncAt: result.ok ? new Date().toISOString() : session.lastSyncAt,
    lastError: result.ok ? undefined : result.error,
  });
}

export async function heartbeat(): Promise<{
  installed: boolean;
  connected: boolean;
  backendConnected: boolean;
  version: string;
  timestamp: number;
}> {
  const session = await getActiveSession();
  if (!session) {
    return {
      installed: true,
      connected: false,
      backendConnected: false,
      version: VERSION,
      timestamp: Date.now(),
    };
  }

  const result = await sendHeartbeat(
    session.backendApiUrl,
    VERSION,
    session.sessionId,
    session.extensionToken
  );
  const now = new Date().toISOString();
  await saveActiveSession({
    ...session,
    backendConnected: result.ok ? Boolean(result.data?.connected) : false,
    lastBackendHeartbeatAt: result.ok ? (result.data?.last_seen ?? now) : session.lastBackendHeartbeatAt,
    lastError: result.ok ? undefined : result.error,
  });

  return {
    installed: true,
    connected: true,
    backendConnected: result.ok ? Boolean(result.data?.connected) : false,
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
    backendConnected: session?.backendConnected,
    lastBackendHeartbeatAt: session?.lastBackendHeartbeatAt,
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
    case "LANGUAGE_SYNC":
      return syncLanguage(message.payload);
    case "BLACKLIST_RETURN_TO_FOCUS":
      return focusApp(message.payload);
    case "BLACKLIST_OVERLAY_DISMISSED":
      return { ok: true };
    case "GET_STATUS":
      return getSnapshot();
    default:
      return { ok: false };
  }
}
