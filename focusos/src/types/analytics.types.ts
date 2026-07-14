// ═══════════════════════════════════════════════════════════════
// Analytics Types — FocusOS
// ═══════════════════════════════════════════════════════════════

import type { SessionMode } from "./session.types";

// ── Date Range ────────────────────────────────────────────────

export type DateRange = "today" | "7d" | "30d" | "90d" | "all";

// ── Dashboard Stats ───────────────────────────────────────────

export interface DashboardStats {
  totalFocusMinutes: number;
  totalSessions: number;
  averageFocusScore: number | null;
  deepWorkSessionCount: number;
  completionRate: number; // 0-100 percentage
  dateRange: DateRange;
}

// ── Focus Trend ───────────────────────────────────────────────

export type TrendDirection = "up" | "down" | "neutral";

export interface FocusTrendDataPoint {
  date: string; // "YYYY-MM-DD"
  averageScore: number | null;
  sessionCount: number;
  totalMinutes: number;
}

export interface FocusTrendData {
  dataPoints: FocusTrendDataPoint[];
  trendDirection: TrendDirection;
  trendPercentage: number;
  dateRange: DateRange;
}

// ── Distraction Analytics ─────────────────────────────────────

export interface DistractionSource {
  domain: string;
  warningCount: number;
  sessionCount: number;
  percentageOfSessions: number;
  severity: "high" | "medium" | "low";
}

export interface DistractionAnalytics {
  topSources: DistractionSource[];
  totalWarnings: number;
  averageWarningsPerSession: number;
  warningTrend: TrendDirection;
  dateRange: DateRange;
}

export interface DistractionFrequencyDataPoint {
  sessionId: string;
  date: string;
  warningCount: number;
  mode: SessionMode;
}

// ── Time Heatmap ──────────────────────────────────────────────

export interface HeatmapDataPoint {
  hour: number;     // 0–23
  day: number;      // 0 = Sunday, 6 = Saturday
  averageScore: number | null;
  sessionCount: number;
}

export type HeatmapData = HeatmapDataPoint[];

export interface PeakFocusWindow {
  hour: number;
  day: number;
  averageScore: number;
  label: string; // e.g. "Tuesday 10:00 PM"
}

// ── Weekly Snapshot ───────────────────────────────────────────

export interface WeekStats {
  weekStart: string; // ISO
  weekEnd: string;
  totalFocusMinutes: number;
  totalSessions: number;
  averageFocusScore: number | null;
  deepWorkCount: number;
  completionRate: number;
}

export interface WeeklySnapshot {
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  delta: {
    focusMinutes: number;
    sessions: number;
    averageFocusScore: number | null;
    deepWorkCount: number;
  };
  aiRecommendation?: string;
  recommendations?: Array<{
    reason_code?: string;
    message?: string;
    title?: string;
  }>;
  trendDirection: TrendDirection;
}

// ── Session Breakdown ─────────────────────────────────────────

export interface SessionBreakdown {
  normalSessionCount: number;
  deepWorkSessionCount: number;
  normalSessionPercentage: number;
  deepWorkSessionPercentage: number;
  averageNormalScore: number | null;
  averageDeepWorkScore: number | null;
}

// ── KPI Strip ─────────────────────────────────────────────────

export interface KPIData {
  label: string;
  value: string | number;
  unit?: string;
  trend?: TrendDirection;
  trendValue?: string;
  icon?: string;
}

// ── Analytics Filters ─────────────────────────────────────────

export interface AnalyticsFilters {
  dateRange: DateRange;
  selectedTags: string[];
  mode?: SessionMode | "all";
}

// ── Focus Score Mini Chart (sparkline) ───────────────────────

export interface SparklineDataPoint {
  date: string;
  score: number | null;
}

export type SparklineData = SparklineDataPoint[];

// ── Pattern Insights (Phase 2) ────────────────────────────────

export interface FocusPattern {
  type:
    | "optimal-duration"
    | "best-time-of-day"
    | "score-duration-correlation"
    | "distraction-trigger"
    | "custom";
  title: string;
  description: string;
  confidence: number; // 0-100
  recommendation?: string;
  dataPoints: number; // sessions analyzed
}

export interface PatternInsights {
  patterns: FocusPattern[];
  minimumSessionsReached: boolean;
  sessionsAnalyzed: number;
  generatedAt: string;
}

export type ReportExportFormat = "json" | "html" | "pdf";

export interface ReportExportPayload {
  dateRange?: DateRange;
  range?: "7d" | "30d";
  date_from?: string;
  date_to?: string;
  format?: ReportExportFormat;
  tag?: string;
}

export interface ReportExportJob {
  jobId: string;
  status: "pending" | "processing" | "completed" | "ready" | "failed" | "expired";
  format: ReportExportFormat;
  dateRange: string;
  dateFrom: string | null;
  dateTo: string | null;
  requestedTimezone: string;
  payload: Record<string, unknown>;
  downloadUrl: string;
  downloadReady: boolean;
  fileSize: number;
  checksum: string;
  progress: number;
  errorCode: string;
  errorMessage: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}
