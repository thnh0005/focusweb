"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AmbientWorkspaceBackground, DeepWorkModal, FlocusLikeDashboard } from "@/components/focus-home";
import { Spinner } from "@/components/ui/Spinner";
import { analyticsApi } from "@/services/analytics.api";
import { sessionsApi } from "@/services/sessions.api";
import { useAuthStore } from "@/stores/auth.store";
import { useSessionStore } from "@/stores/session.store";
import { useUserStore } from "@/stores/user.store";
import { requestFocusFullscreen } from "@/lib/utils/fullscreen";
import type { SessionMode } from "@/types/session.types";

function FocusHomeSkeleton() {
  const { t } = useTranslation("dashboard");

  return (
    <AmbientWorkspaceBackground>
      <div
        className="flex min-h-[100dvh] items-center justify-center px-6 text-center"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-7 w-7 text-focus-green" />
          <p className="text-sm text-text-muted">{t("loading.focusRoom")}</p>
        </div>
      </div>
    </AmbientWorkspaceBackground>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const { user } = useAuthStore();
  const { startSession } = useSessionStore();
  const { streak, fetchProfile } = useUserStore();
  const [durationMinutes, setDurationMinutes] = React.useState(25);
  const [mode, setMode] = React.useState<SessionMode>("normal");
  const [deepWorkModalOpen, setDeepWorkModalOpen] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);
  const startInFlightRef = React.useRef(false);

  React.useEffect(() => {
    fetchProfile().catch((err) => console.warn("Failed to load user profile on dashboard:", err));
  }, [fetchProfile]);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => analyticsApi.getDashboardStats("7d"),
    staleTime: 30 * 1000,
  });

  const {
    data: sessionsData,
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ["recent-sessions"],
    queryFn: () => sessionsApi.getSessions({ page: 1, limit: 5 }),
    staleTime: 30 * 1000,
  });

  const recentSessions = sessionsData?.results ?? [];
  const lastSession = recentSessions[0];
  const lastGoal =
    lastSession?.goal ||
    (lastSession?.mode === "deep-work" ? t("focusHome.statsSheet.deepWorkGoal") : null);

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "Hieu";
  const isLoading = statsLoading && sessionsLoading;

  const getErrorMessage = React.useCallback(
    (err: unknown) => {
      return err instanceof Error ? err.message : t("errors.startSession");
    },
    [t]
  );

  const startFocusSession = React.useCallback(
    async (config: { mode: SessionMode; goal?: string }) => {
      if (startInFlightRef.current) return false;

      startInFlightRef.current = true;
      setIsStarting(true);
      setStartError(null);

      try {
        void requestFocusFullscreen();
        await startSession({
          mode: config.mode,
          durationMinutes,
          goal: config.goal,
          tags: [],
        });
        router.push("/session/active");
        return true;
      } catch (err) {
        setStartError(getErrorMessage(err));
        throw err;
      } finally {
        startInFlightRef.current = false;
        setIsStarting(false);
      }
    },
    [durationMinutes, getErrorMessage, router, startSession]
  );

  const handleStart = React.useCallback(() => {
    setStartError(null);

    if (mode === "normal") {
      void startFocusSession({ mode: "normal" }).catch(() => undefined);
      return;
    }

    if (mode === "deep-work") {
      setDeepWorkModalOpen(true);
    }
  }, [mode, startFocusSession]);

  const handleModeChange = React.useCallback((nextMode: SessionMode) => {
    setMode(nextMode);
    setStartError(null);
    if (nextMode !== "deep-work") {
      setDeepWorkModalOpen(false);
    }
  }, []);

  const handleConfirmDeepWork = React.useCallback(
    async (goal: string) => {
      try {
        const didStart = await startFocusSession({ mode: "deep-work", goal });
        if (didStart) {
          setDeepWorkModalOpen(false);
        }
      } catch {
        // Keep the modal open and render the error from startError.
      }
    },
    [startFocusSession]
  );

  if (isLoading) {
    return <FocusHomeSkeleton />;
  }

  return (
    <>
      <FlocusLikeDashboard
        displayName={displayName}
        durationMinutes={durationMinutes}
        mode={mode}
        stats={stats}
        statsError={statsError}
        streakCount={streak}
        recentSessions={recentSessions}
        onDurationChange={setDurationMinutes}
        onModeChange={handleModeChange}
        onStart={handleStart}
        onRetryStats={() => void refetchStats()}
        isStarting={isStarting}
        startError={mode === "normal" ? startError : null}
      />
      {mode === "deep-work" && (
        <DeepWorkModal
          open={deepWorkModalOpen}
          durationMinutes={durationMinutes}
          lastGoal={lastGoal}
          isSubmitting={isStarting}
          error={startError}
          onOpenChange={setDeepWorkModalOpen}
          onConfirm={handleConfirmDeepWork}
        />
      )}
    </>
  );
}
