"use client";

import type {
  FocusStateLabelDisplay,
  LiveFocusStateLabel,
} from "@/types/session.types";

export interface FocusScoreMetrics {
  score: number | null;
  label: LiveFocusStateLabel;
  displayLabel: FocusStateLabelDisplay;
  colorClass: string;
  glowColor: string; // CSS custom variable/values for drop-shadows
  microcopy: string;
  isKnown: boolean;
}

export function useFocusScore(score: number | null): FocusScoreMetrics {
  if (score === null) {
    return {
      score: null,
      label: "unknown",
      displayLabel: "Gathering Data",
      colorClass: "text-text-muted",
      glowColor: "rgba(124, 171, 145, 0.18)",
      microcopy: "Waiting for enough real focus signals.",
      isKnown: false,
    };
  }

  const currentScore = score;

  if (currentScore >= 85) {
    return {
      score: currentScore,
      label: "deep-focus",
      displayLabel: "Deep Focus",
      colorClass: "text-focus-purple",
      glowColor: "rgba(124, 58, 237, 0.35)", // Deep violet glow
      microcopy: "Superb focus. You're fully locked in the zone.",
      isKnown: true,
    };
  }

  if (currentScore >= 70) {
    return {
      score: currentScore,
      label: "focused",
      displayLabel: "Focused",
      colorClass: "text-blue-400",
      glowColor: "rgba(96, 165, 250, 0.3)", // Soft blue glow
      microcopy: "Strong progress. Keep driving forward with flow.",
      isKnown: true,
    };
  }

  if (currentScore >= 50) {
    return {
      score: currentScore,
      label: "average",
      displayLabel: "Average",
      colorClass: "text-urgency-amber",
      glowColor: "rgba(245, 158, 11, 0.25)", // Amber glow
      microcopy: "Focus drifting. Bring your attention back to the goal.",
      isKnown: true,
    };
  }

  if (currentScore >= 30) {
    return {
      score: currentScore,
      label: "distracted",
      displayLabel: "Distracted",
      colorClass: "text-orange-500",
      glowColor: "rgba(249, 115, 22, 0.35)", // High intensity warning orange glow
      microcopy: "Distraction detected. Silence tabs to save your streak.",
      isKnown: true,
    };
  }

  return {
    score: currentScore,
    label: "highly-distracted",
    displayLabel: "Highly Distracted",
    colorClass: "text-red-500",
    glowColor: "rgba(239, 68, 68, 0.5)", // Red alert warning glow
    microcopy: "Severe disruption. Take a deep breath and reset.",
    isKnown: true,
  };
}
