"use client";

import * as React from "react";
import Link from "next/link";
import { Settings, UserRound } from "lucide-react";
import { AmbientWorkspaceBackground } from "./AmbientWorkspaceBackground";
import { CenterFocusClock } from "./CenterFocusClock";
import { CompactSoundscapeWidget } from "./CompactSoundscapeWidget";
import { FloatingFocusDock, type FlocusDockPanel } from "./FloatingFocusDock";
import { PriorityFocusTask } from "./PriorityFocusTask";
import { StatsBottomSheet } from "./StatsBottomSheet";
import type { DashboardStats } from "@/types/analytics.types";
import type { Session, SessionMode } from "@/types/session.types";

export interface FlocusLikeDashboardProps {
  displayName: string;
  goal: string;
  lastGoal?: string | null;
  durationMinutes: number;
  mode: SessionMode;
  stats?: DashboardStats | null;
  statsError?: boolean;
  streakCount: number;
  recentSessions: Session[];
  onGoalChange: (value: string) => void;
  onDurationChange: (minutes: number) => void;
  onModeChange: (mode: SessionMode) => void;
  onStart: () => void;
  onRetryStats?: () => void;
}

export function FlocusLikeDashboard({
  displayName,
  goal,
  lastGoal,
  durationMinutes,
  mode,
  stats,
  statsError = false,
  streakCount,
  recentSessions,
  onGoalChange,
  onDurationChange,
  onModeChange,
  onStart,
  onRetryStats,
}: FlocusLikeDashboardProps) {
  const [activePanel, setActivePanel] = React.useState<FlocusDockPanel>(null);

  return (
    <AmbientWorkspaceBackground>
      <p className="fixed left-1/2 top-5 z-20 hidden -translate-x-1/2 rounded-full bg-black/10 px-4 py-2 text-center text-xs font-light text-text-secondary backdrop-blur-md sm:block">
        Protect one thing at a time.
      </p>

      <div className="fixed right-4 top-4 z-30 flex items-center gap-2">
        {statsError && (
          <button
            type="button"
            onClick={onRetryStats}
            className="hidden rounded-full border border-white/10 bg-black/15 px-3 py-2 text-xs text-text-muted backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            Stats are resting for now
          </button>
        )}
        <Link
          href="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/15 text-text-secondary backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
        </Link>
        <Link
          href="/settings/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/15 text-text-secondary backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open profile"
        >
          <UserRound className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
        </Link>
      </div>

      <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 pb-32 pt-20">
        <CenterFocusClock
          displayName={displayName}
          durationMinutes={durationMinutes}
          mode={mode}
          onStart={onStart}
          onDurationChange={onDurationChange}
          onModeChange={onModeChange}
        />
        <PriorityFocusTask goal={goal} lastGoal={lastGoal} onGoalChange={onGoalChange} />
      </main>

      <CompactSoundscapeWidget
        isOpen={activePanel === "sounds"}
        onClose={() => setActivePanel(null)}
      />
      <StatsBottomSheet
        stats={stats}
        streakCount={streakCount}
        recentSessions={recentSessions}
        isOpen={activePanel === "stats"}
        onClose={() => setActivePanel(null)}
      />
      <FloatingFocusDock activePanel={activePanel} onPanelChange={setActivePanel} onFocus={onStart} />
    </AmbientWorkspaceBackground>
  );
}
