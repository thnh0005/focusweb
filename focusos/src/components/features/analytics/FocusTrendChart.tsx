"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";

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
      <Card className="rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-light text-text-primary">Focus trend</h3>
        <div className="h-80 rounded-2xl bg-white/[0.045] animate-pulse" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-light text-text-primary">Focus trend</h3>
        <div className="flex h-80 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <p className="text-sm text-text-muted">Complete more sessions to see the trend line.</p>
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
    <Card className="rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-light text-text-primary">Focus trend</h3>
          <p className="mt-1 text-xs text-text-muted">Average score across completed sessions</p>
        </div>
        {trend === "up" && <span className="text-sm font-medium text-primary">Improving</span>}
        {trend === "down" && <span className="text-sm font-medium text-urgency-amber">Drifting</span>}
        {trend === "flat" && <span className="text-sm font-medium text-text-muted">Stable</span>}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="date" stroke="rgba(246,241,223,0.34)" style={{ fontSize: "12px" }} />
          <YAxis stroke="rgba(246,241,223,0.34)" domain={[0, 100]} style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              background: "rgba(20, 24, 18, 0.96)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.72)" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="rgb(124, 171, 145)"
            strokeWidth={2}
            dot={{ fill: "rgb(124, 171, 145)", r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
