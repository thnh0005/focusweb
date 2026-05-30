"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/Card";
import type { DashboardStats } from "@/types/analytics.types";

export interface FocusTrendChartProps {
  data: Array<{ date: string; score: number; sessions: number }>;
  isLoading?: boolean;
}

export function FocusTrendChart({
  data,
  isLoading = false,
}: FocusTrendChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Focus Trend (Last 30 Days)
        </h3>
        <div className="h-80 bg-white/5 rounded-lg animate-pulse" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Focus Trend (Last 30 Days)
        </h3>
        <div className="h-80 flex items-center justify-center">
          <p className="text-text-muted">No data available yet</p>
        </div>
      </Card>
    );
  }

  const trend =
    data.length >= 2
      ? data[data.length - 1].score > data[0].score
        ? "up"
        : data[data.length - 1].score < data[0].score
          ? "down"
          : "flat"
      : "flat";

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-text-primary">
          Focus Trend (Last 30 Days)
        </h3>
        <div className="flex items-center gap-2">
          {trend === "up" && (
            <span className="text-green-400 text-sm font-medium">↑ Improving</span>
          )}
          {trend === "down" && (
            <span className="text-red-400 text-sm font-medium">↓ Declining</span>
          )}
          {trend === "flat" && (
            <span className="text-text-muted text-sm font-medium">→ Stable</span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.3)"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            stroke="rgba(255,255,255,0.3)"
            domain={[0, 100]}
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
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ fill: "#a855f7", r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
