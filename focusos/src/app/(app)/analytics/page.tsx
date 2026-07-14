"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Clock, Download, Layers3, RefreshCw, Sparkles, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AmbientWorkspaceBackground } from "@/components/focus-home";
import { DistractionSourcesChart } from "@/components/features/analytics/DistractionSourcesChart";
import { FocusTrendChart } from "@/components/features/analytics/FocusTrendChart";
import { SessionBreakdownChart } from "@/components/features/analytics/SessionBreakdownChart";
import { TimeHeatmap } from "@/components/features/analytics/TimeHeatmap";
import { WeeklyProgressSnapshot } from "@/components/features/analytics/WeeklyProgressSnapshot";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils/cn";
import { analyticsApi } from "@/services/analytics.api";
import type { DateRange, ReportExportFormat, ReportExportJob } from "@/types/analytics.types";

export default function AnalyticsPage() {
  const { t } = useTranslation("analytics");
  const router = useRouter();
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
  const averageFocusScore = Math.round(stats?.averageFocusScore ?? 0);

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
        aiRecommendation:
          weeklySnapshot.aiRecommendation ??
          weeklySnapshot.recommendations?.[0]?.message ??
          weeklySnapshot.recommendations?.[0]?.title ??
          "",
        recommendationReasonCode: weeklySnapshot.recommendations?.[0]?.reason_code,
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
      setExportMessage(statusMessage(job, t));
    } catch (error) {
      setExportError(getErrorMessage(error, t("errors.exportCreate")));
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
      setExportMessage(statusMessage(job, t));
    } catch (error) {
      setExportError(getErrorMessage(error, t("errors.exportRefresh")));
    } finally {
      setIsRefreshingExport(false);
    }
  };

  if (isLoading) {
    return (
      <AmbientWorkspaceBackground className="min-h-[100dvh]">
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="glass-panel flex h-20 w-20 items-center justify-center rounded-3xl">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-text-muted">{t("loading")}</p>
        </div>
      </AmbientWorkspaceBackground>
    );
  }

  return (
    <AmbientWorkspaceBackground className="min-h-[100dvh]">
      <main className="mx-auto flex h-[100dvh] w-full max-w-[1480px] flex-col gap-4 overflow-hidden px-4 py-4 sm:px-5 lg:px-6">
        <section className="min-w-0 shrink-0 rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.58)] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label={t("title")}>
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 text-xs text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("backHome")}
              >
                <ArrowLeft className="h-3.5 w-3.5 stroke-[1.6]" aria-hidden="true" />
                {t("backHome")}
              </button>
              <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-text-muted">
                {t("title")}
              </span>
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
              <TabsList className="grid w-full grid-cols-3 rounded-full border border-white/10 bg-white/[0.045] p-1 backdrop-blur-xl sm:w-[330px]">
                <TabsTrigger value="7d" className="rounded-full">{t("ranges.7d")}</TabsTrigger>
                <TabsTrigger value="30d" className="rounded-full">{t("ranges.30d")}</TabsTrigger>
                <TabsTrigger value="all" className="rounded-full">{t("ranges.all")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:items-stretch">
            <div className="min-w-0 flex flex-col justify-between">
              <div>
                <h1 className="max-w-3xl text-balance text-3xl font-light leading-tight text-text-primary sm:text-4xl">
                  {t("headline")}
                </h1>
                <p className="mt-3 max-w-[42rem] text-sm font-light leading-relaxed text-text-secondary">
                  {t("description")}
                </p>
              </div>

              <section className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("metrics.top")}>
                <QuietStat icon={Clock} label={t("metrics.totalFocusHours")} value={`${Math.round((stats?.totalFocusMinutes ?? 0) / 60)}h`} />
                <QuietStat icon={Target} label={t("metrics.averageScore")} value={`${averageFocusScore}%`} />
                <QuietStat icon={BarChart3} label={t("metrics.sessions")} value={totalSessions} />
                <QuietStat icon={Layers3} label={t("metrics.deepWorkShare")} value={`${deepWorkPercent}%`} />
              </section>
            </div>

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
          </div>
        </section>

        {statsError && (
          <AnalyticsPanel className="mt-5 border-urgency-amber/25 bg-urgency-amber/10">
            <p className="text-sm text-urgency-amber">
              {t("errors.load")}
            </p>
          </AnalyticsPanel>
        )}

        {totalSessions === 0 && (
          <AnalyticsPanel className="shrink-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-light text-text-primary">{t("empty.title")}</h2>
                <p className="mt-2 text-sm font-light text-text-secondary">
                  {t("empty.description")}
                </p>
              </div>
              <Sparkles className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
            </div>
          </AnalyticsPanel>
        )}

        <section className="grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)_minmax(300px,330px)]">
          <div className="min-h-0 min-w-0">
            <FocusTrendChart data={trendData} isLoading={trendLoading} compact />
          </div>

          <div className="grid min-h-0 min-w-0 gap-4">
            <TimeHeatmap data={heatmapData} isLoading={heatmapLoading} compact />
            <DistractionSourcesChart
              data={(distractions?.topSources ?? []).map((source) => ({
                domain: source.domain,
                warningCount: source.warningCount,
                sessionPercentage: source.percentageOfSessions,
              }))}
              isLoading={distractionsLoading}
              compact
            />
          </div>

          <aside className="grid min-h-0 min-w-0 gap-4 lg:col-span-2 lg:grid-cols-2 2xl:col-span-1 2xl:grid-cols-1">
            {weeklyData ? (
              <WeeklyProgressSnapshot data={weeklyData} isLoading={weeklyLoading} compact />
            ) : (
              <AnalyticsPanel>
                <h2 className="text-lg font-light text-text-primary">{t("weekly.title")}</h2>
                <p className="mt-3 text-sm text-text-muted">{t("empty.weekly")}</p>
              </AnalyticsPanel>
            )}
            <SessionBreakdownChart
              normalMode={Math.max(0, totalSessions - (stats?.deepWorkSessionCount ?? 0))}
              deepWorkMode={stats?.deepWorkSessionCount ?? 0}
              compact
            />
          </aside>
        </section>
      </main>
    </AmbientWorkspaceBackground>
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
    <div className="rounded-[0.95rem] border border-white/10 bg-white/[0.035] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-6 text-[10px] leading-3 text-text-muted">{label}</p>
          <p className="mt-1.5 truncate text-lg font-light tabular-nums leading-none text-text-primary">
            {value}
          </p>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.8rem] border border-white/10 bg-white/[0.045] text-primary">
          <Icon className="h-3 w-3 stroke-[1.6]" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function AnalyticsPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.56)] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6",
        className
      )}
    >
      {children}
    </section>
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
  const { t } = useTranslation("analytics");
  const isPending = job?.status === "pending" || job?.status === "processing";

  return (
    <section className="flex min-h-full min-w-0 flex-col justify-between overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl sm:p-5">
      <div>
        <p className="text-xs text-text-muted">{t("export.eyebrow")}</p>
        <h2 className="mt-1 text-lg font-light text-text-primary">{t("export.title")}</h2>
        <p className="mt-1 line-clamp-2 text-xs font-light leading-relaxed text-text-secondary">
          {t("export.description", { range: t(`ranges.${dateRange}`) })}
        </p>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="sr-only" htmlFor="report-export-format">
            {t("export.format")}
          </label>
          <select
            id="report-export-format"
            value={format}
            onChange={(event) => onFormatChange(event.target.value as ReportExportFormat)}
            disabled={isExporting}
            className="h-10 min-w-0 rounded-full border border-white/10 bg-white/[0.045] px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary/45 focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
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
            className="h-10 rounded-full px-4"
          >
            <Download className="h-4 w-4 stroke-[1.6] sm:mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">{isExporting ? t("export.exporting") : t("export.export")}</span>
          </Button>
          {isPending && (
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="col-span-2 h-10 rounded-full px-4"
            >
              <RefreshCw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              {isRefreshing ? t("export.checking") : t("export.checkStatus")}
            </Button>
          )}
        </div>
      </div>

      {job && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex flex-col gap-2 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <span>{t("export.job", { id: job.jobId })}</span>
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">
              {job.status} / {job.progress}%
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
    </section>
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

function statusMessage(job: ReportExportJob, t: (key: string) => string) {
  if (job.status === "pending" || job.status === "processing") {
    return t("export.queued");
  }
  if (job.status === "failed") {
    return "";
  }
  if (job.status === "expired") {
    return t("export.expired");
  }
  return t("export.ready");
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
