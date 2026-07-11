"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { useFocusScore } from "@/hooks/useFocusScore";
import { useSessionStore } from "@/stores/session.store";
import { useMusicStore } from "@/stores/music.store";
import { useExtensionStore } from "@/stores/extension.store";
import { sessionsApi } from "@/services/sessions.api";
import { FocusTimer } from "@/components/features/focus/FocusTimer";
import { DistractionWarningOverlay } from "@/components/features/focus/DistractionWarningOverlay";
import { AutoPauseModal } from "@/components/features/focus/AutoPauseModal";
import { SessionNotepad } from "@/components/features/focus/SessionNotepad";
import { ImmersiveSessionShell } from "@/components/session/ImmersiveSessionShell";
import { SessionGoalHeader } from "@/components/session/SessionGoalHeader";
import { SessionControlPills } from "@/components/session/SessionControlPills";
import { FocusStatePill } from "@/components/session/FocusStatePill";
import { SessionUtilityDock } from "@/components/session/SessionUtilityDock";
import { SceneSwitcher } from "@/components/focus-home/SceneSwitcher";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { BackendRealtimeScore } from "@/types/session.types";

const BACKEND_POLL_INTERVAL_MS = 15_000;
const EXTENSION_SCORE_STALE_MS = 30_000;

