"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";

const panelClassName =
  "min-w-0 overflow-hidden rounded-[1.75rem] border-white/10 bg-[rgb(10_13_10/0.56)] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6";

export interface FocusTrendChartProps {
  data: Array<{ date: string; score: number; sessions: number }>;
  isLoading?: boolean;
  compact?: boolean;
}

export function FocusTrendChart({
  data,
  isLoading = false,
  compact = false,
}: FocusTrendChartProps) {
  const { t } = useTranslation("analytics");

  if (isLoading) {
    return (
      <Card className={`${panelClassName} ${compact ? "space-y-2 p-4 sm:p-4" : "space-y-4"}`}>
        <h3 className={`${compact ? "text-base" : "text-lg"} font-light text-text-primary`}>{t("charts.focusTrend")}</h3>
        <div className={`${compact ? "h-32" : "h-80"} rounded-2xl bg-white/[0.045] animate-pulse`} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={`${panelClassName} ${compact ? "space-y-2 p-4 sm:p-4" : "space-y-4"}`}>
        <h3 className={`${compact ? "text-base" : "text-lg"} font-light text-text-primary`}>{t("charts.focusTrend")}</h3>
        <div className={`flex ${compact ? "h-32" : "h-80"} items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]`}>
          <p className="text-sm text-text-muted">{t("empty.trend")}</p>
        </div>
      </Card>
    );
  }

  const trend =
    data.length >= 2
      ? data[data.length - 1].score > data[0].score
        ? "up"
        : data[data.length - 1].score < data[0].score
          ? "down"
          : "flat"
      : "flat";

  return (
    <Card className={`${panelClassName} ${compact ? "space-y-2 p-4 sm:p-4" : "space-y-4"}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className={`${compact ? "text-base" : "text-lg"} font-light text-text-primary`}>{t("charts.focusTrend")}</h3>
          {!compact && <p className="mt-1 text-xs text-text-muted">{t("charts.focusTrendDescription")}</p>}
        </div>
        {trend === "up" && <span className={`${compact ? "text-xs" : "text-sm"} shrink-0 font-medium text-primary`}>{t("charts.improving")}</span>}
        {trend === "down" && <span className={`${compact ? "text-xs" : "text-sm"} shrink-0 font-medium text-urgency-amber`}>{t("charts.drifting")}</span>}
        {trend === "flat" && <span className={`${compact ? "text-xs" : "text-sm"} shrink-0 font-medium text-text-muted`}>{t("charts.stable")}</span>}
      </div>

      <ResponsiveContainer width="100%" height={compact ? 145 : 300}>
        <LineChart data={data} margin={compact ? { top: 4, right: 8, left: -26, bottom: 0 } : { top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="date" stroke="rgba(246,241,223,0.34)" tick={compact ? false : undefined} axisLine={!compact} style={{ fontSize: "12px" }} />
          <YAxis stroke="rgba(246,241,223,0.34)" domain={[0, 100]} tick={compact ? false : undefined} axisLine={!compact} style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              background: "rgba(20, 24, 18, 0.96)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.72)" }}
          />
          {!compact && <Legend wrapperStyle={{ paddingTop: "20px" }} />}
          <Line
            type="monotone"
            dataKey="score"
            stroke="rgb(124, 171, 145)"
            strokeWidth={2}
            dot={{ fill: "rgb(124, 171, 145)", r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
