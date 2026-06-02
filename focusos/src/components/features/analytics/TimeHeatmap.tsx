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
    if (score >= 85) return "bg-primary/70";
    if (score >= 70) return "bg-primary/50";
    if (score >= 55) return "bg-urgency-amber/55";
    if (score >= 40) return "bg-[rgb(200_138_101/0.48)]";
    return "bg-urgency-coral/45";
  };

  const getScoreForHourDay = (hour: number, day: string): number => {
    const entry = data.find((d) => d.hour === hour && d.day === day);
    return entry?.score ?? 0;
  };

  if (isLoading) {
    return (
      <Card className="rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-light text-text-primary">Peak focus hours</h3>
        <div className="h-80 rounded-2xl bg-white/[0.045] animate-pulse" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-light text-text-primary">Peak focus hours</h3>
        <div className="h-80 flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <p className="text-sm text-text-muted">No time-of-day data available yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl p-6 space-y-6">
      <div>
        <h3 className="text-lg font-light text-text-primary">Peak focus hours</h3>
        <p className="mt-1 text-xs text-text-muted">
          Higher opacity means stronger average focus. Each cell includes a text tooltip.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex gap-1">
            <div className="w-8" />
            {daysOfWeek.map((day) => (
              <div key={day} className="w-10 text-center">
                <p className="text-[9px] font-mono text-text-muted">{day}</p>
              </div>
            ))}
          </div>

          <div className="mt-2">
            {hours.map((hour) => (
              <div key={hour} className="flex items-center gap-1">
                <div className="w-8">
                  <p className="text-right text-[9px] font-mono text-text-muted">{hour}h</p>
                </div>
                {daysOfWeek.map((day) => {
                  const score = getScoreForHourDay(hour, day);
                  return (
                    <div
                      key={`${hour}-${day}`}
                      className="group relative h-6 w-10 rounded-md transition-all hover:ring-2 hover:ring-primary/60"
                      title={`${day} at ${hour}h: ${score > 0 ? `${Math.round(score)}/100` : "No data"}`}
                    >
                      <div
                        className={`h-full w-full rounded-md transition-all ${
                          score > 0 ? getScoreColor(score) : "bg-white/[0.045] hover:bg-white/[0.08]"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <LegendDot className="bg-primary/70" label="85+" />
        <LegendDot className="bg-urgency-amber/55" label="55-69" />
        <LegendDot className="bg-urgency-coral/45" label="<40" />
      </div>
    </Card>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-4 rounded ${className}`} />
      <span className="text-text-muted">{label}</span>
    </div>
  );
}
