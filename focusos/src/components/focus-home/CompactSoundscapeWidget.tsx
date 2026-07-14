"use client";

import * as React from "react";
import { Music2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AmbientControls } from "@/components/features/focus/AmbientControls";
import { DashboardControlPopover } from "./DashboardControlPopover";

export interface CompactSoundscapeWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompactSoundscapeWidget({
  isOpen,
  onClose,
}: CompactSoundscapeWidgetProps) {
  const { t } = useTranslation("dashboard");
  if (!isOpen) return null;

  return (
    <DashboardControlPopover
      id="dashboard-sounds-popover"
      title={t("focusHome.sounds.title")}
      description={t("focusHome.sounds.description")}
      icon={<Music2 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />}
      onClose={onClose}
    >
      <AmbientControls className="mt-4 border-white/[0.08] bg-white/[0.035]" compact />
    </DashboardControlPopover>
  );
}
