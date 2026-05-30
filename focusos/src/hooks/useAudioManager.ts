"use client";

import * as React from "react";
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

  return {
    playStart,
    playEnd,
    playBreakStart,
    playBreakEnd,
    playTaskComplete,
    stopAll,
  };
}
