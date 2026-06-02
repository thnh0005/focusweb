"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
      <Card className="rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-light text-text-primary">Distraction sources</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-2xl bg-white/[0.045] animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-light text-text-primary">Distraction sources</h3>
        <div className="h-40 flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <p className="text-sm text-text-muted">No distraction warnings recorded yet.</p>
        </div>
      </Card>
    );
  }

  const chartData = data.slice(0, 6).map((item) => ({
    name: item.domain.replace("www.", ""),
    warnings: item.warningCount,
  }));

  return (
    <Card className="rounded-3xl p-6 space-y-4">
      <div>
        <h3 className="text-lg font-light text-text-primary">Distraction sources</h3>
        <p className="mt-1 text-xs text-text-muted">Warning count by domain</p>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="name" stroke="rgba(246,241,223,0.34)" style={{ fontSize: "12px" }} />
          <YAxis stroke="rgba(246,241,223,0.34)" style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              background: "rgba(20, 24, 18, 0.96)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.72)" }}
          />
          <Bar dataKey="warnings" fill="rgb(200, 138, 101)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>

      <div className="space-y-2 pt-2">
        {data.slice(0, 5).map((source, idx) => (
          <div
            key={source.domain}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-3"
          >
            <div>
              <p className="text-sm font-medium text-text-primary">
                {idx + 1}. {source.domain}
              </p>
              <p className="text-xs text-text-muted">
                {source.sessionPercentage}% of sessions
              </p>
            </div>
            <p className="text-sm font-medium text-urgency-amber">
              {source.warningCount}x
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