function scoreLabel(score: BackendRealtimeScore | undefined) {
  if (!score) return "Checking focus signals";
  if (score.data_quality === "INSUFFICIENT") return "Insufficient data";
  if (score.stale) return "Stale backend score";
  if (score.ai_status === "DISABLED") return "Rule-based score";
  if (score.data_quality === "PARTIAL") return "Partial score";
  return "Backend score";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export default function ActiveSessionPage() {
  const router = useRouter();
  const {
    activeSession,
    sessionStatus,
    timeLeft,
    progress,
    pauseSession,
    resumeSession,
    endSession,
    sessionNote,
    setSessionNote,
  } = useSession();
  const {
    realtimeFocusScore,
    warningLevel,
    isAutoPaused,
    clearWarning,
    tabSwitchCount,
    isLoading,
    hydrateActiveSession,
    realtimeScoreUpdatedAt,
  } = useSessionStore();
  const { connected: extensionConnected } = useExtensionStore();
  const { togglePlay } = useMusicStore();
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = React.useState(false);
  const [isHydrating, setIsHydrating] = React.useState(!activeSession);
  const [dismissedBackendCycleId, setDismissedBackendCycleId] = React.useState<string | null>(null);
  const [nowMs, setNowMs] = React.useState(0);

  const activeSessionId = activeSession?.id;
  const shouldPollBackend = Boolean(activeSessionId);

  const realtimeScoreQuery = useQuery({
    queryKey: ["session-realtime-score", activeSessionId],
    queryFn: () => sessionsApi.getRealtimeScore(activeSessionId as string),
    enabled: shouldPollBackend,
    refetchInterval: BACKEND_POLL_INTERVAL_MS,
    retry: false,
  });

  const warningsQuery = useQuery({
    queryKey: ["session-warnings", activeSessionId],
    queryFn: () => sessionsApi.getSessionWarnings(activeSessionId as string),
    enabled: shouldPollBackend,
    refetchInterval: BACKEND_POLL_INTERVAL_MS,
    retry: false,
  });

  const extensionScoreIsFresh =
    realtimeFocusScore !== null &&
    realtimeScoreUpdatedAt !== null &&
    nowMs > 0 &&
    nowMs - realtimeScoreUpdatedAt <= EXTENSION_SCORE_STALE_MS;
  const useBackendScore =
    !extensionConnected || !extensionScoreIsFresh || realtimeFocusScore === null;
  const backendScore =
    realtimeScoreQuery.data && realtimeScoreQuery.data.data_quality !== "INSUFFICIENT"
      ? realtimeScoreQuery.data.score
      : null;
  const displayedScore = useBackendScore ? backendScore : realtimeFocusScore;
  const scoreMetrics = useFocusScore(displayedScore);
  const backendActiveCycle = warningsQuery.data?.active_cycle;
  const backendWarningLevel =
    backendActiveCycle && backendActiveCycle.cycle_id !== dismissedBackendCycleId
      ? backendActiveCycle.current_level
      : null;
  const displayedWarningLevel = warningLevel ?? backendWarningLevel;
  const displayedAutoPaused =
    isAutoPaused || Boolean(backendActiveCycle?.auto_pause_required);
  const scoreSourceLabel = useBackendScore
    ? scoreLabel(realtimeScoreQuery.data)
    : "Extension score";

  const handleDismissWarning = React.useCallback(() => {
    if (!warningLevel && backendActiveCycle?.cycle_id) {
      setDismissedBackendCycleId(backendActiveCycle.cycle_id);
    }
    clearWarning();
  }, [backendActiveCycle, clearWarning, warningLevel]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    if (activeSession) {
      return;
    }

    let isMounted = true;

    hydrateActiveSession()
      .then((session) => {
        if (!isMounted) return;
        if (!session) {
          router.replace("/session");
        }
      })
      .catch((error) => {
        console.error("Failed to restore active session:", error);
        if (isMounted) {
          router.replace("/session");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsHydrating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeSession, hydrateActiveSession, router]);

  const handleEndSession = React.useCallback(async () => {
    try {
      const completed = await endSession();
      setConfirmEndOpen(false);
      router.push(`/session/summary/${completed.id}`);
    } catch (error) {
      console.error("Failed to end session:", error);
      router.push("/dashboard");
    }
  }, [endSession, router]);

  const handlePauseResume = React.useCallback(() => {
    if (sessionStatus === "active") {
      pauseSession().catch((error) => console.error("Failed to pause session:", error));
      return;
    }

    if (sessionStatus === "paused" || sessionStatus === "auto-paused") {
      resumeSession().catch((error) => console.error("Failed to resume session:", error));
    }
  }, [pauseSession, resumeSession, sessionStatus]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (confirmEndOpen) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === " ") {
        event.preventDefault();
        handlePauseResume();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmEndOpen(true);
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setIsNoteOpen((value) => !value);
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmEndOpen, handlePauseResume, togglePlay]);

  const handleToggleFullscreen = React.useCallback(() => {
    if (typeof document === "undefined") return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch((error) => console.warn("Could not exit fullscreen:", error));
      return;
    }

    document.documentElement
      .requestFullscreen()
      .catch((error) => console.warn("Could not enter fullscreen:", error));
  }, []);

  if (!activeSession || isHydrating) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-text-secondary">
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-light">
          Restoring focus session...
        </div>
      </div>
    );
  }

  const totalDuration = activeSession.targetDurationSeconds;
  const durationMinutes = Math.round(totalDuration / 60);
  const isActive = sessionStatus === "active";
  const isPaused = sessionStatus === "paused";

  return (
    <>
      <ImmersiveSessionShell
        goalHeader={
          <SessionGoalHeader
            goal={activeSession.goal}
            mode={activeSession.mode}
            durationMinutes={durationMinutes}
          />
        }
        timer={
          <FocusTimer
            timeLeft={timeLeft}
            totalDuration={totalDuration}
            progress={progress}
            isActive={isActive}
            isAutoPaused={displayedAutoPaused}
            glowColor={scoreMetrics.glowColor}
          />
        }
        controls={
          <SessionControlPills
            isActive={isActive}
            isPaused={isPaused}
            isAutoPaused={displayedAutoPaused}
            isLoading={isLoading}
            onPause={pauseSession}
            onResume={resumeSession}
            onEnd={() => setConfirmEndOpen(true)}
          />
        }
        state={<FocusStatePill metrics={scoreMetrics} isActive={isActive} />}
        utilityDock={
          <SessionUtilityDock
            noteOpen={isNoteOpen}
            onToggleNote={() => setIsNoteOpen((value) => !value)}
            onToggleFullscreen={handleToggleFullscreen}
          />
        }
        notePanel={
          <SessionNotepad
            isOpen={isNoteOpen}
            note={sessionNote}
            onNoteChange={setSessionNote}
            onClose={() => setIsNoteOpen(false)}
          />
        }
        diagnostics={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-mono text-text-muted backdrop-blur-md">
              {tabSwitchCount} tab switches
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-mono text-text-muted backdrop-blur-md">
              {scoreSourceLabel}
            </div>
          </div>
        }
        overlays={
          <>
            <DistractionWarningOverlay
              warningLevel={displayedWarningLevel}
              onDismiss={handleDismissWarning}
            />
            <AutoPauseModal
              isOpen={displayedAutoPaused}
              onResume={resumeSession}
              onEnd={() => setConfirmEndOpen(true)}
              isLoading={isLoading}
            />
            <SceneSwitcher />
          </>
        }
      />

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this focus session?</DialogTitle>
            <DialogDescription>
              Your current note will be saved with the session summary.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmEndOpen(false)}
            >
              Keep focusing
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleEndSession}
              disabled={isLoading}
            >
              End session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
