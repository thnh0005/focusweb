"use client";

import * as React from "react";
import { listenForExtensionEvents } from "@/lib/extension/bridge";
import { useSessionStore } from "@/stores/session.store";
import { useExtensionStore } from "@/stores/extension.store";
import type { FocusStateLabel, WarningLevel } from "@/types/session.types";

const FOCUS_STATES: FocusStateLabel[] = [
  "deep-focus",
  "focused",
  "average",
  "distracted",
  "highly-distracted",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSessionId(payload: unknown) {
  if (!isRecord(payload)) return null;
  return typeof payload.sessionId === "string" ? payload.sessionId : null;
}

function isCurrentSession(payload: unknown) {
  const eventSessionId = getSessionId(payload);
  if (!eventSessionId) return true;
  return useSessionStore.getState().activeSession?.id === eventSessionId;
}

function asPayloadRecord(payload: unknown) {
  return isRecord(payload) ? payload : null;
}

function isFocusState(value: unknown): value is FocusStateLabel {
  return typeof value === "string" && FOCUS_STATES.includes(value as FocusStateLabel);
}

function isWarningLevel(value: unknown): value is WarningLevel {
  return value === 1 || value === 2 || value === 3;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

export function useExtensionBridge() {
  const { updateRealtimeScore, triggerWarning, triggerAutoPause, setTabSwitchCount } =
    useSessionStore();
  const { setConnected, setSyncStatus } = useExtensionStore();

  React.useEffect(() => {
    // Start listening for window messages broadcasted from the chrome extension content scripts.
    const cleanup = listenForExtensionEvents((event) => {
      switch (event.type) {
        case "SCORE_UPDATE": {
          const payload = asPayloadRecord(event.payload);
          if (
            payload &&
            isCurrentSession(payload) &&
            typeof payload.score === "number" &&
            isFocusState(payload.state)
          ) {
            updateRealtimeScore(clampScore(payload.score), payload.state);
          }
          break;
        }

        case "WARNING": {
          const payload = asPayloadRecord(event.payload);
          if (
            payload &&
            isCurrentSession(payload) &&
            isWarningLevel(payload.level)
          ) {
            triggerWarning(payload.level);
          }
          break;
        }

        case "AUTO_PAUSE":
          if (isCurrentSession(event.payload)) {
            triggerAutoPause();
          }
          break;

        case "TAB_SWITCH": {
          const payload = asPayloadRecord(event.payload);
          if (
            payload &&
            isCurrentSession(payload) &&
            typeof payload.count === "number"
          ) {
            setTabSwitchCount(payload.count);
          }
          break;
        }

        case "SYNC_COMPLETE":
          setSyncStatus("synced");
          break;

        case "PONG":
          setConnected(true);
          break;

        case "DISCONNECTED":
          setConnected(false);
          break;

        default:
          break;
      }
    });

    return cleanup;
  }, [
    updateRealtimeScore,
    triggerWarning,
    triggerAutoPause,
    setTabSwitchCount,
    setConnected,
    setSyncStatus,
  ]);
}
