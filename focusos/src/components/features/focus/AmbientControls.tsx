"use client";

import * as React from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { AMBIENT_LOOPS, MUSIC_TRACKS, type AmbientLoopId } from "@/constants/ambient-tracks";
import { useMusicStore } from "@/stores/music.store";
import { cn } from "@/lib/utils/cn";

export interface AmbientControlsProps {
  className?: string;
  compact?: boolean;
}

export function AmbientControls({ className, compact = false }: AmbientControlsProps) {
  const currentMusicId = useMusicStore((state) => state.currentMusicId);
  const playing = useMusicStore((state) => state.playing);
  const volume = useMusicStore((state) => state.volume);
  const ambientVolumes = useMusicStore((state) => state.ambientVolumes);
  const isMuted = useMusicStore((state) => state.isMuted);
  const setMusic = useMusicStore((state) => state.setMusic);
  const togglePlay = useMusicStore((state) => state.togglePlay);
  const setVolume = useMusicStore((state) => state.setVolume);
  const setAmbientVolume = useMusicStore((state) => state.setAmbientVolume);
  const toggleAmbient = useMusicStore((state) => state.toggleAmbient);
  const setMuted = useMusicStore((state) => state.setMuted);

  return (
    <div
      className={cn(
        "space-y-3 rounded-[1.4rem] border border-white/10 bg-black/[0.22] p-3 shadow-none backdrop-blur-xl",
        compact && "space-y-2 p-2.5",
        className
      )}
      aria-label="Audio controls"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted">
            Soundscape
          </p>
          <p className="mt-1 text-sm font-medium text-text-primary">
            Music and ambient layers
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMuted(!isMuted)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isMuted ? "Unmute all audio" : "Mute all audio"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 stroke-[1.7]" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 stroke-[1.7]" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-text-primary transition-all duration-fast hover:bg-white/[0.11] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              playing && "shadow-focus-purple"
            )}
            aria-label={playing ? "Pause audio" : "Play audio"}
          >
            {playing ? (
              <Pause className="h-4 w-4 stroke-[1.7]" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4 stroke-[1.7]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {MUSIC_TRACKS.map((track) => (
          <button
            key={track.id}
            type="button"
            onClick={() => setMusic(track.id)}
            className={cn(
              "rounded-2xl border px-3 py-2 text-left transition-all duration-fast active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              currentMusicId === track.id
                ? "border-primary/[0.45] bg-primary/15 text-text-primary"
                : "border-white/10 bg-white/[0.045] text-text-secondary hover:bg-white/[0.075] hover:text-text-primary"
            )}
            aria-pressed={currentMusicId === track.id}
          >
            <span className="block text-xs font-medium">{track.label}</span>
            <span className="mt-0.5 block truncate text-[10px] text-text-muted">
              {track.mood}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/[0.08] pt-3">
        <span className="w-16 text-[10px] font-mono uppercase tracking-[0.12em] text-text-muted">
          Music
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.12] accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Music volume ${volume}%`}
        />
        <span className="w-9 text-right text-[11px] font-mono text-text-muted">
          {volume}%
        </span>
      </div>

      <div className="space-y-2">
        {AMBIENT_LOOPS.map((loop) => {
          const loopVolume = ambientVolumes[loop.id] ?? 0;
          const active = loopVolume > 0;

          return (
            <AmbientLoopControl
              key={loop.id}
              id={loop.id}
              label={loop.label}
              description={loop.description}
              volume={loopVolume}
              active={active}
              onToggle={() => toggleAmbient(loop.id)}
              onVolumeChange={(nextVolume) => setAmbientVolume(loop.id, nextVolume)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface AmbientLoopControlProps {
  id: AmbientLoopId;
  label: string;
  description: string;
  volume: number;
  active: boolean;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
}

function AmbientLoopControl({
  id,
  label,
  description,
  volume,
  active,
  onToggle,
  onVolumeChange,
}: AmbientLoopControlProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-2.5 transition-all duration-fast",
        active
          ? "border-white/[0.16] bg-white/[0.07]"
          : "border-white/[0.08] bg-white/[0.03]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-pressed={active}
          aria-label={`${active ? "Disable" : "Enable"} ${label}`}
        >
          <span className="block truncate text-xs font-medium text-text-primary">
            {label}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-text-muted">
            {description}
          </span>
        </button>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[10px] font-mono",
            active
              ? "bg-primary/15 text-primary"
              : "bg-white/[0.05] text-text-muted"
          )}
        >
          {active ? "On" : "Off"}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={`ambient-${id}`}
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.12] accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${label} volume ${volume}%`}
        />
        <span className="w-8 text-right text-[10px] font-mono text-text-muted">
          {volume}%
        </span>
      </div>
    </div>
  );
}
