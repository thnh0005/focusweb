"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { useFocusScore } from "@/hooks/useFocusScore";
import { useSessionStore } from "@/stores/session.store";
import { useMusicStore } from "@/stores/music.store";
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
  } = useSessionStore();
  const { togglePlay } = useMusicStore();
  const scoreMetrics = useFocusScore(realtimeFocusScore);
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = React.useState(false);

  React.useEffect(() => {
    if (!activeSession) {
      router.push("/session");
    }
  }, [activeSession, router]);

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

  if (!activeSession) {
    return null;
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
            isAutoPaused={isAutoPaused}
            glowColor={scoreMetrics.glowColor}
          />
        }
        controls={
          <SessionControlPills
            isActive={isActive}
            isPaused={isPaused}
            isAutoPaused={isAutoPaused}
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
          <div className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-mono text-text-muted backdrop-blur-md">
            {tabSwitchCount} tab switches
          </div>
        }
        overlays={
          <>
            <DistractionWarningOverlay
              warningLevel={warningLevel}
              onDismiss={clearWarning}
            />
            <AutoPauseModal
              isOpen={isAutoPaused}
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
