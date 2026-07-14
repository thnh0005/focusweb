"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Award, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import type { DashboardStats } from "@/types/analytics.types";

export interface DailySummaryProps {
  stats?: DashboardStats | null;
}

export function DailySummary({ stats }: DailySummaryProps) {
  const { t } = useTranslation("dashboard");
  const currentMinutes = stats?.totalFocusMinutes ?? 0;
  const dailyTargetMinutes = 90; // Default daily focus target
  const percentComplete = Math.min(100, Math.round((currentMinutes / dailyTargetMinutes) * 100));

  // Circular progress specs
  const radius = 50;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentComplete / 100) * circumference;

  return (
    <Card 
      variant="glass-card" 
      className="border border-white/[0.04] bg-surface-deep/40 backdrop-blur-md flex flex-col h-full hover:border-white/[0.06] transition-colors"
    >
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base font-light tracking-wide text-text-primary">
          {t("dailySummary.title")}
        </CardTitle>
        <CardDescription className="text-text-muted text-xs font-light">
          {t("dailySummary.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0 flex-1 flex flex-col items-center justify-center gap-6">
        {/* SVG Circular Progress Ring */}
        <div className="relative h-32 w-32 flex items-center justify-center select-none" aria-hidden="true">
          <svg className="h-full w-full rotate-[-90deg]">
            {/* Background Circle */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              className="stroke-white/[0.03] fill-transparent"
              strokeWidth={strokeWidth}
            />
            {/* Foreground Ring with Purple Glow */}
            <motion.circle
              cx="64"
              cy="64"
              r={radius}
              className="stroke-focus-purple fill-transparent drop-shadow-[0_0_8px_rgba(124,58,237,0.3)]"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              strokeLinecap="round"
            />
          </svg>
          
          <div className="absolute flex flex-col items-center text-center">
            <span className="text-[26px] font-extralight tracking-tight text-text-primary">
              {percentComplete}%
            </span>
            <span className="text-[9px] text-text-muted font-light tracking-wider uppercase select-none">
              {t("dailySummary.ofTarget")}
            </span>
          </div>
        </div>

        {/* Text Metrics & Copy */}
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center text-xs font-light border-b border-white/[0.04] pb-2">
            <span className="text-text-secondary flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-focus-purple stroke-[1.5]" />
              <span>{t("dailySummary.minutesFocus")}</span>
            </span>
            <span className="font-mono text-text-primary">
              {currentMinutes} / {dailyTargetMinutes}m
            </span>
          </div>
          
          <div className="flex justify-between items-center text-xs font-light">
            <span className="text-text-secondary flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-urgency-amber stroke-[1.5]" />
              <span>{t("dailySummary.completionRate")}</span>
            </span>
            <span className="font-mono text-text-primary">
              {stats?.completionRate ? `${Math.round(stats.completionRate)}%` : "0%"}
            </span>
          </div>

          <p className="text-[10px] text-text-muted font-light text-center leading-relaxed pt-1">
            {percentComplete >= 100
              ? t("dailySummary.complete")
              : t("dailySummary.remaining", { count: dailyTargetMinutes - currentMinutes })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
