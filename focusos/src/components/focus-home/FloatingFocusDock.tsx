"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, FileText, Music2, Settings, TimerReset } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type FlocusDockPanel = "sounds" | "stats" | null;

export interface FloatingFocusDockProps {
  activePanel: FlocusDockPanel;
  onPanelChange: (panel: FlocusDockPanel) => void;
}

export function FloatingFocusDock({
  activePanel,
  onPanelChange,
}: FloatingFocusDockProps) {
  return (
    <nav
      className="fixed inset-x-3 bottom-4 z-40 flex justify-center sm:bottom-6"
      aria-label="Focus workspace"
    >
      <div className="flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-[rgb(10_13_10/0.62)] p-1.5 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <DockButton
          icon={TimerReset}
          label="Focus"
          active={activePanel === null}
          onClick={() => onPanelChange(null)}
        />
        <DockButton
          icon={Music2}
          label="Sounds"
          active={activePanel === "sounds"}
          onClick={() => onPanelChange(activePanel === "sounds" ? null : "sounds")}
        />
        <DockLink href="/study-tools" icon={FileText} label="AI Docs" />
        <DockButton
          icon={BarChart3}
          label="Stats"
          active={activePanel === "stats"}
          onClick={() => onPanelChange(activePanel === "stats" ? null : "stats")}
        />
        <DockLink href="/settings" icon={Settings} label="Settings" />
      </div>
    </nav>
  );
}

type DockIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function DockLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: DockIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-12 flex-col items-center gap-1 rounded-full px-2 py-2 text-[10px] text-text-muted transition-all hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-16 sm:px-3"
    >
      <Icon className="h-4 w-4 stroke-[1.6]" aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function DockButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: DockIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-12 flex-col items-center gap-1 rounded-full px-2 py-2 text-[10px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-16 sm:px-3",
        active
          ? "bg-white/[0.14] text-text-primary"
          : "text-text-muted hover:bg-white/[0.08] hover:text-text-primary"
      )}
      aria-pressed={active}
    >
      <Icon className="h-4 w-4 stroke-[1.6]" aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
