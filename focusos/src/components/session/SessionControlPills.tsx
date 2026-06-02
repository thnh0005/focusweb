"use client";

import * as React from "react";
import { Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SessionControlPillsProps {
  isActive: boolean;
  isPaused: boolean;
  isAutoPaused: boolean;
  isLoading?: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  className?: string;
}

export function SessionControlPills({
  isActive,
  isPaused,
  isAutoPaused,
  isLoading = false,
  onPause,
  onResume,
  onEnd,
  className,
}: SessionControlPillsProps) {
  const showResume = isPaused || isAutoPaused;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-3 rounded-full border border-white/10 bg-[rgb(18_22_17/0.66)] p-2 shadow-glass backdrop-blur-glass",
        className
      )}
      aria-label="Session controls"
    >
      {showResume ? (
        <button
          type="button"
          onClick={onResume}
          disabled={isLoading}
          className="inline-flex h-12 items-center gap-2.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-all duration-fast hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Resume session"
          title="Resume session"
        >
          <Play className="h-4 w-4 fill-current stroke-[1.6]" aria-hidden="true" />
          Resume
        </button>
      ) : (
        <button
          type="button"
          onClick={onPause}
          disabled={!isActive || isLoading}
          className="inline-flex h-12 items-center gap-2.5 rounded-full bg-white/[0.08] px-6 text-sm font-medium text-text-primary transition-all duration-fast hover:bg-white/[0.12] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Pause session"
          title="Pause session"
        >
          <Pause className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          Pause
        </button>
      )}

      <button
        type="button"
        onClick={onEnd}
        disabled={isLoading}
        className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-medium text-urgency-coral transition-all duration-fast hover:bg-urgency-coral/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgency-coral/70 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="End session"
        title="End session"
      >
        <Square className="h-3.5 w-3.5 stroke-[1.6]" aria-hidden="true" />
        End
      </button>
    </div>
  );
}
