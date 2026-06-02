"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Layers3, Sparkles, Target } from "lucide-react";
import { analyticsApi } from "@/services/analytics.api";
import { AmbientScene } from "@/components/ambient/AmbientScene";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { FocusTrendChart } from "@/components/features/analytics/FocusTrendChart";
import { DistractionSourcesChart } from "@/components/features/analytics/DistractionSourcesChart";
import { TimeHeatmap } from "@/components/features/analytics/TimeHeatmap";
import { SessionBreakdownChart } from "@/components/features/analytics/SessionBreakdownChart";
import { WeeklyProgressSnapshot } from "@/components/features/analytics/WeeklyProgressSnapshot";
import type { DateRange } from "@/types/analytics.types";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = React.useState<DateRange>("7d");

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ["dashboard-stats", dateRange],
    queryFn: () => analyticsApi.getDashboardStats(dateRange),
    staleTime: 60 * 1000,
  });

  const { data: distractions, isLoading: distractionsLoading } = useQuery({
    queryKey: ["distractions", dateRange],
    queryFn: () => analyticsApi.getDistractionAnalytics(dateRange),
    staleTime: 60 * 1000,
  });

  const { data: focusTrend, isLoading: trendLoading } = useQuery({
    queryKey: ["focus-trend", dateRange],
    queryFn: () => analyticsApi.getFocusTrend(dateRange),
    staleTime: 60 * 1000,
  });

  const { data: heatmap, isLoading: heatmapLoading } = useQuery({
    queryKey: ["focus-heatmap"],
    queryFn: () => analyticsApi.getHeatmapData(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: weeklySnapshot, isLoading: weeklyLoading } = useQuery({
    queryKey: ["weekly-snapshot"],
    queryFn: () => analyticsApi.getWeeklySnapshot(),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = statsLoading || distractionsLoading;
  const totalSessions = stats?.totalSessions ?? 0;
  const deepWorkPercent =
    totalSessions > 0
      ? Math.round(((stats?.deepWorkSessionCount ?? 0) / totalSessions) * 100)
      : 0;

  const trendData =
    focusTrend?.dataPoints.map((point) => ({
      date: point.date,
      score: point.averageScore ?? 0,
      sessions: point.sessionCount,
    })) ?? [];

  const heatmapData =
    heatmap?.map((point) => ({
      hour: point.hour,
      day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][point.day] ?? "Mon",
      score: point.averageScore ?? 0,
      sessions: point.sessionCount,
    })) ?? [];

  const weeklyData = weeklySnapshot
    ? {
        thisWeekHours: weeklySnapshot.thisWeek.totalFocusMinutes / 60,
        lastWeekHours: weeklySnapshot.lastWeek.totalFocusMinutes / 60,
        thisWeekScore: weeklySnapshot.thisWeek.averageFocusScore ?? 0,
        lastWeekScore: weeklySnapshot.lastWeek.averageFocusScore ?? 0,
        thisWeekDeepWork: weeklySnapshot.thisWeek.deepWorkCount,
        lastWeekDeepWork: weeklySnapshot.lastWeek.deepWorkCount,
        aiRecommendation: weeklySnapshot.aiRecommendation ?? "",
      }
    : null;

  if (isLoading) {
    return (
      <AmbientScene variant="minimal" intensity="low" className="min-h-[60dvh] rounded-[2rem]">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="glass-panel flex h-20 w-20 items-center justify-center rounded-3xl">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-text-muted">Loading focus reflection</p>
        </div>
      </AmbientScene>
    );
  }

  return (
    <AmbientScene variant="forest" intensity="low" className="rounded-[2rem]">
      <main className="space-y-8 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-text-muted">Analytics</p>
            <h1 className="mt-2 text-4xl font-light leading-tight text-text-primary sm:text-5xl">
              Focus reflection
            </h1>
            <p className="mt-3 max-w-[42rem] text-sm font-light leading-relaxed text-text-secondary">
              Patterns from recent sessions, softened into signals you can act on.
            </p>
          </div>

          <Tabs
            value={dateRange}
            onValueChange={(value) => {
              if (value === "7d" || value === "30d" || value === "all") {
                setDateRange(value);
              }
            }}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-3 rounded-full border border-white/10 bg-white/[0.045] p-1 sm:w-[330px]">
              <TabsTrigger value="7d" className="rounded-full">7 days</TabsTrigger>
              <TabsTrigger value="30d" className="rounded-full">30 days</TabsTrigger>
              <TabsTrigger value="all" className="rounded-full">All time</TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        {statsError && (
          <Card className="rounded-3xl border-urgency-amber/25 bg-urgency-amber/10 p-5">
            <p className="text-sm text-urgency-amber">
              Analytics could not refresh. Existing charts will reappear once the connection recovers.
            </p>
          </Card>
        )}

        {totalSessions === 0 && (
          <Card className="rounded-3xl p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-light text-text-primary">Complete a few sessions to reveal patterns</h2>
                <p className="mt-2 text-sm font-light text-text-secondary">
                  Focus trends, heatmaps, and distraction sources become useful after several completed sessions.
                </p>
              </div>
              <Sparkles className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
            </div>
          </Card>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Top focus metrics">
          <QuietStat icon={Clock} label="Total focus hours" value={`${Math.round((stats?.totalFocusMinutes ?? 0) / 60)}h`} />
          <QuietStat icon={Target} label="Average score" value={`${stats?.averageFocusScore ?? 0}%`} />
          <QuietStat icon={BarChart3} label="Sessions" value={totalSessions} />
          <QuietStat icon={Layers3} label="Deep work share" value={`${deepWorkPercent}%`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
          <FocusTrendChart data={trendData} isLoading={trendLoading} />
          {weeklyData ? (
            <WeeklyProgressSnapshot data={weeklyData} isLoading={weeklyLoading} />
          ) : (
            <Card className="rounded-3xl p-6">
              <h2 className="text-lg font-light text-text-primary">Weekly progress</h2>
              <p className="mt-3 text-sm text-text-muted">No weekly snapshot is available yet.</p>
            </Card>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DistractionSourcesChart
            data={(distractions?.topSources ?? []).map((source) => ({
              domain: source.domain,
              warningCount: source.warningCount,
              sessionPercentage: source.percentageOfSessions,
            }))}
            isLoading={distractionsLoading}
          />
          <SessionBreakdownChart
            normalMode={Math.max(0, totalSessions - (stats?.deepWorkSessionCount ?? 0))}
            deepWorkMode={stats?.deepWorkSessionCount ?? 0}
          />
        </section>

        <section>
          <TimeHeatmap data={heatmapData} isLoading={heatmapLoading} />
        </section>
      </main>
    </AmbientScene>
  );
}

type StatIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function QuietStat({
  icon: Icon,
  label,
  value,
}: {
  icon: StatIcon;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-3 text-3xl font-light tabular-nums text-text-primary">
            {value}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
          <Icon className="h-4 w-4 stroke-[1.6]" aria-hidden />
        </span>
      </div>
    </Card>
  );
}
