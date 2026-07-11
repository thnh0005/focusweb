import type { BackendEventPayload, EventBatchResponse } from "./types";

interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

let csrfToken: string | null = null;

function trimApiUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

async function ensureCsrfToken(backendApiUrl: string): Promise<string | null> {
  if (csrfToken) return csrfToken;

  try {
    const response = await fetch(`${trimApiUrl(backendApiUrl)}/auth/csrf/`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { csrfToken?: string };
    csrfToken = body.csrfToken ?? null;
    return csrfToken;
  } catch {
    return null;
  }
}

export async function sendEventBatch(
  backendApiUrl: string,
  sessionId: string,
  events: BackendEventPayload[]
): Promise<ApiResult<EventBatchResponse>> {
  const csrf = await ensureCsrfToken(backendApiUrl);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (csrf) {
    headers["X-CSRFToken"] = csrf;
  }

  try {
    const response = await fetch(
      `${trimApiUrl(backendApiUrl)}/tracking/sessions/${sessionId}/events/`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ events }),
      }
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

    return { ok: true, data: body as EventBatchResponse };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}
