"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";

const panelClassName =
  "min-w-0 overflow-hidden rounded-[1.75rem] border-white/10 bg-[rgb(10_13_10/0.56)] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6";

export interface WeeklyProgressData {
  thisWeekHours: number;
  lastWeekHours: number;
  thisWeekScore: number;
  lastWeekScore: number;
  thisWeekDeepWork: number;
  lastWeekDeepWork: number;
  aiRecommendation: string;
  recommendationReasonCode?: string;
}

export interface WeeklyProgressSnapshotProps {
  data: WeeklyProgressData;
  isLoading?: boolean;
  compact?: boolean;
}

export function WeeklyProgressSnapshot({
  data,
  isLoading = false,
  compact = false,
}: WeeklyProgressSnapshotProps) {
  const { t } = useTranslation("analytics");
  const deltaHours = data.thisWeekHours - data.lastWeekHours;
  const deltaScore = data.thisWeekScore - data.lastWeekScore;
  const deltaDeepWork = data.thisWeekDeepWork - data.lastWeekDeepWork;

  const getDeltaColor = (delta: number) => {
    if (delta > 0) return "text-primary";
    if (delta < 0) return "text-urgency-amber";
    return "text-text-muted";
  };

  const getDeltaPrefix = (delta: number) => {
    if (delta > 0) return "+";
    if (delta < 0) return "-";
    return "";
  };

  if (isLoading) {
    return (
      <Card className={`${panelClassName} space-y-4`}>
        <div className={`${compact ? "h-28" : "h-40"} rounded-2xl bg-white/[0.045] animate-pulse`} />
      </Card>
    );
  }

  const localizedRecommendation = data.recommendationReasonCode
    ? t(`recommendations.${data.recommendationReasonCode}`, {
        defaultValue: data.aiRecommendation,
      })
    : data.aiRecommendation;

  return (
    <Card className={`${panelClassName} ${compact ? "space-y-2 p-4 sm:p-4" : "space-y-6"}`}>
      <div>
        <h3 className={`${compact ? "text-base" : "text-lg"} font-light text-text-primary`}>{t("weekly.title")}</h3>
        {!compact && <p className="mt-1 text-xs text-text-muted">{t("weekly.description")}</p>}
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "sm:grid-cols-3"}`}>
        <SnapshotMetric
          label={t("metrics.totalHours")}
          value={`${data.thisWeekHours.toFixed(1)}h`}
          delta={`${getDeltaPrefix(deltaHours)}${Math.abs(deltaHours).toFixed(1)}h`}
          deltaClassName={getDeltaColor(deltaHours)}
        />
        <SnapshotMetric
          label={t("metrics.avgScore")}
          value={`${Math.round(data.thisWeekScore)}%`}
          delta={`${getDeltaPrefix(deltaScore)}${Math.abs(Math.round(deltaScore))}%`}
          deltaClassName={getDeltaColor(deltaScore)}
        />
        <SnapshotMetric
          label={t("metrics.deepWork")}
          value={data.thisWeekDeepWork}
          delta={`${getDeltaPrefix(deltaDeepWork)}${Math.abs(deltaDeepWork)}`}
          deltaClassName={getDeltaColor(deltaDeepWork)}
        />
      </div>

      {localizedRecommendation && (
        <div className={`${compact ? "pt-2" : "pt-3"} border-t border-white/10`}>
          <p className="mb-1 text-[11px] font-mono text-text-muted">{t("weekly.focus")}</p>
          <p
            className={`${compact ? "truncate" : ""} text-sm font-light leading-relaxed text-text-secondary`}
            title={localizedRecommendation}
          >
            {localizedRecommendation}
          </p>
        </div>
      )}
    </Card>
  );
}

function SnapshotMetric({
  label,
  value,
  delta,
  deltaClassName,
}: {
  label: string;
  value: string | number;
  delta: string;
  deltaClassName: string;
}) {
  return (
    <div className="min-w-0 rounded-[0.9rem] border border-white/10 bg-white/[0.03] p-2.5">
      <p className="truncate text-[10px] font-mono text-text-muted">{label}</p>
      <div className="mt-1.5 flex min-w-0 items-baseline gap-1.5">
        <p className="truncate text-lg font-light leading-none text-text-primary">{value}</p>
        <p className={`truncate text-xs font-medium ${deltaClassName}`}>{delta}</p>
      </div>
    </div>
  );
}
