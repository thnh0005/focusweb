import type { AmbientLoopId, MusicTrackId } from "@/constants/ambient-tracks";

export type AudioEventType =
  | "session_start"
  | "session_end"
  | "break_start"
  | "break_end"
  | "task_complete";

type LoopId = MusicTrackId | AmbientLoopId | string;

interface ManagedLoop {
  id: LoopId;
  url: string;
  element: HTMLAudioElement;
  volume: number;
}

class AudioManagerSingleton {
  private static instance: AudioManagerSingleton | null = null;
  private context: AudioContext | null = null;
  private music: ManagedLoop | null = null;
  private ambientLoops = new Map<AmbientLoopId, ManagedLoop>();
  private ambientMasterVolume = 0.55;
  private eventVolume = 0.18;
  private muted = false;

  private constructor() {}

  static getInstance(): AudioManagerSingleton {
    if (!AudioManagerSingleton.instance) {
      AudioManagerSingleton.instance = new AudioManagerSingleton();
    }
    return AudioManagerSingleton.instance;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      this.context.resume().catch(() => undefined);
    }
    return this.context;
  }

  private createLoop(id: LoopId, url: string, volume: number): ManagedLoop | null {
    if (typeof Audio === "undefined") return null;

    const element = new Audio(url);
    element.loop = true;
    element.preload = "auto";
    element.volume = this.muted ? 0 : this.toUnitVolume(volume);

    element.addEventListener("error", () => {
      console.warn(`[AudioManager] Missing or unsupported audio asset: ${url}`);
    });

    return { id, url, element, volume };
  }

  private toUnitVolume(volume: number): number {
    return Math.max(0, Math.min(1, volume / 100));
  }

  private effectiveAmbientUnitVolume(volume: number): number {
    return this.toUnitVolume(volume * this.ambientMasterVolume);
  }

  private async playElement(loop: ManagedLoop, unitVolume?: number): Promise<boolean> {
    try {
      loop.element.volume = this.muted
        ? 0
        : unitVolume ?? this.toUnitVolume(loop.volume);
      await loop.element.play();
      return true;
    } catch (error) {
      console.warn("[AudioManager] Playback was blocked or unavailable:", error);
      return false;
    }
  }

  async playMusic(id: MusicTrackId, url: string, volume: number): Promise<boolean> {
    if (!url) return false;

    if (this.music && this.music.id !== id) {
      this.stopMusic();
    }

    if (!this.music || this.music.url !== url) {
      this.music = this.createLoop(id, url, volume);
    }

    if (!this.music) return false;
    this.music.volume = volume;
    return this.playElement(this.music);
  }

  stopMusic(): void {
    if (!this.music) return;
    this.music.element.pause();
    this.music.element.currentTime = 0;
    this.music = null;
  }

  setMusicVolume(volume: number): void {
    if (!this.music) return;
    this.music.volume = volume;
    this.music.element.volume = this.muted ? 0 : this.toUnitVolume(volume);
  }

  async playAmbient(id: AmbientLoopId, url: string, volume: number): Promise<boolean> {
    if (!url) return false;

    const existing = this.ambientLoops.get(id);
    if (existing && existing.url !== url) {
      this.stopAmbient(id);
    }

    let loop: ManagedLoop | null | undefined = this.ambientLoops.get(id);
    if (!loop) {
      loop = this.createLoop(id, url, volume);
      if (!loop) return false;
      this.ambientLoops.set(id, loop);
    }

    loop.volume = volume;
    const effectiveVolume = this.effectiveAmbientUnitVolume(volume);
    loop.element.volume = this.muted ? 0 : effectiveVolume;
    return this.playElement(loop, effectiveVolume);
  }

  stopAmbient(id: AmbientLoopId): void {
    const loop = this.ambientLoops.get(id);
    if (!loop) return;
    loop.element.pause();
    loop.element.currentTime = 0;
    this.ambientLoops.delete(id);
  }

  setAmbientLoopVolume(id: AmbientLoopId, volume: number): void {
    const loop = this.ambientLoops.get(id);
    if (!loop) return;
    loop.volume = volume;
    loop.element.volume = this.muted ? 0 : this.effectiveAmbientUnitVolume(volume);
  }

  setAmbientVolume(volume: number): void {
    this.ambientMasterVolume = this.toUnitVolume(volume);
    this.eventVolume = this.ambientMasterVolume * 0.3;
    this.ambientLoops.forEach((loop) => {
      loop.element.volume = this.muted ? 0 : this.effectiveAmbientUnitVolume(loop.volume);
    });
  }

  getAmbientVolume(): number {
    return Math.round(this.ambientMasterVolume * 100);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;

    if (this.music) {
      this.music.element.volume = muted ? 0 : this.toUnitVolume(this.music.volume);
    }
    this.ambientLoops.forEach((loop) => {
      loop.element.volume = muted ? 0 : this.effectiveAmbientUnitVolume(loop.volume);
    });
  }

  isMuted(): boolean {
    return this.muted;
  }

  async playEventSound(type: AudioEventType): Promise<void> {
    if (this.muted) return;

    const soundPaths: Record<AudioEventType, string> = {
      session_start: "/sounds/session-start.mp3",
      session_end: "/sounds/session-end.mp3",
      break_start: "/sounds/break-start.mp3",
      break_end: "/sounds/break-end.mp3",
      task_complete: "/sounds/task-complete.mp3",
    };

    try {
      const ctx = this.ensureContext();
      if (!ctx) return;

      const response = await fetch(soundPaths[type]);
      if (!response.ok) return;

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = audioBuffer;
      gainNode.gain.value = this.eventVolume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();
    } catch (error) {
      console.debug("[AudioManager] Event sound failed:", error);
    }
  }

  stop(): void {
    this.stopMusic();
    Array.from(this.ambientLoops.keys()).forEach((id) => this.stopAmbient(id));
  }

  dispose(): void {
    this.stop();
    if (this.context) {
      this.context.close().catch(() => undefined);
      this.context = null;
    }
  }
}

export const AudioManager = AudioManagerSingleton.getInstance();
