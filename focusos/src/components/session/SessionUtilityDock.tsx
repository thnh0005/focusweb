"use client";

import * as React from "react";
import { Maximize2, Music2, StickyNote, Volume2 } from "lucide-react";
import { useMusicStore } from "@/stores/music.store";
import { cn } from "@/lib/utils/cn";

export interface SessionUtilityDockProps {
  noteOpen: boolean;
  onToggleNote: () => void;
  onToggleFullscreen?: () => void;
  className?: string;
}

export function SessionUtilityDock({
  noteOpen,
  onToggleNote,
  onToggleFullscreen,
  className,
}: SessionUtilityDockProps) {
  const { currentTrack, playing, volume, togglePlay } = useMusicStore();

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-3xl border border-white/10 bg-[rgb(18_22_17/0.62)] p-3 shadow-glass backdrop-blur-glass sm:w-auto sm:min-w-[440px]",
        className
      )}
      aria-label="Session utilities"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!currentTrack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-text-primary transition-all duration-fast hover:bg-white/[0.1] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
            aria-label={playing ? "Pause music" : "Play music"}
            title={playing ? "Pause music" : "Play music"}
          >
            <Music2 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {currentTrack?.label || "No audio selected"}
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-text-muted">
              {currentTrack ? (playing ? "Playing" : "Paused") : "Music ready when a track exists"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <UtilityButton
            onClick={onToggleNote}
            active={noteOpen}
            label={noteOpen ? "Close note" : "Open note"}
          >
            <StickyNote className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </UtilityButton>
          {onToggleFullscreen && (
            <UtilityButton onClick={onToggleFullscreen} label="Toggle fullscreen">
              <Maximize2 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            </UtilityButton>
          )}
        </div>
      </div>

      {currentTrack && (
        <div className="flex items-center gap-3 border-t border-white/8 pt-3">
          <Volume2 className="h-4 w-4 shrink-0 text-text-muted stroke-[1.6]" aria-hidden="true" />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-primary transition-all duration-fast"
              style={{ width: `${volume}%` }}
            />
          </div>
          <span className="w-10 text-right text-[11px] font-mono text-text-muted">
            {volume}%
          </span>
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
