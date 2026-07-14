import { create } from "zustand";
import {
  AMBIENT_LOOPS,
  DEFAULT_MUSIC_ID,
  getAmbientLoop,
  getMusicTrack,
  type AmbientLoopId,
  type MusicTrackId,
  type MusicTrack,
} from "@/constants/ambient-tracks";
import {
  DEFAULT_SCENE_ID,
  getFocusScene,
  type FocusSceneId,
} from "@/constants/focus-scenes";
import { AudioManager } from "@/lib/audio/AudioManager";
import type { AmbientTrack } from "@/types/session.types";

type AmbientVolumeMap = Partial<Record<AmbientLoopId, number>>;

interface PersistedMusicState {
  currentSceneId: FocusSceneId;
  currentMusicId: MusicTrackId;
  volume: number;
  ambientVolumes: AmbientVolumeMap;
  isMuted: boolean;
}

export interface MusicState {
  currentTrack: MusicTrack | null;
  currentSceneId: FocusSceneId;
  currentMusicId: MusicTrackId;
  playing: boolean;
  volume: number;
  ambientVolumes: AmbientVolumeMap;
  isMuted: boolean;
  customPlaylistUrl: string | null;

  selectTrack: (track: AmbientTrack) => void;
  setMusic: (musicId: MusicTrackId) => void;
  setScene: (sceneId: FocusSceneId) => void;
  setCurrentSceneId: (sceneId: FocusSceneId) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setAmbientVolume: (ambientId: AmbientLoopId, volume: number) => void;
  toggleAmbient: (ambientId: AmbientLoopId) => void;
  setMuted: (muted: boolean) => void;
  setCustomPlaylist: (url: string) => void;
  stop: () => void;
}

const STORAGE_KEY = "focusos.study-with-me.audio";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sceneDefaultAmbientVolumes(sceneId: FocusSceneId): AmbientVolumeMap {
  const scene = getFocusScene(sceneId);
  return scene.ambientMix ?? { [scene.ambientId]: getAmbientLoop(scene.ambientId).defaultVolume };
}

function readPersistedState(): PersistedMusicState {
  const fallbackScene = getFocusScene(DEFAULT_SCENE_ID);
  const fallback: PersistedMusicState = {
    currentSceneId: fallbackScene.id,
    currentMusicId: fallbackScene.musicId ?? DEFAULT_MUSIC_ID,
    volume: 54,
    ambientVolumes: sceneDefaultAmbientVolumes(fallbackScene.id),
    isMuted: false,
  };

  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedMusicState>;
    const scene = getFocusScene(parsed.currentSceneId);
    const music = getMusicTrack(parsed.currentMusicId);

    return {
      currentSceneId: scene.id,
      currentMusicId: music.id,
      volume: typeof parsed.volume === "number" ? parsed.volume : fallback.volume,
      ambientVolumes: parsed.ambientVolumes ?? sceneDefaultAmbientVolumes(scene.id),
      isMuted: Boolean(parsed.isMuted),
    };
  } catch {
    return fallback;
  }
}

function persistState(state: MusicState) {
  if (!canUseStorage()) return;
  const payload: PersistedMusicState = {
    currentSceneId: state.currentSceneId,
    currentMusicId: state.currentMusicId,
    volume: state.volume,
    ambientVolumes: state.ambientVolumes,
    isMuted: state.isMuted,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

async function playCurrentMix(state: MusicState): Promise<boolean> {
  const music = getMusicTrack(state.currentMusicId);
  const playTasks: Promise<boolean>[] = [
    AudioManager.playMusic(music.id, music.audioUrl, state.volume),
  ];

  AMBIENT_LOOPS.forEach((loop) => {
    const loopVolume = state.ambientVolumes[loop.id] ?? 0;
    if (loopVolume > 0) {
      playTasks.push(AudioManager.playAmbient(loop.id, loop.audioUrl, loopVolume));
    } else {
      AudioManager.stopAmbient(loop.id);
    }
  });
  AudioManager.setMuted(state.isMuted);

  const results = await Promise.all(playTasks);
  return results.some(Boolean);
}

const initialState = readPersistedState();

export const useMusicStore = create<MusicState>((set, get) => ({
  currentTrack: getMusicTrack(initialState.currentMusicId),
  currentSceneId: initialState.currentSceneId,
  currentMusicId: initialState.currentMusicId,
  playing: false,
  volume: initialState.volume,
  ambientVolumes: initialState.ambientVolumes,
  isMuted: initialState.isMuted,
  customPlaylistUrl: null,

  selectTrack: (track) => {
    const music = getMusicTrack(track.id);
    set({ currentTrack: music, currentMusicId: music.id });
    persistState(get());
    if (get().playing) {
      void AudioManager.playMusic(music.id, music.audioUrl, get().volume).then((started) => {
        if (!started) set({ playing: false });
      });
    }
  },

  setMusic: (musicId) => {
    const music = getMusicTrack(musicId);
    set({ currentMusicId: music.id, currentTrack: music });
    persistState(get());
    if (get().playing) {
      void AudioManager.playMusic(music.id, music.audioUrl, get().volume).then((started) => {
        if (!started) set({ playing: false });
      });
    }
  },

  setCurrentSceneId: (sceneId) => {
    const scene = getFocusScene(sceneId);
    const music = getMusicTrack(scene.musicId);
    set({
      currentSceneId: scene.id,
      currentMusicId: music.id,
      currentTrack: music,
      ambientVolumes: sceneDefaultAmbientVolumes(scene.id),
    });
    persistState(get());
    if (get().playing) {
      void playCurrentMix(get()).then((started) => {
        if (!started) set({ playing: false });
      });
    }
  },

  setScene: (sceneId) => {
    get().setCurrentSceneId(sceneId);
  },

  togglePlay: async () => {
    const state = get();
    if (state.playing) {
      AudioManager.stop();
      set({ playing: false });
      return;
    }

    const started = await playCurrentMix(state);
    set({ playing: started });
  },

  setVolume: (volume) => {
    const safeVolume = Math.max(0, Math.min(100, volume));
    set({ volume: safeVolume });
    AudioManager.setMusicVolume(safeVolume);
    persistState(get());
  },

  setAmbientVolume: (ambientId, volume) => {
    const safeVolume = Math.max(0, Math.min(100, volume));
    set((state) => ({
      ambientVolumes: { ...state.ambientVolumes, [ambientId]: safeVolume },
    }));
    if (get().playing) {
      const loop = getAmbientLoop(ambientId);
      if (safeVolume > 0) {
        void AudioManager.playAmbient(loop.id, loop.audioUrl, safeVolume);
      } else {
        AudioManager.stopAmbient(loop.id);
      }
    }
    persistState(get());
  },

  toggleAmbient: (ambientId) => {
    const current = get().ambientVolumes[ambientId] ?? 0;
    const next = current > 0 ? 0 : getAmbientLoop(ambientId).defaultVolume;
    get().setAmbientVolume(ambientId, next);
  },

  setMuted: (muted) => {
    set({ isMuted: muted });
    AudioManager.setMuted(muted);
    persistState(get());
  },

  setCustomPlaylist: (url) => {
    set({ customPlaylistUrl: url });
  },

  stop: () => {
    AudioManager.stop();
    set({ playing: false });
  },
}));
