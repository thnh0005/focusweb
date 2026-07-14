export type SessionMode = "normal" | "deep-work";
export type SessionStatus = "active" | "paused";
export type WarningLevel = 1 | 2 | 3;
export type BlacklistRiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type SupportedLanguage = "vi" | "en";

export interface BlacklistPayload {
  domain: string;
  severity: "high" | "medium" | "low";
  enabled?: boolean;
  source?: "DEFAULT" | "USER" | "default" | "custom";
  updatedAt?: string;
}

export interface ExtensionSessionStartPayload {
  sessionId: string;
  goal?: string;
  mode: SessionMode;
  blacklist: BlacklistPayload[];
  backendApiUrl?: string;
  extensionToken?: string;
  appUrl?: string;
  plannedDurationMinutes?: number;
  language?: SupportedLanguage;
}

export type RuntimeMessageType =
  | "PING"
  | "SESSION_START"
  | "SESSION_PAUSE"
  | "SESSION_RESUME"
  | "SESSION_END"
  | "SESSION_CANCEL"
  | "BLACKLIST_SYNC"
  | "LANGUAGE_SYNC"
  | "GET_STATUS"
  | "BLACKLIST_RETURN_TO_FOCUS"
  | "BLACKLIST_OVERLAY_DISMISSED";

export interface RuntimeMessage {
  type: RuntimeMessageType;
  payload?: unknown;
}

export type ExtensionEventType =
  | "PONG"
  | "SCORE_UPDATE"
  | "WARNING"
  | "AUTO_PAUSE"
  | "TAB_SWITCH"
  | "CONTENT_CHANGED"
  | "DISCONNECTED"
  | "SYNC_COMPLETE";

export interface ExtensionEvent {
  type: ExtensionEventType;
  payload?: Record<string, unknown>;
}

export interface TrackedTab {
  tabId?: number;
  windowId?: number;
  url: string;
  domain: string;
  title?: string;
  startedAt: string;
}

export interface FocusSessionState {
  sessionId: string;
  goal?: string;
  mode: SessionMode;
  status: SessionStatus;
  startedAt: string;
  pausedAt?: string;
  backendApiUrl: string;
  extensionToken?: string;
  appUrl: string;
  plannedDurationMinutes?: number;
  language?: SupportedLanguage;
  blacklist: BlacklistPayload[];
  blacklistEnforcement?: BlacklistEnforcementState[];
  currentTab?: TrackedTab;
  tabSwitchCount: number;
  lastWarning?: BlacklistWarning;
  backendConnected?: boolean;
  lastBackendHeartbeatAt?: string;
  lastSyncAt?: string;
  lastError?: string;
}

export type BrowserEventType =
  | "url_change"
  | "tab_switch"
  | "idle"
  | "active"
  | "warning";

export interface QueuedEvent {
  id: string;
  sessionId: string;
  event_type: BrowserEventType;
  occurred_at: string;
  url?: string;
  domain?: string;
  page_title?: string;
  active_seconds?: number;
  idle_seconds?: number;
  tab_switch_count?: number;
}

export interface BackendEventPayload {
  event_type: BrowserEventType;
  client_event_id: string;
  occurred_at: string;
  url?: string;
  domain?: string;
  page_title?: string;
  active_seconds?: number;
  idle_seconds?: number;
  tab_switch_count?: number;
}

export interface EventBatchResponse {
  status: string;
  batch_id?: string;
  accepted_count?: number;
  rejected_count?: number;
  duplicate_count?: number;
  warning_cycles?: Array<{
    event_index?: number;
    event_type?: string;
    result?: Record<string, unknown>;
  }>;
  ai?: Record<string, unknown>;
}

export interface QueueFlushResult {
  ok: boolean;
  sent: number;
  retained: number;
  error?: string;
  sessionClosed?: boolean;
}

export interface BlacklistWarning {
  sessionId: string;
  domain: string;
  matchedDomain: string;
  severity: "high" | "medium" | "low";
  riskLevel: BlacklistRiskLevel;
  level: WarningLevel;
  occurredAt: string;
  warningCount?: number;
}

export interface BlacklistEnforcementState {
  sessionId: string;
  tabId: number;
  domain: string;
  riskLevel: BlacklistRiskLevel;
  warningCount: number;
  lastWarningAt: number | null;
  enteredAt: number;
  stopScheduledAt: number | null;
  phase: "IDLE" | "WARNING" | "GRACE_PERIOD" | "STOPPED";
}

export interface ExtensionSnapshot {
  installed: boolean;
  connected: boolean;
  version: string;
  activeSession: FocusSessionState | null;
  pendingEvents: number;
  lastSyncAt?: string;
  backendConnected?: boolean;
  lastBackendHeartbeatAt?: string;
  lastError?: string;
  currentDomain?: string;
  currentTitle?: string;
  lastWarning?: BlacklistWarning;
}
