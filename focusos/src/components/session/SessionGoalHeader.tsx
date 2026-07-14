"use client";

import * as React from "react";
import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("focus");
  const modeLabel = mode === "deep-work" ? t("deepWorkMode") : t("normalMode");

  return (
    <header className={cn("mx-auto flex max-w-3xl flex-col items-center text-center", className)}>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-mono text-text-muted backdrop-blur-md">
        <Target className="h-3.5 w-3.5 stroke-[1.6]" aria-hidden="true" />
        <span>{modeLabel}</span>
        <span aria-hidden="true">/</span>
        <span>{t("active.minutes", { count: durationMinutes })}</span>
      </div>
      <p className="text-sm text-text-muted">{t("active.todayFocus")}</p>
      <h1 className="mt-2 max-w-[34rem] text-balance text-2xl font-light leading-tight text-text-primary md:text-4xl">
        {goal?.trim() || t("active.fallbackGoal")}
      </h1>
    </header>
  );
}
