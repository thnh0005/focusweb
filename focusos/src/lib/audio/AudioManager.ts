// ═══════════════════════════════════════════════════════════════
// AudioManager — FocusOS
// Singleton Web Audio API manager for ambient sound playback
// Design: design1.md §11 Sound Event Mapping
// ═══════════════════════════════════════════════════════════════

export type AudioEventType =
  | "session_start"
  | "session_end"
  | "break_start"
  | "break_end"
  | "task_complete";

interface AudioManagerState {
  ambientVolume: number;    // 0–1
  eventVolume: number;      // 0–1 (30% of ambientVolume per spec)
  isMuted: boolean;
  currentAmbientUrl: string | null;
}

class AudioManagerSingleton {
  private static instance: AudioManagerSingleton | null = null;
  private context: AudioContext | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private state: AudioManagerState = {
    ambientVolume: 0.6,
    eventVolume: 0.18,  // 30% of 0.6
    isMuted: false,
    currentAmbientUrl: null,
  };

  private constructor() {}

  static getInstance(): AudioManagerSingleton {
    if (!AudioManagerSingleton.instance) {
      AudioManagerSingleton.instance = new AudioManagerSingleton();
    }
    return AudioManagerSingleton.instance;
  }

  /**
   * Lazy-initialize Web Audio context on first user interaction
   */
  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      this.context.resume();
    }
    return this.context;
  }

  /**
   * Set ambient volume (0–100 from UI, stored as 0–1 internally)
   */
  setAmbientVolume(volume: number): void {
    this.state.ambientVolume = Math.max(0, Math.min(1, volume / 100));
    this.state.eventVolume = this.state.ambientVolume * 0.3;
  }

  /**
   * Get ambient volume as 0–100
   */
  getAmbientVolume(): number {
    return Math.round(this.state.ambientVolume * 100);
  }

  /**
   * Toggle mute state
   */
  setMuted(muted: boolean): void {
    this.state.isMuted = muted;
  }

  isMuted(): boolean {
    return this.state.isMuted;
  }

  /**
   * Play a one-shot event sound (chime, bell, tick)
   * All event sounds are < 1 second, non-alarming per spec
   */
  async playEventSound(type: AudioEventType): Promise<void> {
    if (this.state.isMuted) return;

    // Event sounds are embedded as base64 or loaded from /sounds/
    // Actual audio files would be placed in /public/sounds/
    const soundPaths: Record<AudioEventType, string> = {
      session_start: "/sounds/session-start.mp3",
      session_end: "/sounds/session-end.mp3",
      break_start: "/sounds/break-start.mp3",
      break_end: "/sounds/break-end.mp3",
      task_complete: "/sounds/task-complete.mp3",
    };

    try {
      const ctx = this.ensureContext();
      const response = await fetch(soundPaths[type]);
      if (!response.ok) return; // Silently fail if audio file not found

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = audioBuffer;
      gainNode.gain.value = this.state.eventVolume;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();
    } catch (err) {
      // Audio is non-critical — silently fail
      console.debug("[AudioManager] Event sound failed:", err);
    }
  }

  /**
   * Stop all active audio
   */
  stop(): void {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch {
        // Already stopped
      }
      this.ambientSource = null;
    }
    this.state.currentAmbientUrl = null;
  }

  /**
   * Clean up audio context (call on unmount)
   */
  dispose(): void {
    this.stop();
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}

// Export singleton instance
export const AudioManager = AudioManagerSingleton.getInstance();
