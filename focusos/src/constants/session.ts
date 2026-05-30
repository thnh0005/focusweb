// ═══════════════════════════════════════════════════════════════
// Session Constants — FocusOS
// ═══════════════════════════════════════════════════════════════

import type { SessionMode, PhaseConfig } from "@/types/session.types";

// ── Duration Presets ──────────────────────────────────────────

export const DURATION_PRESETS = [
  { label: "25 min", minutes: 25, description: "Classic Pomodoro" },
  { label: "50 min", minutes: 50, description: "Deep work block" },
  { label: "90 min", minutes: 90, description: "Flow state session" },
] as const;

export const DEFAULT_DURATION_MINUTES = 50;

export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 180;

// ── Session Modes ─────────────────────────────────────────────

export const SESSION_MODE_CONFIG: Record<SessionMode, {
  label: string;
  description: string;
  requiresGoal: boolean;
  icon: string;
}> = {
  "normal": {
    label: "Normal Mode",
    description: "Lightweight focus with blacklist-based distraction alerts",
    requiresGoal: false,
    icon: "⚡",
  },
  "deep-work": {
    label: "Deep Work Mode",
    description: "AI-assisted focus with semantic content analysis",
    requiresGoal: true,
    icon: "🧠",
  },
};

// ── Warning System ────────────────────────────────────────────

export const WARNING_INTERVAL_SECONDS = 5;
export const MAX_WARNINGS_BEFORE_PAUSE = 3;

export const WARNING_MESSAGES = {
  1: {
    title: "You've drifted from your goal",
    description: "Take a moment to return to your focus.",
    severity: "low" as const,
  },
  2: {
    title: "You're still off-track",
    description: "Your focus session needs your attention.",
    severity: "medium" as const,
  },
  3: {
    title: "Return to your work now",
    description: "Your timer will pause if you don't refocus.",
    severity: "high" as const,
  },
} as const;

// ── Session Phases ────────────────────────────────────────────

export const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  focus: {
    phase: "focus",
    durationMinutes: 50,
    glowColor: "#7C3AED",
    timerRingColor: "#7C3AED",
    microcopy: "Stay in the zone",
  },
  "short-break": {
    phase: "short-break",
    durationMinutes: 10,
    glowColor: "#06B6D4",
    timerRingColor: "#06B6D4",
    microcopy: "Rest your eyes",
  },
  "long-break": {
    phase: "long-break",
    durationMinutes: 20,
    glowColor: "#14B8A6",
    timerRingColor: "#14B8A6",
    microcopy: "Step away, breathe",
  },
};

// ── Extension Heartbeat ───────────────────────────────────────

export const EXTENSION_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const EXTENSION_HEARTBEAT_TIMEOUT_MS = 5_000;

// ── Session History Pagination ────────────────────────────────

export const SESSION_HISTORY_PAGE_SIZE = 20;

// ── Idle Detection ────────────────────────────────────────────

export const IDLE_DETECTION_THRESHOLD_SECONDS = 120; // 2 minutes

// ── Smart Preset ──────────────────────────────────────────────

export const SMART_PRESET_MIN_SESSIONS = 5;

// ── Score Update ──────────────────────────────────────────────

export const SCORE_UPDATE_INTERVAL_MS = 45_000;

// ── Key Keyboard Shortcuts ────────────────────────────────────

export const KEYBOARD_SHORTCUTS = {
  PAUSE_RESUME: " ",           // Space
  END_SESSION: "Escape",
  TOGGLE_NOTEPAD: "n",
  TOGGLE_MUSIC: "m",
  COMMAND_PALETTE: "k",        // Cmd/Ctrl+K
} as const;
