"use client";

import * as React from "react";
import { useExtensionStore } from "@/stores/extension.store";

export function useHeartbeat() {
  const { checkHeartbeat } = useExtensionStore();

  React.useEffect(() => {
    // Check connection state on mount
    checkHeartbeat().catch((err) => console.warn("Initial heartbeat ping failed:", err));

    // Poll the extension heartbeat every 30 seconds as specified in the PRD.
    const interval = setInterval(() => {
      checkHeartbeat().catch((err) => console.warn("Periodic heartbeat ping failed:", err));
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [checkHeartbeat]);
}
