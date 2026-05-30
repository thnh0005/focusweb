"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface FocusStatisticsProps {
  /** Session elapsed time in seconds */
  elapsedSeconds: number;
  /** Total target duration in seconds */
  targetSeconds: number;
  /** Number of tab switches during session */
  tabSwitchCount?: number;
  /** Number of distraction warnings triggered */
  warningCount?: number;
  className?: string;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface StatItemProps {
  label: string;
  value: string;
  subtext?: string;
  colorClass?: string;
  index?: number;
}

function StatItem({ label, value, subtext, colorClass, index = 0 }: StatItemProps) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      className="flex flex-col gap-1"
      initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.1 + index * 0.07,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-muted">
        {label}
      </span>
      <span className={cn("text-lg font-light tabular-nums leading-none", colorClass ?? "text-text-secondary")}>
        {value}
      </span>
      {subtext && (
        <span className="text-[9px] text-text-muted/60 font-light">{subtext}</span>
      )}
    </motion.div>
  );
}

export function FocusStatistics({
  elapsedSeconds,
  targetSeconds,
  tabSwitchCount = 0,
  warningCount = 0,
  className,
}: FocusStatisticsProps) {
  const completionPercent =
    targetSeconds > 0
      ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
      : 0;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-8 md:gap-12",
        className
      )}
      role="group"
      aria-label="Session statistics"
    >
      <StatItem
        index={0}
        label="Elapsed"
        value={formatElapsed(elapsedSeconds)}
        subtext={`${completionPercent}% complete`}
        colorClass="text-text-secondary"
      />

      <div className="h-6 w-px bg-white/8" aria-hidden="true" />

      <StatItem
        index={1}
        label="Tab Switches"
        value={String(tabSwitchCount)}
        subtext={tabSwitchCount === 0 ? "Clean session" : "interruptions"}
        colorClass={tabSwitchCount > 5 ? "text-urgency-amber" : "text-text-secondary"}
      />

      <div className="h-6 w-px bg-white/8" aria-hidden="true" />

      <StatItem
        index={2}
        label="Warnings"
        value={String(warningCount)}
        subtext={warningCount === 0 ? "No distractions" : "distraction alerts"}
        colorClass={warningCount > 0 ? "text-urgency-coral/80" : "text-text-secondary"}
      />
    </div>
  );
}
