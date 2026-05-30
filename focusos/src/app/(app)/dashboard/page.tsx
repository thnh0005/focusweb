"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useUserStore } from "@/stores/user.store";
import { analyticsApi } from "@/services/analytics.api";
import { sessionsApi } from "@/services/sessions.api";
import { StatsStrip } from "@/components/features/dashboard/StatsStrip";
import { DailySummary } from "@/components/features/dashboard/DailySummary";
import { QuickActions } from "@/components/features/dashboard/QuickActions";
import { RecentActivity } from "@/components/features/dashboard/RecentActivity";
import { Spinner } from "@/components/ui/Spinner";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { streak, fetchProfile } = useUserStore();

  // Dynamically calculate greeting based on local time
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Fetch profile to seed streak indicators on mount
  React.useEffect(() => {
    fetchProfile().catch((err) => console.warn("Failed to load user profile on dashboard:", err));
  }, [fetchProfile]);

  // Query dashboard statistics via React Query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => analyticsApi.getDashboardStats("7d"),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Query recent sessions via React Query
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["recent-sessions"],
    queryFn: () => sessionsApi.getSessions({ page: 1, limit: 5 }),
    staleTime: 30 * 1000,
  });

  const recentSessions = sessionsData?.results ?? [];

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";

  const isLoading = statsLoading && sessionsLoading;

  if (isLoading) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3"
      >
        <Spinner className="h-7 w-7 text-focus-purple" />
        <span className="text-xs text-text-muted font-light">Entering your sanctuary dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      {/* Welcome Header */}
      <header className="space-y-3 select-none pt-2">
        <div className="space-y-1">
          <h2 className="text-4xl sm:text-5xl font-extralight tracking-tight text-text-primary leading-tight">
            {greeting}, <span className="font-light text-transparent bg-clip-text bg-gradient-to-r from-focus-purple to-ambient-cyan">{displayName}</span>
          </h2>
          <p className="text-sm text-text-secondary font-light">
            Welcome to your sanctuary. Let's build something meaningful today.
          </p>
        </div>
      </header>

      {/* Stats Strip Widget */}
      <StatsStrip stats={stats} streakCount={streak} />

      {/* Balanced Dashboard Features Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
        {/* Left Column: Recent Activity (takes 2/3 width on wide viewports) */}
        <div className="lg:col-span-2 h-full">
          <RecentActivity sessions={recentSessions} isLoading={sessionsLoading} />
        </div>

        {/* Right Column: Stack of Daily Summary & Quick Actions */}
        <div className="flex flex-col gap-6 h-full">
          <DailySummary stats={stats} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
