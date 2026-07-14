"use client";

import * as React from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getFocusScene } from "@/constants/focus-scenes";
import { useMusicStore } from "@/stores/music.store";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/Card";

export interface MusicPlayerProps {
  className?: string;
}

export function MusicPlayer({ className }: MusicPlayerProps) {
  const { t } = useTranslation("dashboard");
  const currentTrack = useMusicStore((state) => state.currentTrack);
  const currentSceneId = useMusicStore((state) => state.currentSceneId);
  const playing = useMusicStore((state) => state.playing);
  const volume = useMusicStore((state) => state.volume);
  const isMuted = useMusicStore((state) => state.isMuted);
  const togglePlay = useMusicStore((state) => state.togglePlay);
  const setVolume = useMusicStore((state) => state.setVolume);
  const setMuted = useMusicStore((state) => state.setMuted);
  const scene = getFocusScene(currentSceneId);

  if (!currentTrack) return null;

  const trackLabel = t(`focusHome.sounds.tracks.${currentTrack.id}.label`);
  const trackMood = t(`focusHome.sounds.tracks.${currentTrack.id}.mood`);

  return (
    <Card
      className={cn(
        "border-white/10 bg-black/[0.24] p-3 shadow-none backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted">
            {t("focusHome.sounds.nowPlaying")}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-text-primary">
            {trackLabel}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {scene.name} · {trackMood}
          </p>
        </div>

        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-text-primary transition-all duration-fast hover:bg-white/[0.12] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            playing && "shadow-focus-purple"
          )}
          aria-label={playing ? t("focusHome.sounds.pause") : t("focusHome.sounds.play")}
        >
          {playing ? (
            <Pause className="h-4 w-4 stroke-[1.7]" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4 stroke-[1.7]" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMuted(!isMuted)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isMuted ? t("focusHome.sounds.unmute") : t("focusHome.sounds.mute")}
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5 stroke-[1.7]" aria-hidden="true" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 stroke-[1.7]" aria-hidden="true" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.12] accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("focusHome.sounds.musicVolume", { volume })}
        />
        <span className="w-9 text-right text-[11px] font-mono text-text-muted">
          {volume}%
        </span>
      </div>
    </Card>
  );
}
