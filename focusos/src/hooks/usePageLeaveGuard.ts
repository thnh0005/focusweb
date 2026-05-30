"use client";

import * as React from "react";

/**
 * Hook to block accidental navigation or tab closes when conditions are met.
 * @param enabled Whether the navigation block is active.
 * @param message The alert message warning prompt text.
 */
export function usePageLeaveGuard(enabled: boolean, message = "An active focus session is running. Leaving this page will cancel your progress!") {
  // Prevent closing the tab / browser window
  React.useEffect(() => {
    if (!enabled) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = message; // Standard browser check
      return message;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, message]);
}
