"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, History, Music2, Play, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type FocusDockPanel = "stats" | "history" | null;

export interface FocusDockProps {
  activePanel: FocusDockPanel;
  onPanelChange: (panel: FocusDockPanel) => void;
  onStart: () => void;
  className?: string;
}

interface DockButtonProps {
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
  onClick?: () => void;
}

function DockButton({ label, icon: Icon, isActive, onClick }: DockButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-xs transition-colors focus-ring-soft",
        isActive
          ? "bg-focus-green/15 text-text-primary"
          : "text-text-secondary hover:bg-white/[0.06] hover:text-text-primary"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function FocusDock({
  activePanel,
  onPanelChange,
  onStart,
  className,
}: FocusDockProps) {
  return (
    <nav
      aria-label="Focus home controls"
      className={cn(
        "fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-[1.75rem] border border-white/10 bg-bg-void/80 p-2 shadow-ambient backdrop-blur-2xl",
        "max-w-[calc(100vw-1.5rem)] overflow-x-auto",
        className
      )}
    >
      <DockButton label="Focus" icon={Play} onClick={onStart} />
      <Link
        href="/settings/preferences"
        className="flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-xs text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-ring-soft"
      >
        <Music2 className="h-4 w-4" aria-hidden="true" />
        <span>Music</span>
      </Link>
      <DockButton
        label="Stats"
        icon={BarChart3}
        isActive={activePanel === "stats"}
        onClick={() => onPanelChange(activePanel === "stats" ? null : "stats")}
      />
      <DockButton
        label="History"
        icon={History}
        isActive={activePanel === "history"}
        onClick={() => onPanelChange(activePanel === "history" ? null : "history")}
      />
      <Link
        href="/settings"
        className="flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-xs text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-ring-soft"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        <span>Settings</span>
      </Link>
    </nav>
  );
}
