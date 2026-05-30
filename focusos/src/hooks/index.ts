/**
 * FocusOS React Custom Hooks
 * ─────────────────────────────────────────────────────────────────
 * Reusable layout and feature bindings connecting components:
 *   - countdown timer ticks (useSession)
 *   - chrome browser-bridge messages (useExtensionBridge)
 *   - 30s heartbeat polls (useHeartbeat)
 *   - glow effects/microcopy (useFocusScore)
 *   - user-action audio effects (useAudioManager)
 *   - shortcuts registers & search (useKeyboardShortcuts, useCommandPalette)
 *   - focus safety guards (usePageLeaveGuard)
 */

export { useSession } from "./useSession";
export { useExtensionBridge } from "./useExtensionBridge";
export { useHeartbeat } from "./useHeartbeat";
export { useFocusScore } from "./useFocusScore";
export type { FocusScoreMetrics } from "./useFocusScore";
export { useAudioManager } from "./useAudioManager";
export { useCommandPalette } from "./useCommandPalette";
export type { CommandItem } from "./useCommandPalette";
export { useKeyboardShortcuts } from "./useKeyboardShortcuts";
export type { ShortcutBinding } from "./useKeyboardShortcuts";
export { usePageLeaveGuard } from "./usePageLeaveGuard";
