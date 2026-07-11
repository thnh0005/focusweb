import { apiClient } from "./client";
import type {
  DateRange,
  DashboardStats,
  FocusTrendData,
  DistractionAnalytics,
  HeatmapData,
  WeeklySnapshot,
  PatternInsights,
  ReportExportJob,
  ReportExportPayload,
} from "@/types/analytics.types";

export const analyticsApi = {
  /**
   * Fetch core dashboard status indicators.
   */
  getDashboardStats(range: DateRange): Promise<DashboardStats> {
    return apiClient.get<DashboardStats>("/analytics/dashboard/", {
      params: { range },
    });
  },

  /**
   * Fetch focus score trend over time.
   */
  getFocusTrend(range: DateRange): Promise<FocusTrendData> {
    return apiClient.get<FocusTrendData>("/analytics/trend/", {
      params: { range },
    });
  },

  /**
   * Fetch distraction events and counts.
   */
  getDistractionAnalytics(range: DateRange): Promise<DistractionAnalytics> {
    return apiClient.get<DistractionAnalytics>("/analytics/distractions/", {
      params: { range },
    });
  },

  /**
   * Fetch hour/day grid average focus score density.
   */
  getHeatmapData(): Promise<HeatmapData> {
    return apiClient.get<HeatmapData>("/analytics/heatmap/");
  },

  /**
   * Fetch week-over-week performance comparisons.
   */
  getWeeklySnapshot(): Promise<WeeklySnapshot> {
    return apiClient.get<WeeklySnapshot>("/analytics/weekly-snapshot/");
  },

  /**
   * Fetch deep AI pattern insights (e.g. peak focus window).
   */
  getPatternInsights(): Promise<PatternInsights> {
    return apiClient.get<PatternInsights>("/analytics/patterns/");
  },

  exportReport(payload: ReportExportPayload): Promise<ReportExportJob> {
    return apiClient.post<ReportExportJob>("/reports/export/", payload);
  },

  getReportExportJob(jobId: string): Promise<ReportExportJob> {
    return apiClient.get<ReportExportJob>(`/reports/export/${jobId}/`);
  },
};
