"use client";

import * as React from "react";
import { listenForExtensionEvents } from "@/lib/extension/bridge";
import { useSessionStore } from "@/stores/session.store";
import { useExtensionStore } from "@/stores/extension.store";

export function useExtensionBridge() {
  const { updateRealtimeScore, triggerWarning, triggerAutoPause } = useSessionStore();
  const { setConnected, setSyncStatus } = useExtensionStore();

  React.useEffect(() => {
    // Start listening for window messages broadcasted from the chrome extension content scripts.
    const cleanup = listenForExtensionEvents((event) => {
      switch (event.type) {
        case "SCORE_UPDATE":
          if (event.payload && "score" in event.payload && "state" in event.payload) {
            updateRealtimeScore(event.payload.score, event.payload.state);
          }
          break;

        case "WARNING":
          if (event.payload && "level" in event.payload) {
            triggerWarning(event.payload.level);
          }
          break;

        case "AUTO_PAUSE":
          triggerAutoPause();
          break;

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
  }, [updateRealtimeScore, triggerWarning, triggerAutoPause, setConnected, setSyncStatus]);
}
