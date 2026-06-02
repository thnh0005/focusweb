"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subcopy?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  glowColor?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  subcopyClassName?: string;
  iconClassName?: string;
  iconWrapClassName?: string;
}

export function MetricCard({
  label,
  value,
  subcopy,
  icon: Icon,
  glowColor,
  className,
  labelClassName,
  valueClassName,
  subcopyClassName,
  iconClassName,
  iconWrapClassName,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-subtle-border bg-bg-surface/80 p-5 transition-all duration-300",
        className
      )}
    >
      {glowColor && (
        <div
          className="absolute -right-16 -top-16 h-32 w-32 rounded-full blur-[40px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ backgroundColor: glowColor }}
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span
            className={cn(
              "text-[11px] font-medium uppercase tracking-wider text-text-muted",
              labelClassName
            )}
          >
            {label}
          </span>
          <div
            className={cn(
              "text-2xl font-light tracking-wide text-text-primary",
              valueClassName
            )}
          >
            {value}
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              "rounded-xl border border-subtle-border bg-bg-elevated p-2.5 text-text-secondary",
              iconWrapClassName
            )}
          >
            <Icon className={cn("h-4.5 w-4.5 stroke-[1.5]", iconClassName)} aria-hidden="true" />
          </div>
        )}
      </div>

      {subcopy && (
        <p className={cn("mt-4 text-xs font-light text-text-muted", subcopyClassName)}>
          {subcopy}
        </p>
      )}
    </div>
  );
}
