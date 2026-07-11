"use client";

import * as React from "react";
import type { AmbientLoopId } from "@/constants/ambient-tracks";
import { AudioManager } from "@/lib/audio/AudioManager";

export function useAudioManager() {
  const playStart = React.useCallback(async () => {
    await AudioManager.playEventSound("session_start");
  }, []);

  const playEnd = React.useCallback(async () => {
    await AudioManager.playEventSound("session_end");
  }, []);

  const playBreakStart = React.useCallback(async () => {
    await AudioManager.playEventSound("break_start");
  }, []);

  const playBreakEnd = React.useCallback(async () => {
    await AudioManager.playEventSound("break_end");
  }, []);

  const playTaskComplete = React.useCallback(async () => {
    await AudioManager.playEventSound("task_complete");
  }, []);

  const stopAll = React.useCallback(() => {
    AudioManager.stop();
  }, []);

  const stopMusic = React.useCallback(() => {
    AudioManager.stopMusic();
  }, []);

  const stopAmbient = React.useCallback((id: AmbientLoopId) => {
    AudioManager.stopAmbient(id);
  }, []);

  const setMuted = React.useCallback((muted: boolean) => {
    AudioManager.setMuted(muted);
  }, []);

  return {
    playStart,
    playEnd,
    playBreakStart,
    playBreakEnd,
    playTaskComplete,
    stopMusic,
    stopAmbient,
    stopAll,
    setMuted,
  };
}
