// ═══════════════════════════════════════════════════════════════
// Focus Score Constants — FocusOS
// ═══════════════════════════════════════════════════════════════

import type { FocusStateLabel, FocusStateLabelDisplay } from "@/types/session.types";

// ── Score Thresholds ──────────────────────────────────────────

export const FOCUS_SCORE_THRESHOLDS = {
  DEEP_FOCUS: { min: 90, max: 100 },
  FOCUSED: { min: 75, max: 89 },
  AVERAGE: { min: 60, max: 74 },
  DISTRACTED: { min: 40, max: 59 },
  HIGHLY_DISTRACTED: { min: 0, max: 39 },
} as const;

// ── Score to State Mapping ────────────────────────────────────

export const FOCUS_STATE_LABELS: Record<FocusStateLabel, FocusStateLabelDisplay> = {
  "deep-focus": "Deep Focus",
  focused: "Focused",
  average: "Average",
  distracted: "Distracted",
  "highly-distracted": "Highly Distracted",
};

export const FOCUS_STATE_COLORS: Record<FocusStateLabel, string> = {
  "deep-focus": "#22c55e",
  focused: "#84cc16",
  average: "#eab308",
  distracted: "#f97316",
  "highly-distracted": "#ef4444",
};

export const FOCUS_STATE_GLOW: Record<FocusStateLabel, string> = {
  "deep-focus": "0 0 24px rgba(34, 197, 94, 0.4)",
  focused: "0 0 24px rgba(132, 204, 22, 0.4)",
  average: "0 0 24px rgba(234, 179, 8, 0.4)",
  distracted: "0 0 24px rgba(249, 115, 22, 0.4)",
  "highly-distracted": "0 0 24px rgba(239, 68, 68, 0.4)",
};

// ── Score Formula Weights ─────────────────────────────────────

export const SCORE_WEIGHTS = {
  CONTENT_RELEVANCE: 0.4,  // 40%
  FOCUS_CONTINUITY: 0.3,   // 30%
  TAB_STABILITY: 0.15,     // 15%
  DISTRACTION_PENALTY: 0.15, // 15%
} as const;

// ── Score Classification Helper ───────────────────────────────

export function getScoreState(score: number): FocusStateLabel {
  if (score >= 90) return "deep-focus";
  if (score >= 75) return "focused";
  if (score >= 60) return "average";
  if (score >= 40) return "distracted";
  return "highly-distracted";
}

export function getScoreColor(score: number): string {
  return FOCUS_STATE_COLORS[getScoreState(score)];
}

export function getScoreLabel(score: number): FocusStateLabelDisplay {
  return FOCUS_STATE_LABELS[getScoreState(score)];
}

// ── Realtime Update Interval ──────────────────────────────────

export const REALTIME_SCORE_INTERVAL_MS = 45_000; // 45 seconds (between 30–60s per spec)

// ── Minimum Sessions for Pattern Detection ────────────────────

export const MIN_SESSIONS_FOR_PATTERNS = 5;
export const MIN_SESSIONS_FOR_SMART_PRESET = 5;
export const MIN_SESSIONS_FOR_HEATMAP = 5;
export const MIN_WEEKS_FOR_DEEP_WORK_SUGGESTION = 2;
