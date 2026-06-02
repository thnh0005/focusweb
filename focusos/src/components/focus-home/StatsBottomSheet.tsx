"use client";

import * as React from "react";
import { BarChart3, Clock, Flame, Target, X } from "lucide-react";
import type { DashboardStats } from "@/types/analytics.types";
import type { Session } from "@/types/session.types";

export interface StatsBottomSheetProps {
  stats?: DashboardStats | null;
  streakCount: number;
  recentSessions?: Session[];
  isOpen: boolean;
  onClose: () => void;
}

export function StatsBottomSheet({
  stats,
  streakCount,
  recentSessions = [],
  isOpen,
  onClose,
}: StatsBottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Focus stats"
        className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[rgb(10_13_10/0.76)] p-5 shadow-[0_-20px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl"
      >
        <SheetHeader title="Gentle stats" onClose={onClose} />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatItem icon={BarChart3} label="Focus" value={`${stats?.totalFocusMinutes ?? 0}m`} />
          <StatItem icon={Target} label="Score" value={stats?.averageFocusScore ? `${Math.round(stats.averageFocusScore)}%` : "Resting"} />
          <StatItem icon={Flame} label="Streak" value={`${streakCount}d`} />
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Recent rhythm</p>
          <div className="mt-3 space-y-2">
            {recentSessions.length > 0 ? (
              recentSessions.slice(0, 3).map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.045] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">
                      {session.goal || (session.mode === "deep-work" ? "Deep work" : "Focus session")}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">{session.mode === "deep-work" ? "Deep Work" : "Focus"}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {Math.round(session.actualDurationSeconds / 60)}m
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-white/[0.045] px-3 py-3 text-sm text-text-muted">
                Start a session to build history.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

type SheetIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-light text-text-primary">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close"
      >
        <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
      </button>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: SheetIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-white/[0.055] p-4">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <p className="mt-4 text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-light tabular-nums text-text-primary">{value}</p>
    </div>
  );
}
