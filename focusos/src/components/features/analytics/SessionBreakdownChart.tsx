"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/Card";

export interface SessionBreakdownProps {
  normalMode: number;
  deepWorkMode: number;
  isLoading?: boolean;
}

export function SessionBreakdownChart({
  normalMode,
  deepWorkMode,
  isLoading = false,
}: SessionBreakdownProps) {
  const total = normalMode + deepWorkMode;

  const data = [
    { name: "Normal Mode", value: normalMode, color: "#6366f1" },
    { name: "Deep Work", value: deepWorkMode, color: "#a855f7" },
  ];

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Session Breakdown
        </h3>
        <div className="h-40 bg-white/5 rounded-lg animate-pulse" />
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-text-primary">
          Session Breakdown
        </h3>
        <div className="h-40 flex items-center justify-center">
          <p className="text-text-muted">No sessions yet</p>
        </div>
      </Card>
    );
  }

  const normalPercent = ((normalMode / total) * 100).toFixed(0);
  const deepPercent = ((deepWorkMode / total) * 100).toFixed(0);

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-lg font-medium text-text-primary">
        Session Breakdown
      </h3>

      <div className="flex gap-8">
        <ResponsiveContainer width={250} height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(17, 24, 39, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex flex-col justify-center gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Normal Mode</p>
            <p className="text-2xl font-light text-text-primary mt-1">
              {normalMode}
            </p>
            <p className="text-xs text-text-muted mt-1">{normalPercent}% of total</p>
          </div>

          <div>
            <p className="text-sm font-medium text-focus-purple">Deep Work</p>
            <p className="text-2xl font-light text-focus-purple mt-1">
              {deepWorkMode}
            </p>
            <p className="text-xs text-text-muted mt-1">{deepPercent}% of total</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
