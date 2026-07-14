"use client";

import * as React from "react";
import { AlertCircle, Calendar, CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFocusScore } from "@/hooks/useFocusScore";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import type { Session } from "@/types/session.types";

export interface RecentActivityProps {
  sessions?: Session[] | null;
  isLoading?: boolean;
}

export function RecentActivity({ sessions, isLoading = false }: RecentActivityProps) {
  const { t } = useTranslation("dashboard");
  const recentSessions = sessions ?? [];

  return (
    <Card
      variant="glass-card"
      className="border border-white/[0.04] bg-surface-deep/40 backdrop-blur-md flex flex-col h-full hover:border-white/[0.06] transition-colors"
    >
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base font-light tracking-wide text-text-primary">
          {t("recentActivity.title")}
        </CardTitle>
        <CardDescription className="text-text-muted text-xs font-light">
          {t("recentActivity.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3" aria-live="polite" aria-busy="true">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-focus-purple border-t-transparent" />
            <span className="text-xs text-text-muted font-light">{t("recentActivity.loading")}</span>
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="py-8">
            <EmptyState
              preset="stats"
              title={t("recentActivity.emptyTitle")}
              description={t("recentActivity.emptyDescription")}
              actionText={t("recentActivity.start")}
              onAction={() => {
                window.location.href = "/dashboard";
              }}
            />
          </div>
        ) : (
          <div className="space-y-3.5 divide-y divide-white/[0.03]">
            {recentSessions.slice(0, 5).map((session, idx) => (
              <RecentSessionRow key={session.id} session={session} isFirst={idx === 0} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentSessionRow({
  session,
  isFirst,
}: {
  session: Session;
  isFirst: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const minutes = Math.round(session.actualDurationSeconds / 60);
  const scoreMetrics = useFocusScore(session.focusScore);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 select-none",
        isFirst && "pt-0"
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0">
          {session.status === "completed" ? (
            <CheckCircle2 className="h-4.5 w-4.5 text-green-400 stroke-[1.5]" />
          ) : (
            <AlertCircle className="h-4.5 w-4.5 text-text-muted stroke-[1.5]" />
          )}
        </div>

        <div className="min-w-0">
          <h5 className="text-xs font-medium text-text-primary tracking-wide leading-snug truncate">
            {session.goal || (session.mode === "deep-work" ? t("recentActivity.deepWorkBlock") : t("recentActivity.normalFocusBlock"))}
          </h5>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-text-muted font-light flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(session.startedAt)}</span>
            </span>
            <span className="text-[10px] text-text-muted font-light">.</span>
            <span className="text-[10px] text-text-muted font-light flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{t("recentActivity.minutes", { count: minutes })}</span>
            </span>
          </div>

          {session.tags && session.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {session.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-mono tracking-wider font-light bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded text-text-secondary select-none"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {session.focusScore !== null && (
        <div className="shrink-0 flex items-center self-start sm:self-center">
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-medium tracking-wide uppercase select-none bg-white/[0.01]",
              scoreMetrics.colorClass,
              "border-white/[0.05]"
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: scoreMetrics.glowColor.split(",").slice(0, 3).join(",") + ", 1)" }}
            />
            <span>{session.focusScore}% {scoreMetrics.displayLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
