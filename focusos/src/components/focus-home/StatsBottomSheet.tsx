"use client";

import * as React from "react";
import { BarChart3, Clock, Flame, GripHorizontal, Target, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDraggablePopup } from "@/hooks";
import { cn } from "@/lib/utils/cn";
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
  const { t } = useTranslation("dashboard");
  const { popupRef, dragHandleProps, dragStyle, isDragging } =
    useDraggablePopup<HTMLElement>();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
      <section
        ref={popupRef}
        id="dashboard-stats-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("focusHome.statsSheet.aria")}
        className={cn(
          "w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[rgb(10_13_10/0.76)] p-5 shadow-[0_-20px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl",
          isDragging && "cursor-grabbing"
        )}
        style={dragStyle}
      >
        <SheetHeader title={t("focusHome.statsSheet.title")} onClose={onClose} dragHandleProps={dragHandleProps} />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatItem icon={BarChart3} label={t("focusHome.statsSheet.focus")} value={`${stats?.totalFocusMinutes ?? 0}m`} />
          <StatItem
            icon={Target}
            label={t("focusHome.statsSheet.score")}
            value={stats?.averageFocusScore ? `${Math.round(stats.averageFocusScore)}%` : t("focusHome.statsSheet.resting")}
          />
          <StatItem icon={Flame} label={t("focusHome.statsSheet.streak")} value={`${streakCount}d`} />
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            {t("focusHome.statsSheet.recentRhythm")}
          </p>
          <div className="mt-3 space-y-2">
            {recentSessions.length > 0 ? (
              recentSessions.slice(0, 3).map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.045] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">
                      {session.goal || (session.mode === "deep-work" ? t("focusHome.statsSheet.deepWorkGoal") : t("focusHome.statsSheet.normalGoal"))}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {session.mode === "deep-work" ? t("focusHome.statsSheet.deepWork") : t("focusHome.statsSheet.focusSession")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {Math.round(session.actualDurationSeconds / 60)}m
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-white/[0.045] px-3 py-3 text-sm text-text-muted">
                {t("focusHome.statsSheet.empty")}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

type SheetIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function SheetHeader({
  title,
  onClose,
  dragHandleProps,
}: {
  title: string;
  onClose: () => void;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="flex items-center justify-between gap-3">
      <div
        {...dragHandleProps}
        className="flex min-w-0 flex-1 touch-none cursor-grab items-center gap-2 active:cursor-grabbing"
        title={t("focusHome.popover.drag")}
      >
        <GripHorizontal className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
        <h2 className="text-lg font-light text-text-primary">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("focusHome.statsSheet.close")}
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
