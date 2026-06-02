"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";

export interface WeeklyProgressData {
  thisWeekHours: number;
  lastWeekHours: number;
  thisWeekScore: number;
  lastWeekScore: number;
  thisWeekDeepWork: number;
  lastWeekDeepWork: number;
  aiRecommendation: string;
}

export interface WeeklyProgressSnapshotProps {
  data: WeeklyProgressData;
  isLoading?: boolean;
}

export function WeeklyProgressSnapshot({
  data,
  isLoading = false,
}: WeeklyProgressSnapshotProps) {
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
      <Card className="rounded-3xl p-6 space-y-4">
        <div className="h-40 rounded-2xl bg-white/[0.045] animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl p-6 space-y-6 bg-white/[0.035]">
      <div>
        <h3 className="text-lg font-light text-text-primary">Weekly progress</h3>
        <p className="mt-1 text-xs text-text-muted">This week compared with last week</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SnapshotMetric
          label="Total Hours"
          value={`${data.thisWeekHours.toFixed(1)}h`}
          delta={`${getDeltaPrefix(deltaHours)}${Math.abs(deltaHours).toFixed(1)}h`}
          deltaClassName={getDeltaColor(deltaHours)}
        />
        <SnapshotMetric
          label="Avg Score"
          value={`${Math.round(data.thisWeekScore)}%`}
          delta={`${getDeltaPrefix(deltaScore)}${Math.abs(Math.round(deltaScore))}%`}
          deltaClassName={getDeltaColor(deltaScore)}
        />
        <SnapshotMetric
          label="Deep Work"
          value={data.thisWeekDeepWork}
          delta={`${getDeltaPrefix(deltaDeepWork)}${Math.abs(deltaDeepWork)}`}
          deltaClassName={getDeltaColor(deltaDeepWork)}
        />
      </div>

      {data.aiRecommendation && (
        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-mono text-text-muted">This week&apos;s focus</p>
          <p className="text-sm font-light leading-relaxed text-text-secondary">
            {data.aiRecommendation}
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-mono text-text-muted">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-light text-text-primary">{value}</p>
        <p className={`text-sm font-medium ${deltaClassName}`}>{delta}</p>
      </div>
    </div>
  );
}
