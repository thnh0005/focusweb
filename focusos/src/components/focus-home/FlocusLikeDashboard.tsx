"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AmbientWorkspaceBackground } from "./AmbientWorkspaceBackground";
import { AiDocumentsWidget } from "./AiDocumentsWidget";
import { CenterFocusClock } from "./CenterFocusClock";
import { CompactSoundscapeWidget } from "./CompactSoundscapeWidget";
import { FloatingFocusDock, type FlocusDockPanel } from "./FloatingFocusDock";
import { StatsBottomSheet } from "./StatsBottomSheet";
import { ThemeControlWidget } from "./ThemeControlWidget";
import type { DashboardStats } from "@/types/analytics.types";
import type { Session, SessionMode } from "@/types/session.types";

export interface FlocusLikeDashboardProps {
  displayName: string;
  durationMinutes: number;
  mode: SessionMode;
  stats?: DashboardStats | null;
  statsError?: boolean;
  streakCount: number;
  recentSessions: Session[];
  onDurationChange: (minutes: number) => void;
  onModeChange: (mode: SessionMode) => void;
  onStart: () => void;
  onRetryStats?: () => void;
  isStarting?: boolean;
  startError?: string | null;
}

export function FlocusLikeDashboard({
  displayName,
  durationMinutes,
  mode,
  stats,
  statsError = false,
  streakCount,
  recentSessions,
  onDurationChange,
  onModeChange,
  onStart,
  onRetryStats,
  isStarting = false,
  startError,
}: FlocusLikeDashboardProps) {
  const { t } = useTranslation("dashboard");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activePanel, setActivePanel] = React.useState<FlocusDockPanel>(null);

  const handlePanelChange = React.useCallback(
    (panel: FlocusDockPanel) => {
      setActivePanel(panel);

      const nextParams = new URLSearchParams(searchParams.toString());
      if (panel) {
        nextParams.set("panel", panel);
      } else {
        nextParams.delete("panel");
      }

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  React.useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      const requestedPanel = searchParams.get("panel");
      if (
        requestedPanel === "sounds" ||
        requestedPanel === "theme" ||
        requestedPanel === "docs" ||
        requestedPanel === "stats"
      ) {
        setActivePanel(requestedPanel);
        return;
      }
      setActivePanel(null);
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [pathname, searchParams]);

  return (
    <AmbientWorkspaceBackground>
      <p className="fixed left-1/2 top-5 z-20 hidden -translate-x-1/2 rounded-full bg-black/10 px-4 py-2 text-center text-xs font-light text-text-secondary backdrop-blur-md sm:block">
        {t("focusHome.motto")}
      </p>

      <div className="fixed right-4 top-4 z-30 flex items-center gap-2">
        {statsError && (
          <button
            type="button"
            onClick={onRetryStats}
            className="hidden rounded-full border border-white/10 bg-black/15 px-3 py-2 text-xs text-text-muted backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            {t("errors.statsResting")}
          </button>
        )}
        <Link
          href="/settings/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/15 text-text-secondary backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("focusHome.profile")}
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
          isStarting={isStarting}
          startError={startError}
        />
      </main>

      <CompactSoundscapeWidget
        isOpen={activePanel === "sounds"}
        onClose={() => handlePanelChange(null)}
      />
      <ThemeControlWidget
        isOpen={activePanel === "theme"}
        onClose={() => handlePanelChange(null)}
      />
      <AiDocumentsWidget
        isOpen={activePanel === "docs"}
        onClose={() => handlePanelChange(null)}
      />
      <StatsBottomSheet
        stats={stats}
        streakCount={streakCount}
        recentSessions={recentSessions}
        isOpen={activePanel === "stats"}
        onClose={() => handlePanelChange(null)}
      />
      <FloatingFocusDock activePanel={activePanel} onPanelChange={handlePanelChange} />
    </AmbientWorkspaceBackground>
  );
}
