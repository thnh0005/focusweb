// ═══════════════════════════════════════════════════════════════
// Extension Bridge — FocusOS
// Abstraction layer for Chrome Extension ↔ Web App messaging
// ═══════════════════════════════════════════════════════════════

import type {
  ExtensionMessage,
  ExtensionMessageType,
  ExtensionEvent,
  ExtensionSessionStartPayload,
  BlacklistPayload,
} from "@/types/extension.types";
import type { SessionMode } from "@/types/session.types";

// Extension ID would be set during build from environment
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID ?? "";

/**
 * Check if Chrome extension APIs are available
 */
export function isExtensionAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { chrome?: { runtime?: unknown } }).chrome !== "undefined" &&
    !!(window as Window & { chrome?: { runtime?: unknown } }).chrome?.runtime
  );
}

/**
 * Send a message to the FocusOS Chrome extension.
 * Returns null if extension is not available.
 */
export async function sendExtensionMessage<T = unknown>(
  type: ExtensionMessageType,
  payload?: ExtensionMessage["payload"]
): Promise<T | null> {
  if (!isExtensionAvailable() || !EXTENSION_ID) {
    console.warn("[ExtensionBridge] Extension not available or ID not configured");
    return null;
  }

  return new Promise<T | null>((resolve) => {
    const chrome = (window as Window & { chrome?: { runtime?: { sendMessage?: (id: string, msg: unknown, cb: (response: T) => void) => void } } }).chrome;
    try {
      chrome?.runtime?.sendMessage?.(
        EXTENSION_ID,
        { type, payload } satisfies ExtensionMessage,
        (response: T) => {
          if ((chrome as { runtime?: { lastError?: unknown } }).runtime?.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        }
      );
    } catch (err) {
      console.warn("[ExtensionBridge] sendMessage failed:", err);
      resolve(null);
    }
  });
}

/**
 * Ping the extension to check if it's installed and responsive
 */
export async function pingExtension(): Promise<boolean> {
  const response = await sendExtensionMessage("PING");
  return response !== null;
}

/**
 * Notify extension that a session has started
 */
export async function notifySessionStart(
  sessionId: string,
  goal: string | undefined,
  mode: SessionMode,
  blacklist: BlacklistPayload[]
): Promise<void> {
  const payload: ExtensionSessionStartPayload = {
    sessionId,
    goal,
    mode,
    blacklist,
  };
  await sendExtensionMessage("SESSION_START", payload);
}

/**
 * Notify extension that a session has been paused
 */
export async function notifySessionPause(sessionId: string): Promise<void> {
  await sendExtensionMessage("SESSION_PAUSE", { sessionId });
}

/**
 * Notify extension that a session has been resumed
 */
export async function notifySessionResume(sessionId: string): Promise<void> {
  await sendExtensionMessage("SESSION_RESUME", { sessionId });
}

/**
 * Notify extension that a session has ended
 */
export async function notifySessionEnd(sessionId: string): Promise<void> {
  await sendExtensionMessage("SESSION_END", { sessionId });
}

/**
 * Sync updated blacklist to the extension
 */
export async function syncBlacklistToExtension(
  entries: BlacklistPayload[]
): Promise<void> {
  await sendExtensionMessage("BLACKLIST_SYNC", { entries });
}

/**
 * Listen for events coming FROM the extension via window.postMessage
 * Returns a cleanup function to remove the listener.
 */
export function listenForExtensionEvents(
  handler: (event: ExtensionEvent) => void
): () => void {
  function messageHandler(event: MessageEvent) {
    // Validate origin and source
    if (event.source !== window) return;

    const data = event.data as ExtensionEvent;

    // Validate message structure
    if (!data?.type) return;

    // Only handle known extension event types
    const knownTypes = [
      "PONG",
      "SCORE_UPDATE",
      "WARNING",
      "AUTO_PAUSE",
      "TAB_SWITCH",
      "CONTENT_CHANGED",
      "DISCONNECTED",
      "SYNC_COMPLETE",
    ];
    if (!knownTypes.includes(data.type)) return;

    handler(data);
  }

  window.addEventListener("message", messageHandler);

  return () => {
    window.removeEventListener("message", messageHandler);
  };
}
