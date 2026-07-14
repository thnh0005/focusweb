// ═══════════════════════════════════════════════════════════════
// Extension Types — FocusOS (Browser Extension Bridge)
// ═══════════════════════════════════════════════════════════════

import type { FocusStateLabel, SessionMode, WarningLevel } from "./session.types";

// ── Extension Status ──────────────────────────────────────────

export type ExtensionConnectionStatus =
  | "connected"
  | "disconnected"
  | "tracking"
  | "syncing";

export type ExtensionSyncStatus = "synced" | "syncing" | "error" | "idle";

export interface ExtensionHeartbeat {
  installed: boolean;
  connected: boolean;
  version: string;
  timestamp: number;
}

// ── Extension Messages (Web App → Extension) ──────────────────

export type ExtensionMessageType =
  | "PING"
  | "SESSION_START"
  | "SESSION_PAUSE"
  | "SESSION_RESUME"
  | "SESSION_END"
  | "SESSION_CANCEL"
  | "BLACKLIST_SYNC"
  | "LANGUAGE_SYNC"
  | "GET_STATUS";

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: ExtensionMessagePayload;
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
  language?: "vi" | "en";
}

export interface BlacklistPayload {
  domain: string;
  severity: "high" | "medium" | "low";
  enabled?: boolean;
  source?: "DEFAULT" | "USER";
  updatedAt?: string;
}

export type ExtensionMessagePayload =
  | ExtensionSessionStartPayload
  | { sessionId: string }
  | { entries: BlacklistPayload[] }
  | { language: "vi" | "en" }
  | Record<string, never>;

// ── Extension Events (Extension → Web App) ────────────────────

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
  payload?: ExtensionEventPayload;
}

export interface ScoreUpdatePayload {
  score: number;
  state: FocusStateLabel;
  sessionId: string;
}

export interface WarningEventPayload {
  level: WarningLevel;
  domain?: string;
  sessionId: string;
  reason: "blacklist" | "off-topic" | "idle" | "tab-switching";
}

export interface TabSwitchPayload {
  count: number;
  sessionId: string;
}

export interface ContentChangedPayload {
  url: string;
  domain: string;
  title: string;
  sessionId: string;
  relevanceScore?: number;
}

export type ExtensionEventPayload =
  | ExtensionHeartbeat
  | ScoreUpdatePayload
  | WarningEventPayload
  | TabSwitchPayload
  | ContentChangedPayload
  | { sessionId: string }
  | Record<string, never>;

// ── Browser Event Data (collected by extension) ───────────────

export interface BrowserEvent {
  id: string;
  clientEventId: string;
  sessionId: string;
  event_type:
    | "url_change"
    | "tab_switch"
    | "idle"
    | "active"
    | "warning";
  url?: string;
  domain?: string;
  page_title?: string;
  meta_description?: string;
  content_snippet?: string;
  active_seconds?: number;
  idle_seconds?: number;
  tab_switch_count?: number;
  occurredAt: string;
}

// ── Content Extraction ────────────────────────────────────────

export interface ContentSnapshot {
  url: string;
  domain: string;
  title: string;
  metaDescription?: string;
  bodyExcerpt?: string; // max 500 chars
  capturedAt: number;
}

// ── Privacy boundary — these fields NEVER exist in any payload
// url, domain, title, metaDescription, bodyExcerpt (max 500 chars) — YES
// passwords, form content, keyboard input, private messages      — NEVER
