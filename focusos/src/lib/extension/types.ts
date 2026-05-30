// ═══════════════════════════════════════════════════════════════
// Extension Shared Types — re-exports from types layer
// Used by both bridge.ts and external consumers
// ═══════════════════════════════════════════════════════════════

export type {
  ExtensionConnectionStatus,
  ExtensionSyncStatus,
  ExtensionHeartbeat,
  ExtensionMessageType,
  ExtensionEventType,
  ExtensionMessage,
  ExtensionEvent,
  ExtensionSessionStartPayload,
  BlacklistPayload,
  BrowserEvent,
  ContentSnapshot,
  ScoreUpdatePayload,
  WarningEventPayload,
  TabSwitchPayload,
  ContentChangedPayload,
} from "@/types/extension.types";
