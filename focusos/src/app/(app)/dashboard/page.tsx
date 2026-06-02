"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AmbientWorkspaceBackground, FlocusLikeDashboard } from "@/components/focus-home";
import { Spinner } from "@/components/ui/Spinner";
import { analyticsApi } from "@/services/analytics.api";
import { sessionsApi } from "@/services/sessions.api";
import { useAuthStore } from "@/stores/auth.store";
import { useUserStore } from "@/stores/user.store";
import type { SessionMode } from "@/types/session.types";

function FocusHomeSkeleton() {
  return (
    <AmbientWorkspaceBackground>
      <div
        className="flex min-h-[100dvh] items-center justify-center px-6 text-center"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-7 w-7 text-focus-green" />
          <p className="text-sm text-text-muted">Preparing focus room</p>
        </div>
      </div>
    </AmbientWorkspaceBackground>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { streak, fetchProfile } = useUserStore();
  const [durationMinutes, setDurationMinutes] = React.useState(25);
  const [mode, setMode] = React.useState<SessionMode>("normal");
  const [goal, setGoal] = React.useState("");

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
    (lastSession?.mode === "deep-work" ? "Continue deep work block" : null);

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "Hieu";
  const isLoading = statsLoading && sessionsLoading;

  const handleStartFocus = React.useCallback(() => {
    router.push("/session");
  }, [router]);

  if (isLoading) {
    return <FocusHomeSkeleton />;
  }

  return (
    <FlocusLikeDashboard
      displayName={displayName}
      goal={goal}
      lastGoal={lastGoal}
      durationMinutes={durationMinutes}
      mode={mode}
      stats={stats}
      statsError={statsError}
      streakCount={streak}
      recentSessions={recentSessions}
      onGoalChange={setGoal}
      onDurationChange={setDurationMinutes}
      onModeChange={setMode}
      onStart={handleStartFocus}
      onRetryStats={() => void refetchStats()}
    />
  );
}
