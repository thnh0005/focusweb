"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { getScoreColor, getScoreLabel } from "@/constants/focus-score";

export interface FocusScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showScore?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function FocusScoreGauge({
  score,
  size = 120,
  strokeWidth = 6,
  showScore = true,
  showLabel = true,
  className,
}: FocusScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedScore / 100);
  const label = getScoreLabel(clampedScore);
  const color = getScoreColor(clampedScore);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      role="img"
      aria-label={`Focus score ${clampedScore} out of 100, ${label}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            transition: "stroke-dashoffset 1.2s ease, stroke 200ms ease",
          }}
        />
      </svg>

      {(showScore || showLabel) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          aria-hidden="true"
        >
          {showScore && (
            <span
              className="text-[length:var(--size-score)] font-light leading-none tracking-[-0.03em] text-text-primary"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(clampedScore)}%
            </span>
          )}
          {showLabel && (
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-text-muted">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
