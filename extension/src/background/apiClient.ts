import type { BackendEventPayload, EventBatchResponse } from "./types";

interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  sessionClosed?: boolean;
}

function trimApiUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function addExtensionAuthHeaders(
  headers: Record<string, string>,
  sessionId: string,
  extensionToken?: string
) {
  if (!extensionToken) return;
  headers["X-FocusOS-Session-Id"] = sessionId;
  headers["X-FocusOS-Extension-Token"] = extensionToken;
}

function extensionFetchOptions(init: RequestInit): RequestInit {
  return {
    ...init,
    // Extension requests authenticate with X-FocusOS-* headers. Sending browser
    // cookies makes DRF SessionAuthentication enforce CSRF against a
    // chrome-extension:// origin, which is not a web app origin.
    credentials: "omit",
  };
}

export async function sendEventBatch(
  backendApiUrl: string,
  sessionId: string,
  events: BackendEventPayload[],
  extensionToken?: string
): Promise<ApiResult<EventBatchResponse>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  addExtensionAuthHeaders(headers, sessionId, extensionToken);

  try {
    const response = await fetch(
      `${trimApiUrl(backendApiUrl)}/tracking/sessions/${sessionId}/events/`,
      extensionFetchOptions({
        method: "POST",
        headers,
        body: JSON.stringify({ events }),
      })
    );

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const detail =
        typeof body === "object" && body && "detail" in body
          ? String((body as { detail?: unknown }).detail)
          : `HTTP ${response.status}`;
      if (response.status === 409) {
        return { ok: false, error: detail, sessionClosed: true };
      }
      return { ok: false, error: detail };
    }

    return { ok: true, data: body as EventBatchResponse };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}

export async function sendHeartbeat(
  backendApiUrl: string,
  extensionVersion: string,
  sessionId: string,
  extensionToken?: string
): Promise<ApiResult<{ connected: boolean; last_seen: string }>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  addExtensionAuthHeaders(headers, sessionId, extensionToken);

  try {
    const response = await fetch(
      `${trimApiUrl(backendApiUrl)}/extension/heartbeat/`,
      extensionFetchOptions({
        method: "POST",
        headers,
        body: JSON.stringify({
          extension_version: extensionVersion,
          browser: "chrome",
        }),
      })
    );

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const detail =
        typeof body === "object" && body && "detail" in body
          ? String((body as { detail?: unknown }).detail)
          : `HTTP ${response.status}`;
      return { ok: false, error: detail };
    }

    return { ok: true, data: body as { connected: boolean; last_seen: string } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}

export async function completeSession(
  backendApiUrl: string,
  sessionId: string,
  payload: {
    reason: string;
    metadata: Record<string, unknown>;
  },
  extensionToken?: string
): Promise<ApiResult<unknown>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  addExtensionAuthHeaders(headers, sessionId, extensionToken);

  try {
    const response = await fetch(
      `${trimApiUrl(backendApiUrl)}/sessions/${sessionId}/end/`,
      extensionFetchOptions({
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
    );
    if (response.ok) {
      return { ok: true, data: await response.json().catch(() => ({})) };
    }
    if (response.status === 400 || response.status === 409) {
      return { ok: true, data: await response.json().catch(() => ({})) };
    }
    return { ok: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}
