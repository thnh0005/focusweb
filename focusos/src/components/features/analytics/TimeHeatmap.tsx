"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";

const panelClassName =
  "min-w-0 overflow-hidden rounded-[1.75rem] border-white/10 bg-[rgb(10_13_10/0.56)] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6";

export interface TimeHeatmapData {
  hour: number;
  day: string;
  score: number;
  sessions: number;
}

export interface TimeHeatmapProps {
  data: TimeHeatmapData[];
  isLoading?: boolean;
  compact?: boolean;
}

export function TimeHeatmap({ data, isLoading = false, compact = false }: TimeHeatmapProps) {
  const { t } = useTranslation("analytics");
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = compact
    ? [6, 8, 10, 12, 14, 16, 18, 20, 22]
    : Array.from({ length: 24 }, (_, i) => i);

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

  const getDayLabel = (day: string) => t(`days.${day.toLowerCase()}`);

  if (isLoading) {
    return (
      <Card className={`${panelClassName} space-y-4`}>
        <h3 className="text-lg font-light text-text-primary">{t("charts.peakHours")}</h3>
        <div className={`${compact ? "h-40" : "h-80"} rounded-2xl bg-white/[0.045] animate-pulse`} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={`${panelClassName} space-y-4`}>
        <h3 className="text-lg font-light text-text-primary">{t("charts.peakHours")}</h3>
        <div className={`${compact ? "h-40" : "h-80"} flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]`}>
          <p className="text-sm text-text-muted">{t("empty.heatmap")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`${panelClassName} ${compact ? "space-y-3 p-4 sm:p-5" : "space-y-6"}`}>
      <div>
        <h3 className="text-lg font-light text-text-primary">{t("charts.peakHours")}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-text-muted">
          {t("charts.peakHoursDescription")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex gap-1">
            <div className="w-8" />
            {daysOfWeek.map((day) => (
              <div key={day} className="w-10 text-center">
                <p className="text-[9px] font-mono text-text-muted">{getDayLabel(day)}</p>
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
                      className={`${compact ? "h-4" : "h-6"} group relative w-10 rounded-md transition-all hover:ring-2 hover:ring-primary/60`}
                      title={t("charts.heatmapCell", {
                        day: getDayLabel(day),
                        hour,
                        value: score > 0 ? `${Math.round(score)}/100` : t("charts.noData"),
                      })}
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

      <div className="flex flex-wrap gap-3 text-xs">
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
