"use client";

import * as React from "react";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SessionMode } from "@/types/session.types";

export interface SessionGoalHeaderProps {
  goal?: string;
  mode: SessionMode;
  durationMinutes: number;
  className?: string;
}

export function SessionGoalHeader({
  goal,
  mode,
  durationMinutes,
  className,
}: SessionGoalHeaderProps) {
  const modeLabel = mode === "deep-work" ? "Deep Work" : "Focus";

  return (
    <header className={cn("mx-auto flex max-w-3xl flex-col items-center text-center", className)}>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-mono text-text-muted backdrop-blur-md">
        <Target className="h-3.5 w-3.5 stroke-[1.6]" aria-hidden="true" />
        <span>{modeLabel}</span>
        <span aria-hidden="true">/</span>
        <span>{durationMinutes} min</span>
      </div>
      <p className="text-sm text-text-muted">Today&apos;s focus</p>
      <h1 className="mt-2 max-w-[34rem] text-balance text-2xl font-light leading-tight text-text-primary md:text-4xl">
        {goal?.trim() || "Stay with the session in front of you."}
      </h1>
    </header>
  );
}
