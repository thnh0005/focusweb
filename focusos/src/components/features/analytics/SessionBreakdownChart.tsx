"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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
    { name: "Normal Mode", value: normalMode, color: "rgb(143, 176, 162)" },
    { name: "Deep Work", value: deepWorkMode, color: "rgb(124, 171, 145)" },
  ];

  if (isLoading) {
    return (
      <Card className="rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-light text-text-primary">Session breakdown</h3>
        <div className="h-40 rounded-2xl bg-white/[0.045] animate-pulse" />
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card className="rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-light text-text-primary">Session breakdown</h3>
        <div className="h-40 flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <p className="text-sm text-text-muted">No sessions yet</p>
        </div>
      </Card>
    );
  }

  const normalPercent = ((normalMode / total) * 100).toFixed(0);
  const deepPercent = ((deepWorkMode / total) * 100).toFixed(0);

  return (
    <Card className="rounded-3xl p-6 space-y-6">
      <h3 className="text-lg font-light text-text-primary">Session breakdown</h3>

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <ResponsiveContainer width={250} height={250}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(20, 24, 18, 0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.72)" }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex flex-col justify-center gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Normal Mode</p>
            <p className="mt-1 text-2xl font-light text-text-primary">{normalMode}</p>
            <p className="mt-1 text-xs text-text-muted">{normalPercent}% of total</p>
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Deep Work</p>
            <p className="mt-1 text-2xl font-light text-primary">{deepWorkMode}</p>
            <p className="mt-1 text-xs text-text-muted">{deepPercent}% of total</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
