"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { SessionMode } from "@/types/session.types";

export interface CenterFocusClockProps {
  displayName: string;
  durationMinutes: number;
  mode: SessionMode;
  onStart: () => void;
  onDurationChange: (minutes: number) => void;
  onModeChange: (mode: SessionMode) => void;
  isStarting?: boolean;
  startError?: string | null;
  className?: string;
}

export function CenterFocusClock({
  displayName,
  durationMinutes,
  mode,
  onStart,
  onDurationChange,
  onModeChange,
  isStarting = false,
  startError,
  className,
}: CenterFocusClockProps) {
  const { t } = useTranslation("dashboard");
  const greeting = getGreeting(t);
  const startLabel =
    mode === "deep-work" ? t("focusHome.clock.startDeepWork") : t("focusHome.clock.startFocus");

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <p className="text-balance text-2xl font-light text-text-primary/90 sm:text-4xl">
        {greeting}, {displayName}
      </p>
      <div
        className="mt-4 font-display tabular-nums leading-none text-text-primary drop-shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
        style={{
          fontSize: "clamp(5rem, 13vw, 12rem)",
          fontWeight: 300,
          letterSpacing: "0",
        }}
        aria-label={t("focusHome.clock.timerAria", { count: durationMinutes })}
      >
        {String(durationMinutes).padStart(2, "0")}:00
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {[25, 50, 90].map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => onDurationChange(minutes)}
            disabled={isStarting}
            aria-pressed={durationMinutes === minutes}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              durationMinutes === minutes
                ? "bg-white/[0.16] text-text-primary shadow-[0_10px_40px_rgba(0,0,0,0.22)]"
                : "bg-white/[0.055] text-text-secondary hover:bg-white/[0.09] hover:text-text-primary",
              isStarting && "cursor-not-allowed opacity-50"
            )}
          >
            {t("focusHome.clock.duration", { count: minutes })}
          </button>
        ))}
      </div>

      <div className="mt-3 flex rounded-full border border-white/10 bg-white/[0.055] p-1 backdrop-blur-md">
        {[
          { id: "normal" as const, label: t("focusHome.clock.normal") },
          { id: "deep-work" as const, label: t("focusHome.clock.deepWork") },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onModeChange(option.id)}
            disabled={isStarting}
            aria-pressed={mode === option.id}
            className={cn(
              "rounded-full px-4 py-2 text-xs transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === option.id
                ? "bg-white/[0.16] text-text-primary"
                : "text-text-muted hover:text-text-primary",
              isStarting && "cursor-not-allowed opacity-50"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Button
        type="button"
        variant="session"
        onClick={onStart}
        disabled={isStarting}
        aria-busy={isStarting}
        className="mt-7 h-[52px] rounded-full px-8 text-base shadow-[0_20px_70px_rgba(0,0,0,0.36)]"
      >
        <Play className="mr-2 h-4 w-4 fill-current stroke-[1.6]" aria-hidden="true" />
        {isStarting ? t("focusHome.clock.starting") : startLabel}
      </Button>
      {startError && (
        <p role="alert" className="mt-4 max-w-md text-sm text-urgency-coral">
          {startError}
        </p>
      )}
    </div>
  );
}

function getGreeting(t: (key: string) => string) {
  const hour = new Date().getHours();
  if (hour < 12) return t("focusHome.clock.greeting.morning");
  if (hour < 18) return t("focusHome.clock.greeting.afternoon");
  return t("focusHome.clock.greeting.evening");
}
