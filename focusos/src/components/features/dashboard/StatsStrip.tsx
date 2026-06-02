"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Clock, Activity, Target, Flame } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import type { DashboardStats } from "@/types/analytics.types";

export interface StatsStripProps {
  stats?: DashboardStats | null;
  streakCount?: number;
}

export function StatsStrip({ stats, streakCount = 0 }: StatsStripProps) {
  const totalMinutes = stats?.totalFocusMinutes ?? 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const items = [
    {
      id: "focus-time",
      label: "Focus Duration",
      value: durationLabel,
      subcopy: "Today's deep work blocks",
      icon: Clock,
      iconClassName: "text-focus-purple",
      iconWrapClassName: "border-focus-purple/10 bg-focus-purple/5",
      glowColor: "rgba(124, 58, 237, 0.2)",
    },
    {
      id: "sessions",
      label: "Active Sessions",
      value: String(stats?.totalSessions ?? 0),
      subcopy: `${stats?.deepWorkSessionCount ?? 0} deep work blocks`,
      icon: Activity,
      iconClassName: "text-blue-400",
      iconWrapClassName: "border-blue-500/10 bg-blue-500/5",
      glowColor: "rgba(96, 165, 250, 0.15)",
    },
    {
      id: "focus-score",
      label: "Average Score",
      value: stats?.averageFocusScore ? `${Math.round(stats.averageFocusScore)}%` : "N/A",
      subcopy: stats?.completionRate ? `${Math.round(stats.completionRate)}% target completion` : "No sessions completed yet",
      icon: Target,
      iconClassName: "text-green-400",
      iconWrapClassName: "border-green-500/10 bg-green-500/5",
      glowColor: "rgba(74, 222, 128, 0.15)",
    },
    {
      id: "streak",
      label: "Focus Streak",
      value: streakCount > 0 ? `${streakCount} Days` : "0 Days",
      subcopy: streakCount > 0 ? "Mindful streak is active!" : "Start a session to build a streak",
      icon: Flame,
      iconClassName: "text-urgency-amber",
      iconWrapClassName: "border-urgency-amber/10 bg-urgency-amber/5",
      glowColor: "rgba(245, 158, 11, 0.2)",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <MetricCard
              label={item.label}
              value={item.value}
              subcopy={item.subcopy}
              icon={Icon}
              glowColor={item.glowColor}
              iconClassName={item.iconClassName}
              iconWrapClassName={item.iconWrapClassName}
              className="select-none"
            />
          </motion.div>
        );
      })}
    </div>
  );
}
