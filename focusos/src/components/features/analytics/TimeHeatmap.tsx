"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";

export interface TimeHeatmapData {
  hour: number;
  day: string;
  score: number;
  sessions: number;
}

export interface TimeHeatmapProps {
  data: TimeHeatmapData[];
  isLoading?: boolean;
}

export function TimeHeatmap({ data, isLoading = false }: TimeHeatmapProps) {
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-green-600/60";
    if (score >= 70) return "bg-green-500/60";
    if (score >= 55) return "bg-yellow-500/60";
    if (score >= 40) return "bg-orange-500/60";
    return "bg-red-500/60";
  };

  const getScoreForHourDay = (hour: number, day: string): number => {
    const entry = data.find((d) => d.hour === hour && d.day === day);
    return entry?.score ?? 0;
  };

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Peak Focus Hours (Hour × Day)
        </h3>
        <div className="h-80 bg-white/5 rounded-lg animate-pulse" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Peak Focus Hours (Hour × Day)
        </h3>
        <div className="h-80 flex items-center justify-center">
          <p className="text-text-muted">No data available yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Peak Focus Hours (Hour × Day)
        </h3>
        <p className="text-xs text-text-muted mb-4">
          Brighter = higher average focus score
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex gap-1">
            <div className="w-8" />
            {daysOfWeek.map((day) => (
              <div key={day} className="w-10 text-center">
                <p className="text-[9px] font-mono text-text-muted uppercase">
                  {day}
                </p>
              </div>
            ))}
          </div>

          {/* Heat grid */}
          <div className="mt-2">
            {hours.map((hour) => (
              <div key={hour} className="flex gap-1 items-center">
                <div className="w-8">
                  <p className="text-[9px] font-mono text-text-muted text-right">
                    {hour}h
                  </p>
                </div>
                {daysOfWeek.map((day) => {
                  const score = getScoreForHourDay(hour, day);
                  return (
                    <div
                      key={`${hour}-${day}`}
                      className="w-10 h-6 rounded-sm transition-all hover:ring-2 hover:ring-focus-purple cursor-pointer group"
                      title={`${day} at ${hour}h: ${score > 0 ? `${Math.round(score)}/100` : "No data"}`}
                    >
                      <div
                        className={`w-full h-full rounded-sm transition-all ${
                          score > 0
                            ? getScoreColor(score)
                            : "bg-white/5 hover:bg-white/10"
                        }`}
                      />
                      <div className="hidden group-hover:block absolute bg-black/80 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                        {score > 0
                          ? `${Math.round(score)}/100`
                          : "No data"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-600/60" />
          <span className="text-text-muted">85+</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500/60" />
          <span className="text-text-muted">55–69</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/60" />
          <span className="text-text-muted">&lt;40</span>
        </div>
      </div>
    </Card>
  );
}
