"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  /** Glow color for the ring (CSS color value) */
  glowColor?: string;
  /** Ring color for the progress arc */
  ringColor?: string;
  /** Callback when ring is double-clicked → Zen mode */
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

// SVG ring radius / circumference constants
const RING_SIZE = 280;       // viewBox size
const STROKE_WIDTH = 6;
const CENTER = RING_SIZE / 2;
const RADIUS = CENTER - STROKE_WIDTH * 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function FocusTimer({
  timeLeft,
  totalDuration,
  progress,
  isActive,
  isAutoPaused = false,
  glowColor = "rgba(124, 58, 237, 0.35)",
  ringColor = "#7C3AED",
  onDoubleClick,
  className,
}: FocusTimerProps) {
  const prefersReduced = useReducedMotion();

  // stroke-dashoffset: full circumference = empty ring, 0 = full ring
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress / 100);

  const displayTime = formatTime(timeLeft);

  return (
    <div
      className={cn("relative flex items-center justify-center select-none", className)}
      onDoubleClick={onDoubleClick}
      role="timer"
      aria-label={`Focus timer: ${displayTime} remaining`}
      aria-live="polite"
    >
      {/* Glow halo behind ring */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-slow"
        style={{
          boxShadow: `0 0 80px 20px ${glowColor}`,
          opacity: isActive && !isAutoPaused ? 0.6 : 0.2,
        }}
        aria-hidden="true"
      />

      {/* SVG Timer Ring — using stroke-dasharray/offset as per design1.md spec */}
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden="true"
        className="relative z-10"
      >
        {/* Track (background) circle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth={STROKE_WIDTH}
        />

        {/* Progress arc — rotated -90deg so it starts at 12 o'clock */}
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={prefersReduced ? strokeDashoffset : undefined}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
          }}
          animate={
            prefersReduced
              ? {}
              : { strokeDashoffset }
          }
          transition={{
            duration: 1,
            ease: [0.4, 0, 0.6, 1], // --ease-pulse
          }}
        />
      </svg>

      {/* Center time display */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-20"
        aria-hidden="true"
      >
        {/* Timer digits — Geist font, weight 300 per design1.md */}
        <span
          className={cn(
            "timer-display tabular-nums transition-all duration-fast",
            isAutoPaused
              ? "text-urgency-amber"
              : "text-text-primary"
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {displayTime}
        </span>

        {/* Auto-paused label */}
        {isAutoPaused && (
          <motion.span
            initial={prefersReduced ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-1 text-[10px] font-mono uppercase tracking-[0.22em] text-urgency-amber"
          >
            Auto-Paused
          </motion.span>
        )}

        {/* Paused label */}
        {!isActive && !isAutoPaused && totalDuration > 0 && (
          <motion.span
            initial={prefersReduced ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-1 text-[10px] font-mono uppercase tracking-[0.22em] text-text-muted"
          >
            Paused
          </motion.span>
        )}
      </div>
    </div>
  );
}
