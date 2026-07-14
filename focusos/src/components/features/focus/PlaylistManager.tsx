"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { useMusicStore } from "@/stores/music.store";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/Card";
import type { AmbientTrack } from "@/types/session.types";

const TRACK_CATEGORIES = {
  lofi: { label: "Lo-Fi", icon: "🎵", color: "text-blue-400" },
  rain: { label: "Rain", icon: "🌧", color: "text-cyan-400" },
  nature: { label: "Nature", icon: "🌿", color: "text-green-400" },
  cafe: { label: "Café", icon: "☕", color: "text-amber-400" },
  whitenoise: { label: "White Noise", icon: "〰", color: "text-gray-400" },
  custom: { label: "Custom", icon: "🎧", color: "text-purple-400" },
};

export interface PlaylistManagerProps {
  tracks: AmbientTrack[];
  onSelectTrack: (track: AmbientTrack) => void;
}

export function PlaylistManager({
  tracks,
  onSelectTrack,
}: PlaylistManagerProps) {
  const { t } = useTranslation("focus");
  const { currentTrack } = useMusicStore();

  const grouped = React.useMemo(() => {
    const groups: Record<string, AmbientTrack[]> = {};
    tracks.forEach((track) => {
      if (!groups[track.category]) {
        groups[track.category] = [];
      }
      groups[track.category].push(track);
    });
    return groups;
  }, [tracks]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-light text-text-primary">{t("playlist.title")}</h2>

      <div className="space-y-4">
        {Object.entries(TRACK_CATEGORIES).map(([category, meta]) => {
          const categoryTracks = grouped[category] || [];
          if (categoryTracks.length === 0) return null;

          return (
            <div key={category} className="space-y-2">
              <p className="text-xs text-text-muted font-mono uppercase tracking-wide">
                {meta.icon} {t(`playlist.categories.${category}`)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {categoryTracks.map((track) => (
                  <Card
                    key={track.id}
                    onClick={() => onSelectTrack(track)}
                    className={cn(
                      "p-3 cursor-pointer transition-all duration-fast",
                      "hover:bg-white/8 hover:border-text-secondary/50",
                      currentTrack?.id === track.id
                        ? "border-focus-purple/50 bg-focus-purple/10"
                        : "border-subtle-border"
                    )}
                  >
                    <p className="text-sm font-medium text-text-primary">
                      {track.label}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {track.category}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
