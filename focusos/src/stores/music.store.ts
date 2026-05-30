import { create } from "zustand";
import { AudioManager } from "@/lib/audio/AudioManager";
import type { AmbientTrack } from "@/types/session.types";

export interface MusicState {
  currentTrack: AmbientTrack | null;
  playing: boolean;
  volume: number; // 0–100
  customPlaylistUrl: string | null;

  // Actions
  selectTrack: (track: AmbientTrack) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setCustomPlaylist: (url: string) => void;
  stop: () => void;
}

// Keep an HTMLAudioElement instance active inside a closure on the client side.
let ambientAudio: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!ambientAudio) {
    ambientAudio = new Audio();
    ambientAudio.loop = true;
  }
  return ambientAudio;
}

export const useMusicStore = create<MusicState>((set, get) => ({
  currentTrack: null,
  playing: false,
  volume: 50,
  customPlaylistUrl: null,

  selectTrack: (track) => {
    const audio = getAudioElement();
    if (!audio) return;

    const wasPlaying = get().playing;

    // Stop current play
    audio.pause();

    set({ currentTrack: track });

    if (track.audioUrl) {
      audio.src = track.audioUrl;
      audio.volume = get().volume / 100;
      
      if (wasPlaying) {
        audio.play().catch((err) => {
          console.warn("[MusicStore] Auto-play failed on track change:", err);
          set({ playing: false });
        });
      }
    } else {
      audio.src = "";
    }
  },

  togglePlay: () => {
    const audio = getAudioElement();
    if (!audio) return;

    const { playing, currentTrack } = get();

    if (playing) {
      audio.pause();
      set({ playing: false });
    } else {
      if (currentTrack?.audioUrl) {
        audio.volume = get().volume / 100;
        audio.play()
          .then(() => {
            set({ playing: true });
          })
          .catch((err) => {
            console.warn("[MusicStore] Playback blocked by browser policy:", err);
          });
      } else {
        // If playing is toggled without track, do nothing
        console.warn("[MusicStore] No track selected to play");
      }
    }
  },

  setVolume: (volume) => {
    const audio = getAudioElement();
    if (audio) {
      audio.volume = volume / 100;
    }
    // Also sync volume down to our central AudioManager singleton
    AudioManager.setAmbientVolume(volume);
    set({ volume });
  },

  setCustomPlaylist: (url) => {
    set({ customPlaylistUrl: url });
  },

  stop: () => {
    const audio = getAudioElement();
    if (audio) {
      audio.pause();
    }
    // Sync stop call to AudioManager
    AudioManager.stop();
    set({ playing: false });
  },
}));
