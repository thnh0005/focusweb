"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";

const panelClassName =
  "min-w-0 overflow-hidden rounded-[1.75rem] border-white/10 bg-[rgb(10_13_10/0.56)] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6";

export interface DistractionSource {
  domain: string;
  warningCount: number;
  sessionPercentage: number;
}

export interface DistractionSourcesChartProps {
  data: DistractionSource[];
  isLoading?: boolean;
  compact?: boolean;
}

export function DistractionSourcesChart({
  data,
  isLoading = false,
  compact = false,
}: DistractionSourcesChartProps) {
  const { t } = useTranslation("analytics");

  if (isLoading) {
    return (
      <Card className={`${panelClassName} space-y-4`}>
        <h3 className="text-lg font-light text-text-primary">{t("charts.distractionSources")}</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-2xl bg-white/[0.045] animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={`${panelClassName} space-y-4`}>
        <h3 className="text-lg font-light text-text-primary">{t("charts.distractionSources")}</h3>
        <div className="h-40 flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <p className="text-sm text-text-muted">{t("empty.distractions")}</p>
        </div>
      </Card>
    );
  }

  const chartData = data.slice(0, 6).map((item) => ({
    name: item.domain.replace("www.", ""),
    warnings: item.warningCount,
  }));

  return (
    <Card className={`${panelClassName} ${compact ? "space-y-3 p-4 sm:p-5" : "space-y-4"}`}>
      <div>
        <h3 className="text-lg font-light text-text-primary">{t("charts.distractionSources")}</h3>
        <p className="mt-1 text-xs text-text-muted">{t("charts.warningCountByDomain")}</p>
      </div>

      <ResponsiveContainer width="100%" height={compact ? 130 : 250}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="name" stroke="rgba(246,241,223,0.34)" style={{ fontSize: "12px" }} />
          <YAxis stroke="rgba(246,241,223,0.34)" style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              background: "rgba(20, 24, 18, 0.96)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.72)" }}
          />
          <Bar dataKey="warnings" fill="rgb(200, 138, 101)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>

      <div className={`${compact ? "space-y-1 pt-0" : "space-y-2 pt-2"}`}>
        {data.slice(0, compact ? 3 : 5).map((source, idx) => (
          <div
            key={source.domain}
            className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/[0.035] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {idx + 1}. {source.domain}
              </p>
              <p className="truncate text-xs text-text-muted">
                {t("charts.sessionsPercent", { value: source.sessionPercentage })}
              </p>
            </div>
            <p className="shrink-0 text-sm font-medium text-urgency-amber">
              {source.warningCount}x
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
