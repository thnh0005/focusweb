"use client";

import * as React from "react";
import { Activity, Clock, Flame, Target, X } from "lucide-react";
import { GlassPanel } from "@/components/ambient";
import { cn } from "@/lib/utils/cn";
import type { DashboardStats } from "@/types/analytics.types";

export interface MiniStatsDrawerProps {
  stats?: DashboardStats | null;
  streakCount?: number;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function MiniStatsDrawer({
  stats,
  streakCount = 0,
  isOpen,
  onClose,
  className,
}: MiniStatsDrawerProps) {
  const totalMinutes = stats?.totalFocusMinutes ?? 0;
  const durationLabel =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
      : `${totalMinutes}m`;

  const items = [
    { label: "Today", value: durationLabel, detail: "focus time", icon: Clock },
    { label: "Sessions", value: String(stats?.totalSessions ?? 0), detail: `${stats?.deepWorkSessionCount ?? 0} deep work`, icon: Activity },
    { label: "Score", value: stats?.averageFocusScore ? `${Math.round(stats.averageFocusScore)}%` : "N/A", detail: "average focus", icon: Target },
    { label: "Streak", value: `${streakCount}d`, detail: streakCount > 0 ? "active" : "not started", icon: Flame },
  ];

  return (
    <aside
      aria-label="Focus stats"
      className={cn(
        "fixed inset-x-3 bottom-24 z-20 transition-all duration-200 md:left-auto md:right-6 md:top-24 md:bottom-auto md:w-[360px]",
        isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        className
      )}
    >
      <GlassPanel variant="strong" className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-text-muted">Focus stats</p>
            <h2 className="mt-1 text-xl font-light text-text-primary">Light signals for today</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-text-secondary transition-colors hover:text-text-primary focus-ring-soft"
            aria-label="Close stats panel"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <Icon className="h-4 w-4 text-focus-green" aria-hidden="true" />
                <p className="mt-3 text-2xl font-light text-text-primary">{item.value}</p>
                <p className="mt-1 text-xs text-text-muted">{item.label} {item.detail}</p>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </aside>
  );
}
