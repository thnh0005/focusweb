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

  const getRemainingSeconds = React.useCallback(() => {
    if (!activeSession) return 0;

    const elapsedSeconds =
      typeof activeSession.elapsedActiveSeconds === "number"
        ? activeSession.elapsedActiveSeconds
        : Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000);

    return Math.max(0, activeSession.targetDurationSeconds - elapsedSeconds);
  }, [activeSession]);

  // Initialize remaining time when activeSession starts
  React.useEffect(() => {
    if (activeSession) {
      const nextTimeLeft = getRemainingSeconds();
      const timer = window.setTimeout(() => setTimeLeft(nextTimeLeft), 0);
      return () => window.clearTimeout(timer);
    }

    if (!activeSession) {
      const timer = window.setTimeout(() => setTimeLeft(0), 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeSession, getRemainingSeconds]);

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

  const progress = React.useMemo(() => {
    if (!activeSession || activeSession.targetDurationSeconds <= 0) {
      return 100;
    }
    const percent = (timeLeft / activeSession.targetDurationSeconds) * 100;
    return Math.max(0, Math.min(100, percent));
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
