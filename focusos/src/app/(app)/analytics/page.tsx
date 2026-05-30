"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/services/analytics.api";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = React.useState<"7d" | "30d" | "all">("7d");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", dateRange],
    queryFn: () => analyticsApi.getDashboardStats(dateRange as any),
    staleTime: 60 * 1000,
  });

  const { data: distractions, isLoading: distractionsLoading } = useQuery({
    queryKey: ["distractions", dateRange],
    queryFn: () => analyticsApi.getDistractionAnalytics(dateRange as any),
    staleTime: 60 * 1000,
  });

  const isLoading = statsLoading || distractionsLoading;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner className="h-7 w-7 text-focus-purple" />
        <span className="text-xs text-text-muted font-light">
          Loading analytics...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-extralight text-text-primary leading-tight">
            Your Focus Analytics
          </h1>
          <p className="text-base text-text-secondary font-light">
            Track patterns, identify distractions, and measure your growth.
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <Tabs
        value={dateRange}
        onValueChange={(v) => setDateRange(v as any)}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-xs grid-cols-3 bg-surface-deep border border-subtle-border">
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Focus Time",
            value: `${Math.round((stats?.totalFocusMinutes ?? 0) / 60)}h`,
          },
          {
            label: "Total Sessions",
            value: stats?.totalSessions ?? 0,
          },
          {
            label: "Avg. Focus Score",
            value: `${stats?.averageFocusScore ?? 0}%`,
          },
          {
            label: "Deep Work Count",
            value: stats?.deepWorkSessionCount ?? 0,
          },
        ].map((metric) => (
          <Card key={metric.label} className="p-6 space-y-2">
            <p className="text-xs text-text-muted uppercase font-medium">
              {metric.label}
            </p>
            <p className="text-3xl font-light text-focus-purple">
              {metric.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Focus Trend */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">
            Focus Trend
          </h2>
          <div className="h-64 flex items-center justify-center text-text-muted text-sm">
            Chart placeholder
          </div>
        </Card>

        {/* Top Distractions */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">
            Top Distractions
          </h2>
          <div className="space-y-3">
            {(distractions?.topSources ?? []).map((distraction: any, idx: number) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-surface-deep rounded-lg"
              >
                <span className="text-sm text-text-secondary">
                  {distraction.domain}
                </span>
                <span className="text-sm font-medium text-focus-purple">
                  {distraction.warningCount}x
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Time of Day */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">
            Optimal Focus Times
          </h2>
          <div className="h-64 flex items-center justify-center text-text-muted text-sm">
            Heatmap placeholder
          </div>
        </Card>

        {/* Session Breakdown */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">
            Session Breakdown
          </h2>
          <div className="space-y-3">
            {[
              { label: "Normal Mode", value: "60%", color: "bg-focus-purple" },
              { label: "Deep Work Mode", value: "40%", color: "bg-amber-500" },
            ].map((mode) => (
              <div key={mode.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">{mode.label}</span>
                  <span className="font-medium text-text-primary">
                    {mode.value}
                  </span>
                </div>
                <div className="h-2 bg-surface-deep rounded-full overflow-hidden">
                  <div className={`h-full ${mode.color}`} style={{ width: mode.value }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
