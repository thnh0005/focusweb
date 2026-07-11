"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Download, Layers3, RefreshCw, Sparkles, Target } from "lucide-react";
import { analyticsApi } from "@/services/analytics.api";
import { AmbientScene } from "@/components/ambient/AmbientScene";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { FocusTrendChart } from "@/components/features/analytics/FocusTrendChart";
import { DistractionSourcesChart } from "@/components/features/analytics/DistractionSourcesChart";
import { TimeHeatmap } from "@/components/features/analytics/TimeHeatmap";
import { SessionBreakdownChart } from "@/components/features/analytics/SessionBreakdownChart";
import { WeeklyProgressSnapshot } from "@/components/features/analytics/WeeklyProgressSnapshot";
import type { DateRange, ReportExportFormat, ReportExportJob } from "@/types/analytics.types";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = React.useState<DateRange>("7d");
  const [exportFormat, setExportFormat] = React.useState<ReportExportFormat>("json");
  const [isExporting, setIsExporting] = React.useState(false);
  const [isRefreshingExport, setIsRefreshingExport] = React.useState(false);
  const [exportJob, setExportJob] = React.useState<ReportExportJob | null>(null);
  const [exportError, setExportError] = React.useState("");
  const [exportMessage, setExportMessage] = React.useState("");

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

  const handleExport = async () => {
    setIsExporting(true);
    setExportError("");
    setExportMessage("");

    try {
      const job = await analyticsApi.exportReport({
        dateRange,
        format: exportFormat,
        range: dateRange === "30d" ? "30d" : "7d",
      });
      setExportJob(job);
      handleReportDownload(job);
      setExportMessage(statusMessage(job));
    } catch (error) {
      setExportError(getErrorMessage(error, "Could not create report export"));
    } finally {
      setIsExporting(false);
    }
  };

  const refreshExportJob = async () => {
    if (!exportJob) return;
    setIsRefreshingExport(true);
    setExportError("");

    try {
      const job = await analyticsApi.getReportExportJob(exportJob.jobId);
      setExportJob(job);
      handleReportDownload(job);
      setExportMessage(statusMessage(job));
    } catch (error) {
      setExportError(getErrorMessage(error, "Could not refresh export status"));
    } finally {
      setIsRefreshingExport(false);
    }
  };

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
                if (value === "all" && exportFormat === "pdf") {
                  setExportFormat("json");
                }
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

        <ReportExportPanel
          dateRange={dateRange}
          format={exportFormat}
          onFormatChange={setExportFormat}
          onExport={handleExport}
          onRefresh={refreshExportJob}
          isExporting={isExporting}
          isRefreshing={isRefreshingExport}
          job={exportJob}
          error={exportError}
          message={exportMessage}
        />

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

function ReportExportPanel({
  dateRange,
  format,
  onFormatChange,
  onExport,
  onRefresh,
  isExporting,
  isRefreshing,
  job,
  error,
  message,
}: {
  dateRange: DateRange;
  format: ReportExportFormat;
  onFormatChange: (format: ReportExportFormat) => void;
  onExport: () => void;
  onRefresh: () => void;
  isExporting: boolean;
  isRefreshing: boolean;
  job: ReportExportJob | null;
  error: string;
  message: string;
}) {
  const isPending = job?.status === "pending" || job?.status === "processing";

  return (
    <Card className="rounded-3xl p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-text-muted">Report export</p>
          <h2 className="mt-2 text-xl font-light text-text-primary">Export focus report</h2>
          <p className="mt-2 max-w-[42rem] text-sm font-light leading-relaxed text-text-secondary">
            Export the current {dateRange} analytics range. JSON and HTML are returned immediately when ready; PDF may be generated as a background job.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="report-export-format">
            Report format
          </label>
          <select
            id="report-export-format"
            value={format}
            onChange={(event) => onFormatChange(event.target.value as ReportExportFormat)}
            disabled={isExporting}
            className="h-11 rounded-full border border-white/10 bg-white/[0.045] px-4 text-sm text-text-primary outline-none transition-colors focus:border-primary/45 focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value="json">JSON</option>
            <option value="html">HTML</option>
            <option value="pdf" disabled={dateRange === "all"}>PDF</option>
          </select>
          <Button
            type="button"
            variant="session"
            onClick={onExport}
            disabled={isExporting}
            className="rounded-full px-5"
          >
            <Download className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            {isExporting ? "Exporting" : "Export report"}
          </Button>
          {isPending && (
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-full px-5"
            >
              <RefreshCw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              {isRefreshing ? "Checking" : "Check status"}
            </Button>
          )}
        </div>
      </div>

      {job && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-2 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <span>Job {job.jobId}</span>
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">
              {job.status} · {job.progress}%
            </span>
          </div>
          {job.errorMessage && (
            <p className="mt-2 text-sm text-urgency-coral">{job.errorMessage}</p>
          )}
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm font-light text-primary">{message}</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-light text-urgency-coral">
          {error}
        </p>
      )}
    </Card>
  );
}

function handleReportDownload(job: ReportExportJob) {
  if (typeof window === "undefined") return;

  if (job.downloadUrl) {
    window.open(resolveDownloadUrl(job.downloadUrl), "_blank", "noopener,noreferrer");
    return;
  }

  if (job.status !== "ready" && job.status !== "completed") return;
  if (job.format === "json") {
    downloadBlob(
      JSON.stringify(job.payload, null, 2),
      `focusos-report-${job.dateRange || "range"}.json`,
      "application/json"
    );
    return;
  }

  if (job.format === "html") {
    const html = typeof job.payload.html === "string"
      ? job.payload.html
      : `<pre>${escapeHtml(JSON.stringify(job.payload, null, 2))}</pre>`;
    downloadBlob(
      html,
      `focusos-report-${job.dateRange || "range"}.html`,
      "text/html"
    );
  }
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function statusMessage(job: ReportExportJob) {
  if (job.status === "pending" || job.status === "processing") {
    return "Report export has been queued. Use Check status to refresh the job.";
  }
  if (job.status === "failed") {
    return "";
  }
  if (job.status === "expired") {
    return "This export has expired. Create a new export to download it again.";
  }
  return "Report export is ready.";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function resolveDownloadUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").toString();
}
