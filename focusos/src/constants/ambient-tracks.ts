import type { AmbientTrack } from "@/types/session.types";

export type MusicTrackId = "lofi-rain-01" | "soft-piano-01";

export type AmbientLoopId =
  | "rain"
  | "fireplace"
  | "cafe"
  | "forest-night";

export interface MusicTrack extends AmbientTrack {
  id: MusicTrackId;
  audioUrl: string;
  mood: string;
}

export interface AmbientLoop {
  id: AmbientLoopId;
  label: string;
  description: string;
  audioUrl: string;
  defaultVolume: number;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "lofi-rain-01",
    label: "Lo-fi rain study",
    category: "lofi",
    audioUrl: "/audio/music/lofi-rain-01.mp3",
    icon: "Lo",
    mood: "Warm lo-fi with soft rain texture",
  },
  {
    id: "soft-piano-01",
    label: "Soft piano focus",
    category: "lofi",
    audioUrl: "/audio/music/soft-piano-01.mp3",
    icon: "Pi",
    mood: "Slow piano for reading and writing",
  },
];

export const AMBIENT_LOOPS: AmbientLoop[] = [
  {
    id: "rain",
    label: "Rain on glass",
    description: "Soft rain on a study window",
    audioUrl: "/audio/ambient/rain-loop.mp3",
    defaultVolume: 48,
  },
  {
    id: "fireplace",
    label: "Fireplace",
    description: "Low cabin fire crackle",
    audioUrl: "/audio/ambient/fireplace-loop.mp3",
    defaultVolume: 34,
  },
  {
    id: "cafe",
    label: "Room tone",
    description: "Distant warm room ambience",
    audioUrl: "/audio/ambient/cafe-loop.mp3",
    defaultVolume: 30,
  },
  {
    id: "forest-night",
    label: "Forest air",
    description: "Quiet trees, night air, and low outdoor texture",
    audioUrl: "/audio/ambient/forest-night-loop.mp3",
    defaultVolume: 32,
  },
];

export const AMBIENT_TRACKS: AmbientTrack[] = MUSIC_TRACKS;

export const DEFAULT_MUSIC_ID: MusicTrackId = "lofi-rain-01";

export function getMusicTrack(id: string | null | undefined): MusicTrack {
  return (
    MUSIC_TRACKS.find((track) => track.id === id) ??
    MUSIC_TRACKS.find((track) => track.id === DEFAULT_MUSIC_ID) ??
    MUSIC_TRACKS[0]
  );
}

export function getAmbientLoop(id: AmbientLoopId): AmbientLoop {
  return AMBIENT_LOOPS.find((loop) => loop.id === id) ?? AMBIENT_LOOPS[0];
}
