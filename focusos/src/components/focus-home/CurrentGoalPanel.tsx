"use client";

import * as React from "react";
import { RotateCcw, Target } from "lucide-react";
import { GlassPanel } from "@/components/ambient";

export interface CurrentGoalPanelProps {
  goal: string;
  onGoalChange: (goal: string) => void;
  lastGoal?: string | null;
  className?: string;
}

export function CurrentGoalPanel({
  goal,
  onGoalChange,
  lastGoal,
  className,
}: CurrentGoalPanelProps) {
  const hasLastGoal = Boolean(lastGoal);

  return (
    <GlassPanel variant="subtle" className={className}>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Target className="h-4 w-4 text-focus-green" aria-hidden="true" />
              Current goal
            </div>
            <h2 className="text-xl font-light text-text-primary">
              Choose one thing to protect.
            </h2>
          </div>

          {hasLastGoal && (
            <button
              type="button"
              onClick={() => onGoalChange(lastGoal ?? "")}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-text-secondary transition-colors hover:text-text-primary focus-ring-soft"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Continue last
            </button>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="focus-home-goal" className="text-xs text-text-muted">
            Focus goal
          </label>
          <textarea
            id="focus-home-goal"
            value={goal}
            onChange={(event) => onGoalChange(event.target.value)}
            placeholder={hasLastGoal ? lastGoal ?? undefined : "Your focus space is ready. Name the work you want to begin."}
            rows={3}
            className="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-text-primary placeholder:text-text-muted transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </GlassPanel>
  );
}
