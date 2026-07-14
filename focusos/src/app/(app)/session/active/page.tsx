"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSession } from "@/hooks/useSession";
import { useFocusScore } from "@/hooks/useFocusScore";
import { useSessionStore } from "@/stores/session.store";
import { useMusicStore } from "@/stores/music.store";
import { useExtensionStore } from "@/stores/extension.store";
import { sessionsApi } from "@/services/sessions.api";
import { FocusTimer } from "@/components/features/focus/FocusTimer";
import { AutoPauseModal } from "@/components/features/focus/AutoPauseModal";
import { SessionNotepad } from "@/components/features/focus/SessionNotepad";
import { ImmersiveSessionShell } from "@/components/session/ImmersiveSessionShell";
import { SessionGoalHeader } from "@/components/session/SessionGoalHeader";
import { SessionControlPills } from "@/components/session/SessionControlPills";
import { FocusStatePill } from "@/components/session/FocusStatePill";
import { SessionUtilityDock } from "@/components/session/SessionUtilityDock";
import { AiDocumentsWidget } from "@/components/focus-home/AiDocumentsWidget";
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
const HYDRATE_TIMEOUT_MS = 8000;

function scoreLabel(score: BackendRealtimeScore | undefined, t: (key: string) => string) {
  if (!score) return t("active.checkingSignals");
  if (score.data_quality === "INSUFFICIENT") return t("active.insufficientData");
  if (score.stale) return t("active.staleBackend");
  if (score.ai_status === "DISABLED") return t("active.ruleBased");
  if (score.data_quality === "PARTIAL") return t("active.partialScore");
  return t("active.backendScore");
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
  const { t } = useTranslation("focus");
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
    isAutoPaused,
    tabSwitchCount,
    isLoading,
    hydrateActiveSession,
    realtimeScoreUpdatedAt,
  } = useSessionStore();
  const { connected: extensionConnected } = useExtensionStore();
  const { togglePlay } = useMusicStore();
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);
  const [isDocsOpen, setIsDocsOpen] = React.useState(false);
  const [isSceneOpen, setIsSceneOpen] = React.useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = React.useState(false);
  const [isHydrating, setIsHydrating] = React.useState(!activeSession);
  const [isEndingSession, setIsEndingSession] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(0);

  const activeSessionId = activeSession?.id;
  const shouldPollBackend =
    Boolean(activeSessionId) &&
    !isEndingSession &&
    ["active", "paused", "auto-paused"].includes(sessionStatus);

  const realtimeScoreQuery = useQuery({
    queryKey: ["session-realtime-score", activeSessionId],
    queryFn: () => sessionsApi.getRealtimeScore(activeSessionId as string),
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
  const displayedAutoPaused = isAutoPaused;
  const scoreSourceLabel = useBackendScore
    ? scoreLabel(realtimeScoreQuery.data, t)
    : t("active.extensionScore");

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    if (isEndingSession) {
      return;
    }
    if (activeSession) {
      const timerId = window.setTimeout(() => setIsHydrating(false), 0);
      return () => window.clearTimeout(timerId);
    }

    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      setIsHydrating(false);
      router.replace("/dashboard");
    }, HYDRATE_TIMEOUT_MS);

    hydrateActiveSession()
      .then((session) => {
        if (!isMounted) return;
        if (!session) {
          router.replace("/dashboard");
        }
      })
      .catch((error) => {
        console.error("Failed to restore active session:", error);
        if (isMounted) {
          router.replace("/dashboard");
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (isMounted) {
          setIsHydrating(false);
        }
      });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeSession, hydrateActiveSession, isEndingSession, router]);

  const handleEndSession = React.useCallback(async () => {
    if (!activeSessionId) return;
    setIsEndingSession(true);
    try {
      const completed = await endSession(activeSessionId);
      setConfirmEndOpen(false);
      router.replace(`/session/summary/${completed.id === activeSessionId ? completed.id : activeSessionId}`);
    } catch (error) {
      console.error("Failed to end session:", error);
      setIsEndingSession(false);
      router.push("/dashboard");
    }
  }, [activeSessionId, endSession, router]);

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
          {isEndingSession ? t("active.finalizing", { defaultValue: "Preparing your focus score..." }) : t("active.restore")}
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
            docsOpen={isDocsOpen}
            sceneOpen={isSceneOpen}
            onToggleNote={() => setIsNoteOpen((value) => !value)}
            onToggleDocs={() => setIsDocsOpen((value) => !value)}
            onToggleScene={() => setIsSceneOpen((value) => !value)}
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
              {t("active.tabSwitches", { count: tabSwitchCount })}
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-mono text-text-muted backdrop-blur-md">
              {scoreSourceLabel}
            </div>
          </div>
        }
        overlays={
          <>
            <AutoPauseModal
              isOpen={displayedAutoPaused}
              onResume={resumeSession}
              onEnd={() => setConfirmEndOpen(true)}
              isLoading={isLoading}
            />
            {isSceneOpen && <SceneSwitcher onClose={() => setIsSceneOpen(false)} />}
            <AiDocumentsWidget
              isOpen={isDocsOpen}
              onClose={() => setIsDocsOpen(false)}
            />
          </>
        }
      />

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("active.confirmEndTitle")}</DialogTitle>
            <DialogDescription>
              {t("active.confirmEndDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmEndOpen(false)}
            >
              {t("active.keepFocusing")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleEndSession}
              disabled={isLoading}
            >
              {t("active.endSession")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
