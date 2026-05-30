"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Clock, Activity, Target, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
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
      colorClass: "text-focus-purple",
      bgClass: "bg-focus-purple/5 border-focus-purple/10",
      glowColor: "rgba(124, 58, 237, 0.2)",
    },
    {
      id: "sessions",
      label: "Active Sessions",
      value: String(stats?.totalSessions ?? 0),
      subcopy: `${stats?.deepWorkSessionCount ?? 0} deep work blocks`,
      icon: Activity,
      colorClass: "text-blue-400",
      bgClass: "bg-blue-500/5 border-blue-500/10",
      glowColor: "rgba(96, 165, 250, 0.15)",
    },
    {
      id: "focus-score",
      label: "Average Score",
      value: stats?.averageFocusScore ? `${Math.round(stats.averageFocusScore)}%` : "N/A",
      subcopy: stats?.completionRate ? `${Math.round(stats.completionRate)}% target completion` : "No sessions completed yet",
      icon: Target,
      colorClass: "text-green-400",
      bgClass: "bg-green-500/5 border-green-500/10",
      glowColor: "rgba(74, 222, 128, 0.15)",
    },
    {
      id: "streak",
      label: "Focus Streak",
      value: streakCount > 0 ? `${streakCount} Days` : "0 Days",
      subcopy: streakCount > 0 ? "Mindful streak is active!" : "Start a session to build a streak",
      icon: Flame,
      colorClass: "text-urgency-amber",
      bgClass: "bg-urgency-amber/5 border-urgency-amber/10",
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
            <Card 
              variant="glass-card" 
              className="border border-white/[0.04] bg-[#09090B]/60 backdrop-blur-md relative overflow-hidden group select-none hover:border-white/[0.08] transition-all duration-300"
            >
              {/* Subtle ambient glow matching the color scheme on card hover */}
              <div 
                className="absolute -right-16 -top-16 h-32 w-32 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                style={{ backgroundColor: item.glowColor }}
                aria-hidden="true"
              />

              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-text-muted tracking-wider uppercase select-none">
                      {item.label}
                    </span>
                    <h4 className="text-2xl font-light tracking-wide text-text-primary mt-1">
                      {item.value}
                    </h4>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${item.bgClass} ${item.colorClass}`}>
                    <Icon className="h-4.5 w-4.5 stroke-[1.5]" aria-hidden="true" />
                  </div>
                </div>
                
                <span className="text-xs text-text-muted font-light leading-none">
                  {item.subcopy}
                </span>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
