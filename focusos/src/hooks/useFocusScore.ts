"use client";

import type { FocusStateLabel, FocusStateLabelDisplay } from "@/types/session.types";

export interface FocusScoreMetrics {
  score: number;
  label: FocusStateLabel;
  displayLabel: FocusStateLabelDisplay;
  colorClass: string;
  glowColor: string; // CSS custom variable/values for drop-shadows
  microcopy: string;
}

export function useFocusScore(score: number | null): FocusScoreMetrics {
  const currentScore = score ?? 100;

  if (currentScore >= 85) {
    return {
      score: currentScore,
      label: "deep-focus",
      displayLabel: "Deep Focus",
      colorClass: "text-focus-purple",
      glowColor: "rgba(124, 58, 237, 0.35)", // Deep violet glow
      microcopy: "Superb focus. You're fully locked in the zone.",
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
    };
  }

  return {
    score: currentScore,
    label: "highly-distracted",
    displayLabel: "Highly Distracted",
    colorClass: "text-red-500",
    glowColor: "rgba(239, 68, 68, 0.5)", // Red alert warning glow
    microcopy: "Severe disruption. Take a deep breath and reset.",
  };
}
