"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface FocusTimerProps {
  /** Seconds remaining in the session */
  timeLeft: number;
  /** Total session duration in seconds */
  totalDuration: number;
  /** Progress percentage 0-100 */
  progress: number;
  /** Whether the timer is currently active */
  isActive: boolean;
  /** Whether timer is auto-paused by distraction engine */
  isAutoPaused?: boolean;
  /** Glow color for the timer backdrop */
  glowColor?: string;
  /** Color for the progress line */
  ringColor?: string;
  /** Callback when timer is double-clicked */
  onDoubleClick?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FocusTimer({
  timeLeft,
  totalDuration,
  progress,
  isActive,
  isAutoPaused = false,
  glowColor = "rgba(124, 171, 145, 0.35)",
  ringColor = "hsl(var(--accent))",
  onDoubleClick,
  className,
}: FocusTimerProps) {
  const isPaused = !isActive && !isAutoPaused;
  const displayTime = formatTime(timeLeft);
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-[42rem] select-none flex-col items-center justify-center px-2",
        className
      )}
      onDoubleClick={onDoubleClick}
      role="timer"
      aria-label={`Focus timer: ${displayTime} remaining`}
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-x-[8%] top-1/2 h-32 -translate-y-1/2 rounded-full blur-3xl transition-all duration-slow"
        style={{
          background: glowColor,
          opacity: isActive && !isAutoPaused ? 0.34 : isAutoPaused ? 0.22 : 0.14,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex w-full flex-col items-center">
        <span
          className={cn(
            "font-display tabular-nums leading-none transition-all duration-fast",
            isActive && !isAutoPaused && "animate-[timer-pulse_1s_ease-in-out_infinite]",
            isPaused && "opacity-60",
            isAutoPaused ? "text-urgency-amber" : "text-text-primary"
          )}
          style={{
            fontSize: "clamp(4.7rem, 18vw, 13rem)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 300,
            letterSpacing: "0",
          }}
          aria-hidden="true"
        >
          {displayTime}
        </span>

        {isAutoPaused && (
          <span className="mt-3 rounded-full border border-urgency-amber/30 bg-urgency-amber/10 px-3 py-1 text-[11px] font-mono text-urgency-amber">
            Auto-paused
          </span>
        )}

        {!isActive && !isAutoPaused && totalDuration > 0 && (
          <span className="mt-3 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-mono text-text-muted">
            Paused
          </span>
        )}

        <div
          className="mt-7 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/[0.08]"
          role="progressbar"
          aria-label="Session time remaining"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clampedProgress)}
        >
          <div
            className="h-full rounded-full transition-all duration-slow"
            style={{
              width: `${clampedProgress}%`,
              background: isAutoPaused ? "hsl(var(--urgency-amber))" : ringColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}
