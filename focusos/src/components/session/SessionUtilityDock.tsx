"use client";

import * as React from "react";
import { FileText, Maximize2, Music2, Palette, StickyNote, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AmbientControls } from "@/components/features/focus/AmbientControls";
import { MusicPlayer } from "@/components/features/focus/MusicPlayer";
import { useMusicStore } from "@/stores/music.store";
import { cn } from "@/lib/utils/cn";

export interface SessionUtilityDockProps {
  noteOpen: boolean;
  docsOpen?: boolean;
  sceneOpen?: boolean;
  onToggleNote: () => void;
  onToggleDocs?: () => void;
  onToggleScene?: () => void;
  onToggleFullscreen?: () => void;
  className?: string;
}

export function SessionUtilityDock({
  noteOpen,
  docsOpen = false,
  sceneOpen = false,
  onToggleNote,
  onToggleDocs,
  onToggleScene,
  onToggleFullscreen,
  className,
}: SessionUtilityDockProps) {
  const { t } = useTranslation(["focus", "dashboard"]);
  const { currentTrack, playing } = useMusicStore();
  const [soundOpen, setSoundOpen] = React.useState(false);
  const currentTrackLabel = currentTrack
    ? t(`focusHome.sounds.tracks.${currentTrack.id}.label`, { ns: "dashboard" })
    : t("active.noAudio");

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-3xl border border-white/10 bg-[rgb(18_22_17/0.62)] p-3 shadow-glass backdrop-blur-glass sm:w-auto sm:min-w-[440px] lg:min-w-[520px]",
        className
      )}
      aria-label={t("active.utilities")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setSoundOpen((value) => !value)}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-text-primary transition-all duration-fast hover:bg-white/[0.1] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              soundOpen && "bg-primary/15 shadow-focus-purple"
            )}
            aria-label={soundOpen ? t("active.closeAudio") : t("active.openAudio")}
            title={soundOpen ? t("active.closeAudio") : t("active.openAudio")}
            aria-expanded={soundOpen}
          >
            <Music2 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {currentTrackLabel}
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-text-muted">
              {currentTrack
                ? playing
                  ? t("active.playingSoundscape")
                  : t("active.soundscapePaused")
                : t("active.soundscapeReady")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleDocs && (
            <UtilityButton
              onClick={onToggleDocs}
              active={docsOpen}
              label={docsOpen ? t("active.closeDocs") : t("active.openDocs")}
            >
              <FileText className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            </UtilityButton>
          )}
          {onToggleScene && (
            <UtilityButton
              onClick={onToggleScene}
              active={sceneOpen}
              label={sceneOpen ? t("active.closeTheme") : t("active.openTheme")}
            >
              <Palette className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            </UtilityButton>
          )}
          <UtilityButton
            onClick={onToggleNote}
            active={noteOpen}
            label={noteOpen ? t("active.closeNote") : t("active.openNote")}
          >
            <StickyNote className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </UtilityButton>
          {onToggleFullscreen && (
            <UtilityButton onClick={onToggleFullscreen} label={t("active.toggleFullscreen")}>
              <Maximize2 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            </UtilityButton>
          )}
        </div>
      </div>

      {soundOpen && (
        <div className="border-t border-white/[0.08] pt-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setSoundOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("active.closeAudio")}
              title={t("active.closeAudio")}
            >
              <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
            <MusicPlayer />
            <AmbientControls compact />
          </div>
        </div>
      )}
    </div>
  );
}

interface UtilityButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

function UtilityButton({
  active = false,
  label,
  className,
  children,
  ...props
}: UtilityButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-primary/15 text-text-primary",
        className
      )}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
