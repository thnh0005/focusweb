"use client";

import * as React from "react";
import { listenForExtensionEvents, sendExtensionMessage } from "@/lib/extension/bridge";
import { useSessionStore } from "@/stores/session.store";
import { useExtensionStore } from "@/stores/extension.store";
import { useNotificationStore } from "@/stores/notification.store";
import type { FocusStateLabel } from "@/types/session.types";

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

function asDomain(payload: Record<string, unknown> | null) {
  return typeof payload?.domain === "string" && payload.domain.trim()
    ? payload.domain.trim()
    : "trang blacklist";
}

function isFocusState(value: unknown): value is FocusStateLabel {
  return typeof value === "string" && FOCUS_STATES.includes(value as FocusStateLabel);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

type ExtensionStatusSnapshot = {
  activeSession?: {
    sessionId?: unknown;
    tabSwitchCount?: unknown;
  } | null;
};

export function useExtensionBridge() {
  const activeSessionId = useSessionStore((state) => state.activeSession?.id ?? null);
  const { updateRealtimeScore, triggerAutoPause, setTabSwitchCount, hydrateActiveSession } =
    useSessionStore();
  const { setConnected, setSyncStatus } = useExtensionStore();
  const { addNotification, addToast } = useNotificationStore();

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
          if (!isCurrentSession(payload)) break;
          const domain = asDomain(payload);
          const level = typeof payload?.level === "number" ? payload.level : 1;

          addNotification({
            id: `blacklist-${getSessionId(payload) ?? "session"}-${domain}-${level}-${Date.now()}`,
            type: "session_reminder",
            title: "Cảnh báo blacklist",
            body: `${domain} đang nằm trong blacklist. Lượt truy cập này sẽ được tính vào đánh giá cuối phiên.`,
            href: "/dashboard",
          });
          addToast({
            type: level >= 3 ? "error" : "warning",
            title: "Đã phát hiện trang blacklist",
            message: domain,
            duration: 6000,
          });
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
          if (isCurrentSession(event.payload)) {
            void hydrateActiveSession({ force: true });
          }
          break;

        default:
          break;
      }
    });

    return cleanup;
  }, [
    updateRealtimeScore,
    triggerAutoPause,
    setTabSwitchCount,
    hydrateActiveSession,
    setConnected,
    setSyncStatus,
    addNotification,
    addToast,
  ]);

  React.useEffect(() => {
    if (!activeSessionId) return;

    let cancelled = false;

    async function syncExtensionSnapshot() {
      const snapshot = await sendExtensionMessage<ExtensionStatusSnapshot>("GET_STATUS");
      if (cancelled || !snapshot) return;

      const session = snapshot.activeSession;
      if (
        session?.sessionId === activeSessionId &&
        typeof session.tabSwitchCount === "number"
      ) {
        setTabSwitchCount(session.tabSwitchCount);
      }

    }

    void syncExtensionSnapshot();
    const interval = window.setInterval(() => {
      void syncExtensionSnapshot();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeSessionId, setTabSwitchCount]);
}
