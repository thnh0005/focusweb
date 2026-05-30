"use client";

import * as React from "react";
import { useSessionStore } from "@/stores/session.store";
import { AudioManager } from "@/lib/audio/AudioManager";
import type { SessionConfig } from "@/types/session.types";

export function useSession() {
  const {
    activeSession,
    sessionStatus,
    endSession,
    pauseSession,
    resumeSession,
    cancelSession,
    sessionNote,
    setSessionNote,
  } = useSessionStore();

  const [timeLeft, setTimeLeft] = React.useState<number>(0);
  const [progress, setProgress] = React.useState<number>(100);

  // Initialize remaining time when activeSession starts
  React.useEffect(() => {
    if (activeSession && sessionStatus === "active") {
      // If we just started, calculate remaining seconds
      const startedTime = new Date(activeSession.startedAt).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startedTime) / 1000);
      const remaining = Math.max(0, activeSession.targetDurationSeconds - elapsedSeconds);
      setTimeLeft(remaining);
    } else if (!activeSession) {
      setTimeLeft(0);
      setProgress(100);
    }
  }, [activeSession, sessionStatus]);

  // Timer Tick Interval
  React.useEffect(() => {
    if (sessionStatus !== "active" || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          // Play complete chime!
          AudioManager.playEventSound("session_end");
          // End session automatically
          endSession().catch((err) => console.error("Auto-end session failed:", err));
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStatus, timeLeft, endSession]);

  // Calculate Progress percentage
  React.useEffect(() => {
    if (!activeSession || activeSession.targetDurationSeconds <= 0) {
      setProgress(100);
      return;
    }
    const percent = (timeLeft / activeSession.targetDurationSeconds) * 100;
    setProgress(Math.max(0, Math.min(100, percent)));
  }, [timeLeft, activeSession]);

  // Trigger event chime on manual start
  const handleStartSession = React.useCallback(async (config: SessionConfig) => {
    AudioManager.playEventSound("session_start");
    return useSessionStore.getState().startSession(config);
  }, []);

  return {
    activeSession,
    sessionStatus,
    timeLeft,
    progress,
    sessionNote,
    setSessionNote,
    startSession: handleStartSession,
    pauseSession,
    resumeSession,
    endSession,
    cancelSession,
  };
}
