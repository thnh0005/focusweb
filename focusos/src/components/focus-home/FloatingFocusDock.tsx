"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, FileText, Music2, Palette, Settings, TimerReset } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils/cn";

export type FlocusDockPanel = "sounds" | "theme" | "docs" | "stats" | null;

export interface FloatingFocusDockProps {
  activePanel: FlocusDockPanel;
  onPanelChange: (panel: FlocusDockPanel) => void;
}

export function FloatingFocusDock({
  activePanel,
  onPanelChange,
}: FloatingFocusDockProps) {
  const { t } = useTranslation("dashboard");

  return (
    <nav
      className="fixed inset-x-3 bottom-4 z-40 flex justify-center sm:bottom-6"
      aria-label={t("focusHome.dockAria")}
    >
      <div className="flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-[rgb(10_13_10/0.62)] p-1.5 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <DockButton
          icon={TimerReset}
          label={t("focusHome.dock.focus")}
          active={activePanel === null}
          onClick={() => onPanelChange(null)}
        />
        <DockButton
          icon={Music2}
          label={t("focusHome.dock.sounds")}
          active={activePanel === "sounds"}
          controls="dashboard-sounds-popover"
          onClick={() => onPanelChange(activePanel === "sounds" ? null : "sounds")}
        />
        <DockButton
          icon={Palette}
          label={t("focusHome.dock.theme")}
          active={activePanel === "theme"}
          controls="dashboard-theme-popover"
          onClick={() => onPanelChange(activePanel === "theme" ? null : "theme")}
        />
        <DockButton
          icon={FileText}
          label={t("focusHome.dock.docs")}
          active={activePanel === "docs"}
          controls="dashboard-docs-popover"
          onClick={() => onPanelChange(activePanel === "docs" ? null : "docs")}
        />
        <DockButton
          icon={BarChart3}
          label={t("focusHome.dock.stats")}
          active={activePanel === "stats"}
          controls="dashboard-stats-sheet"
          onClick={() => onPanelChange(activePanel === "stats" ? null : "stats")}
        />
        <DockLink href="/settings" icon={Settings} label={t("focusHome.dock.settings")} />
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
  controls,
  onClick,
}: {
  icon: DockIcon;
  label: string;
  active: boolean;
  controls?: string;
  onClick: () => void;
}) {
  const { t } = useTranslation("dashboard");

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
      aria-expanded={controls ? active : undefined}
      aria-controls={controls}
      aria-label={t(active ? "focusHome.dock.close" : "focusHome.dock.open", { label })}
    >
      <Icon className="h-4 w-4 stroke-[1.6]" aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
