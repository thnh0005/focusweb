"use client";

import * as React from "react";
import { Play, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { SessionMode } from "@/types/session.types";

export interface FloatingTimerProps {
  durationMinutes: number;
  mode: SessionMode;
  onStart: () => void;
  onDurationChange?: (durationMinutes: number) => void;
  className?: string;
}

const durationOptions = [25, 50, 90];

export function FloatingTimer({
  durationMinutes,
  mode,
  onStart,
  onDurationChange,
  className,
}: FloatingTimerProps) {
  const durationLabel = `${String(durationMinutes).padStart(2, "0")}:00`;
  const modeLabel = mode === "deep-work" ? "Deep Work" : "Focus";

  return (
    <section
      aria-label="Focus timer preview"
      className={cn(
        "relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-bg-void/45 px-5 py-8 text-center shadow-ambient backdrop-blur-xl sm:px-8 md:px-10",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgb(124_171_145_/_0.22),transparent_38%),linear-gradient(180deg,rgb(255_255_255_/_0.045),transparent_45%)]"
      />

      <div className="relative mx-auto max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs text-text-secondary">
          <TimerReset className="h-3.5 w-3.5 text-focus-green" aria-hidden="true" />
          {modeLabel} preview
        </div>

        <p className="mt-8 font-display text-[5.25rem] font-light leading-none text-text-primary sm:text-[7rem] md:text-[8.5rem]">
          {durationLabel}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2" aria-label="Duration presets">
          {durationOptions.map((option) => (
            <button
              key={option}
              type="button"
              disabled={!onDurationChange}
              onClick={() => onDurationChange?.(option)}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm transition-all focus-ring-soft disabled:cursor-default",
                durationMinutes === option
                  ? "border-focus-green bg-focus-green/15 text-text-primary"
                  : "border-white/10 bg-white/[0.04] text-text-secondary hover:border-white/20 hover:text-text-primary"
              )}
            >
              {option} min
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onStart}
          className="mt-8 h-14 rounded-2xl px-8 text-base shadow-glow"
        >
          <Play className="mr-2 h-4 w-4 fill-current" aria-hidden="true" />
          Start Focus
        </Button>
      </div>
    </section>
  );
}
