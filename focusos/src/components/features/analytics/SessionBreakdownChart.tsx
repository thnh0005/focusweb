"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";

const panelClassName =
  "min-w-0 overflow-hidden rounded-[1.75rem] border-white/10 bg-[rgb(10_13_10/0.56)] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6";

export interface SessionBreakdownProps {
  normalMode: number;
  deepWorkMode: number;
  isLoading?: boolean;
  compact?: boolean;
}

export function SessionBreakdownChart({
  normalMode,
  deepWorkMode,
  isLoading = false,
  compact = false,
}: SessionBreakdownProps) {
  const { t } = useTranslation("analytics");
  const total = normalMode + deepWorkMode;
  const data = [
    { name: t("charts.normalMode"), value: normalMode, color: "rgb(143, 176, 162)" },
    { name: t("charts.deepWork"), value: deepWorkMode, color: "rgb(124, 171, 145)" },
  ];

  if (isLoading) {
    return (
      <Card className={`${panelClassName} space-y-4`}>
        <h3 className="text-lg font-light text-text-primary">{t("charts.sessionBreakdown")}</h3>
        <div className={`${compact ? "h-28" : "h-40"} rounded-2xl bg-white/[0.045] animate-pulse`} />
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card className={`${panelClassName} space-y-4`}>
        <h3 className="text-lg font-light text-text-primary">{t("charts.sessionBreakdown")}</h3>
        <div className="h-40 flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <p className="text-sm text-text-muted">{t("empty.sessions")}</p>
        </div>
      </Card>
    );
  }

  const normalPercent = ((normalMode / total) * 100).toFixed(0);
  const deepPercent = ((deepWorkMode / total) * 100).toFixed(0);

  return (
    <Card className={`${panelClassName} ${compact ? "space-y-3 p-4 sm:p-5" : "space-y-6"}`}>
      <h3 className="text-lg font-light text-text-primary">{t("charts.sessionBreakdown")}</h3>

      <div className="grid gap-3">
        <ResponsiveContainer width="100%" height={compact ? 150 : 220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={compact ? 38 : 52}
              outerRadius={compact ? 62 : 88}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(20, 24, 18, 0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.72)" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.035] p-3">
            <p className="text-sm font-medium text-text-primary">{t("charts.normalMode")}</p>
            <p className="mt-1 text-xl font-light text-text-primary">{normalMode}</p>
            <p className="mt-1 text-xs text-text-muted">{t("charts.ofTotal", { value: normalPercent })}</p>
          </div>
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.035] p-3">
            <p className="text-sm font-medium text-primary">{t("charts.deepWork")}</p>
            <p className="mt-1 text-xl font-light text-primary">{deepWorkMode}</p>
            <p className="mt-1 text-xs text-text-muted">{t("charts.ofTotal", { value: deepPercent })}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
