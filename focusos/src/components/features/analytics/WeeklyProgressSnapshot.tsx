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
    if (delta > 0) return "text-green-400";
    if (delta < 0) return "text-red-400";
    return "text-text-muted";
  };

  const getDeltaArrow = (delta: number) => {
    if (delta > 0) return "↑";
    if (delta < 0) return "↓";
    return "→";
  };

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <div className="h-40 bg-white/5 rounded-lg animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6 bg-gradient-to-br from-focus-purple/10 to-transparent border-focus-purple/30">
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          Weekly Progress
        </h3>
        <p className="text-xs text-text-muted mt-1">This week vs. last week</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Focus Hours */}
        <div className="space-y-2">
          <p className="text-xs text-text-muted font-mono uppercase">
            Total Hours
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-light text-text-primary">
              {data.thisWeekHours.toFixed(1)}h
            </p>
            <p className={`text-sm font-medium ${getDeltaColor(deltaHours)}`}>
              {getDeltaArrow(deltaHours)}{" "}
              {Math.abs(deltaHours).toFixed(1)}h
            </p>
          </div>
        </div>

        {/* Avg Score */}
        <div className="space-y-2">
          <p className="text-xs text-text-muted font-mono uppercase">
            Avg Score
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-light text-text-primary">
              {Math.round(data.thisWeekScore)}%
            </p>
            <p className={`text-sm font-medium ${getDeltaColor(deltaScore)}`}>
              {getDeltaArrow(deltaScore)} {Math.abs(Math.round(deltaScore))}%
            </p>
          </div>
        </div>

        {/* Deep Work */}
        <div className="space-y-2">
          <p className="text-xs text-text-muted font-mono uppercase">
            Deep Work
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-light text-text-primary">
              {data.thisWeekDeepWork}
            </p>
            <p className={`text-sm font-medium ${getDeltaColor(deltaDeepWork)}`}>
              {getDeltaArrow(deltaDeepWork)} {Math.abs(deltaDeepWork)}
            </p>
          </div>
        </div>
      </div>

      {/* AI Recommendation */}
      {data.aiRecommendation && (
        <div className="pt-4 border-t border-focus-purple/30">
          <p className="text-xs text-text-muted font-mono uppercase mb-2">
            This Week&apos;s Focus
          </p>
          <p className="text-sm text-text-secondary font-light leading-relaxed">
            {data.aiRecommendation}
          </p>
        </div>
      )}
    </Card>
  );
}
