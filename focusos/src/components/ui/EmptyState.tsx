import * as React from "react";
import { Sparkles, CalendarRange, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  preset?: "tasks" | "habits" | "stats";
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  className,
  preset,
  title,
  description,
  actionText,
  onAction,
  icon,
  ...props
}: EmptyStateProps) {
  // If presets are chosen, override with custom design1.md requirements
  let displayTitle = title;
  let displayDescription = description;
  let displayIcon = icon;

  if (preset === "tasks") {
    displayTitle = displayTitle || "Focus list clear";
    displayDescription =
      displayDescription || "Your focus list is clear ✦ Add what matters today";
    displayIcon = displayIcon || <Sparkles className="h-6 w-6 text-focus-purple-muted stroke-[1.5]" />;
  } else if (preset === "habits") {
    displayTitle = displayTitle || "Begin your habits";
    displayDescription =
      displayDescription || "Track your first habit — small wins compound";
    displayIcon = displayIcon || <CalendarRange className="h-6 w-6 text-focus-green stroke-[1.5]" />;
  } else if (preset === "stats") {
    displayTitle = displayTitle || "Your journey starts here";
    displayDescription =
      displayDescription ||
      "Every minute of deep work will paint your sky.";
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-3xl glass-card relative overflow-hidden select-none min-h-[220px]",
        preset === "stats" && "border border-white/5 shadow-glass",
        className
      )}
      {...props}
    >
      {/* Dynamic Cosmic Constellation Background for Stats */}
      {preset === "stats" && (
        <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
          <svg
            className="w-full h-full text-white/10"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 400 200"
          >
            {/* Constellation lines */}
            <line x1="80" y1="50" x2="160" y2="90" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" />
            <line x1="160" y1="90" x2="240" y2="40" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" />
            <line x1="240" y1="40" x2="320" y2="120" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" />
            <line x1="160" y1="90" x2="200" y2="150" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" />

            {/* Stars */}
            <circle cx="80" cy="50" r="3" className="fill-focus-purple animate-pulse" />
            <circle cx="160" cy="90" r="4" className="fill-white" />
            <circle cx="240" cy="40" r="3.5" className="fill-ambient-cyan animate-pulse" />
            <circle cx="320" cy="120" r="4.5" className="fill-focus-green" />
            <circle cx="200" cy="150" r="2.5" className="fill-urgency-amber" />
          </svg>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center max-w-sm">
        {/* Render icon if provided or derived from preset */}
        {displayIcon && (
          <div className="mb-4 flex items-center justify-center p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            {displayIcon}
          </div>
        )}

        {/* Title */}
        <h4 className="text-base font-light tracking-tight text-text-primary mb-1.5 uppercase tracking-wider font-sans">
          {displayTitle}
        </h4>

        {/* Description */}
        <p className="text-sm font-light text-text-secondary leading-relaxed px-4">
          {displayDescription}
        </p>

        {/* Call to action */}
        {onAction && actionText && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onAction}
            className="mt-6 border border-white/10 hover:bg-white/10"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5 stroke-[2.5]" />
            {actionText}
          </Button>
        )}
      </div>
    </div>
  );
}
