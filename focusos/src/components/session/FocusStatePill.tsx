"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FocusScoreMetrics } from "@/hooks/useFocusScore";

export interface FocusStatePillProps {
  metrics: FocusScoreMetrics;
  isActive: boolean;
  className?: string;
}

export function FocusStatePill({
  metrics,
  isActive,
  className,
}: FocusStatePillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-text-primary backdrop-blur-md",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={
        metrics.score === null
          ? `Focus state ${metrics.displayLabel}`
          : `Focus state ${metrics.displayLabel}, score ${metrics.score} out of 100`
      }
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.045]",
          metrics.colorClass
        )}
        aria-hidden="true"
      >
        <Activity className="h-4 w-4 stroke-[1.6]" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-medium text-text-primary">
          {metrics.displayLabel}
        </span>
        <span className="mt-1 text-[11px] font-mono text-text-muted">
          {metrics.score === null
            ? isActive
              ? "waiting for signals"
              : "paused"
            : `${metrics.score}/100 ${isActive ? "live" : "paused"}`}
        </span>
      </span>
    </div>
  );
}
