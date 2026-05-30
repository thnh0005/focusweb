// ═══════════════════════════════════════════════════════════════
// Focus Score Calculator — FocusOS (Client-side)
// Formula: 40% Content Relevance + 30% Focus Continuity
//        + 15% Tab Stability + 15% Distraction Penalty
// ═══════════════════════════════════════════════════════════════

import type { FocusScoreBreakdown } from "@/types/session.types";
import { SCORE_WEIGHTS } from "@/constants/focus-score";

// ── Raw session signals (from extension) ─────────────────────

export interface SessionSignals {
  // Content relevance (0–100): from AI semantic analysis
  contentRelevanceScore: number;

  // Tab switches: count of tab switches this session
  tabSwitchCount: number;
  sessionDurationSeconds: number;

  // Focus continuity: percentage of time on relevant content
  relevantTimeSeconds: number;
  totalActiveSeconds: number;

  // Distraction events: number of warnings triggered
  warningCount: number;
  autoPauseCount: number;
}

/**
 * Calculate the four component scores from raw signals.
 * Each component returns a 0–100 score.
 */
export function calculateScoreBreakdown(
  signals: SessionSignals
): FocusScoreBreakdown {
  // ── Component 1: Content Relevance (0–100) ───────────────
  // Directly from AI semantic scoring
  const contentRelevance = Math.max(0, Math.min(100, signals.contentRelevanceScore));

  // ── Component 2: Focus Continuity (0–100) ────────────────
  // Ratio of time on relevant content vs total active time
  const focusContinuity =
    signals.totalActiveSeconds > 0
      ? Math.min(
          100,
          (signals.relevantTimeSeconds / signals.totalActiveSeconds) * 100
        )
      : 50; // Default for short/new sessions

  // ── Component 3: Tab Stability (0–100) ───────────────────
  // Penalize high tab switching frequency
  // Target: ≤ 1 switch per 5 minutes = stable
  const switchesPerMinute =
    signals.sessionDurationSeconds > 0
      ? (signals.tabSwitchCount / signals.sessionDurationSeconds) * 60
      : 0;
  const tabStability = Math.max(0, 100 - switchesPerMinute * 15);

  // ── Component 4: Distraction Penalty (0–100) ─────────────
  // Penalty based on warning and auto-pause counts
  // Each warning: -10 pts, Each auto-pause: -25 pts
  const penalty = Math.min(
    100,
    signals.warningCount * 10 + signals.autoPauseCount * 25
  );
  const distractionPenalty = Math.max(0, 100 - penalty);

  // ── Final Score ────────────────────────────────────────────
  const total = Math.round(
    contentRelevance * SCORE_WEIGHTS.CONTENT_RELEVANCE +
      focusContinuity * SCORE_WEIGHTS.FOCUS_CONTINUITY +
      Math.min(100, tabStability) * SCORE_WEIGHTS.TAB_STABILITY +
      distractionPenalty * SCORE_WEIGHTS.DISTRACTION_PENALTY
  );

  return {
    contentRelevance: Math.round(contentRelevance),
    focusContinuity: Math.round(focusContinuity),
    tabStability: Math.round(Math.min(100, tabStability)),
    distractionPenalty: Math.round(distractionPenalty),
    total: Math.max(0, Math.min(100, total)),
  };
}

/**
 * Calculate a simplified real-time score estimate
 * Used for the live display during active sessions
 */
export function calculateRealtimeScore(signals: Partial<SessionSignals>): number {
  const contentRelevance = signals.contentRelevanceScore ?? 70;
  const tabPenalty = (signals.tabSwitchCount ?? 0) * 5;
  const warnPenalty = (signals.warningCount ?? 0) * 10;

  const score = Math.max(
    0,
    Math.min(100, contentRelevance - tabPenalty - warnPenalty)
  );
  return Math.round(score);
}
