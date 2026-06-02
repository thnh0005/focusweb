"use client";

import * as React from "react";
import { Calendar, Clock, History, X } from "lucide-react";
import { GlassPanel } from "@/components/ambient";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import type { Session } from "@/types/session.types";

export interface RecentSessionsPanelProps {
  sessions?: Session[] | null;
  isLoading?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
  className?: string;
}

export function RecentSessionsPanel({
  sessions,
  isLoading = false,
  isOpen,
  onClose,
  onStart,
  className,
}: RecentSessionsPanelProps) {
  const recentSessions = sessions ?? [];

  return (
    <aside
      aria-label="Recent sessions"
      className={cn(
        "fixed inset-x-3 bottom-24 z-20 transition-all duration-200 md:left-auto md:right-6 md:top-24 md:bottom-auto md:w-[420px]",
        isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        className
      )}
    >
      <GlassPanel variant="strong" className="max-h-[70dvh] overflow-hidden p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-text-muted">Recent sessions</p>
            <h2 className="mt-1 text-xl font-light text-text-primary">Your latest focus blocks</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-text-secondary transition-colors hover:text-text-primary focus-ring-soft"
            aria-label="Close recent sessions panel"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 rounded-2xl bg-white/[0.055] skeleton" />
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
            <History className="mx-auto h-6 w-6 text-focus-green" aria-hidden="true" />
            <h3 className="mt-3 text-lg font-light text-text-primary">Your focus space is ready</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Finish your first session and it will appear here.
            </p>
            <Button onClick={onStart} className="mt-4 rounded-2xl">
              Start your first focus session
            </Button>
          </div>
        ) : (
          <div className="max-h-[48dvh] space-y-3 overflow-y-auto pr-1">
            {recentSessions.slice(0, 5).map((session) => {
              const minutes = Math.round(session.actualDurationSeconds / 60);
              const title =
                session.goal || (session.mode === "deep-work" ? "Deep Work Block" : "Focus Block");

              return (
                <article
                  key={session.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-text-primary">{title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {formatDate(session.startedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {minutes} min
                        </span>
                      </div>
                    </div>
                    {session.focusScore !== null && (
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-text-secondary">
                        {session.focusScore}%
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </aside>
  );
}
