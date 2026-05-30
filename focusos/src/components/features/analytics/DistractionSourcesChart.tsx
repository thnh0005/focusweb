"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/Card";

export interface DistractionSource {
  domain: string;
  warningCount: number;
  sessionPercentage: number;
}

export interface DistractionSourcesChartProps {
  data: DistractionSource[];
  isLoading?: boolean;
}

export function DistractionSourcesChart({
  data,
  isLoading = false,
}: DistractionSourcesChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Top Distraction Sources
        </h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Top Distraction Sources
        </h3>
        <div className="h-40 flex items-center justify-center">
          <p className="text-text-muted">No distraction data yet</p>
        </div>
      </Card>
    );
  }

  const chartData = data.slice(0, 6).map((item) => ({
    name: item.domain.replace("www.", ""),
    warnings: item.warningCount,
  }));

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-medium text-text-primary">
        Top Distraction Sources
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="name"
            stroke="rgba(255,255,255,0.3)"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            stroke="rgba(255,255,255,0.3)"
            style={{ fontSize: "12px" }}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(17, 24, 39, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
          />
          <Bar
            dataKey="warnings"
            fill="#ef4444"
            radius={[8, 8, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="space-y-2 mt-6">
        {data.slice(0, 5).map((source, idx) => (
          <div
            key={source.domain}
            className="flex items-center justify-between p-2 rounded-lg bg-white/5"
          >
            <div>
              <p className="text-sm font-medium text-text-primary">
                {idx + 1}. {source.domain}
              </p>
              <p className="text-xs text-text-muted">
                {source.sessionPercentage}% of sessions
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-red-400">
                {source.warningCount}x
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
