"use client";

import * as React from "react";

export interface ShortcutBinding {
  keys: string[]; // e.g. ["Control", "k"] or ["meta", "k"] or [" "]
  action: (e: KeyboardEvent) => void;
  disabled?: boolean;
}

export function useKeyboardShortcuts(bindings: ShortcutBinding[]) {
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      for (const binding of bindings) {
        if (binding.disabled) continue;

        const matches = binding.keys.every((key) => {
          const lowerKey = key.toLowerCase();
          if (lowerKey === "control" || lowerKey === "ctrl") return event.ctrlKey;
          if (lowerKey === "meta" || lowerKey === "cmd" || lowerKey === "command") return event.metaKey;
          if (lowerKey === "shift") return event.shiftKey;
          if (lowerKey === "alt") return event.altKey;
          
          return event.key.toLowerCase() === lowerKey;
        });

        if (matches) {
          event.preventDefault();
          binding.action(event);
          break; // Stop after matching one shortcut
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bindings]);
}
