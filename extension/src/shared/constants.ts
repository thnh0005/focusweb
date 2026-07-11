export const DEFAULT_BACKEND_API_URL = "http://127.0.0.1:8000/api";
export const DEFAULT_APP_URL = "http://localhost:3000";

export const STORAGE_KEYS = {
  activeSession: "focusos.activeSession",
  queue: "focusos.eventQueue",
  snapshot: "focusos.snapshot",
} as const;

export const FLUSH_ALARM_NAME = "focusos.flushEvents";
export const HEARTBEAT_ALARM_NAME = "focusos.heartbeat";
export const FLUSH_INTERVAL_MINUTES = 0.25;
export const MAX_QUEUE_SIZE = 500;
export const MAX_BATCH_SIZE = 50;
export const MIN_ACTIVE_SECONDS = 1;

export const APP_ORIGIN_PATTERNS = [
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*",
] as const;

export const IGNORED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
  "view-source:",
] as const;
