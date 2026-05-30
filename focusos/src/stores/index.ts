/**
 * FocusOS Global Zustand Stores
 * ─────────────────────────────────────────────────────────────────
 * Central state engines dividing concerns between:
 *   - Client states (timers, ambient music, extension telemetry)
 *   - Auth sessions (credentials, onboarding complete flag)
 *   - Telemetry heartbeat trackers
 *   - Optimistic checklist stores
 */

export { useAuthStore } from "./auth.store";
export type { AuthState } from "./auth.store";

export { useUserStore } from "./user.store";
export type { UserState } from "./user.store";

export { useSessionStore } from "./session.store";
export type { SessionState } from "./session.store";

export { useExtensionStore } from "./extension.store";
export type { ExtensionState } from "./extension.store";

export { useNotificationStore } from "./notification.store";
export type { NotificationState, Toast } from "./notification.store";

export { useMusicStore } from "./music.store";
export type { MusicState } from "./music.store";

export { useTasksStore } from "./tasks.store";
export type { TasksState } from "./tasks.store";

export { useAnalyticsStore } from "./analytics.store";
export type { AnalyticsState } from "./analytics.store";
