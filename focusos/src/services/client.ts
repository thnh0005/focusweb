// ═══════════════════════════════════════════════════════════════
// API Client — FocusOS
// Centralized fetch wrapper with auth, CSRF, and error handling
// ═══════════════════════════════════════════════════════════════

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

// ── Custom Error Types ─────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message = "Network error. Please check your connection.") {
    super(message);
    this.name = "NetworkError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessages(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => toErrorMessages(item))
      .filter((message) => message.length > 0);
  }
  if (isRecord(value)) {
    return Object.values(value)
      .flatMap((item) => toErrorMessages(item))
      .filter((message) => message.length > 0);
  }
  return [];
}

function normalizeErrorBody(body: unknown, fallbackMessage: string) {
  if (!isRecord(body)) {
    return { message: fallbackMessage, details: undefined };
  }

  const error = isRecord(body.error) ? body.error : undefined;
  const explicitMessage =
    (typeof body.message === "string" && body.message) ||
    (typeof body.detail === "string" && body.detail) ||
    (typeof error?.message === "string" && error.message) ||
    (typeof error?.code === "string" && error.code) ||
    undefined;

  const details: Record<string, string[]> = {};
  const nestedErrors = isRecord(body.errors) ? body.errors : undefined;
  const detailSource = nestedErrors ?? body;

  for (const [key, value] of Object.entries(detailSource)) {
    if (["message", "detail", "error", "errors"].includes(key) && !nestedErrors) {
      continue;
    }
    const messages = toErrorMessages(value);
    if (messages.length > 0) {
      details[key] = messages;
    }
  }

  const firstDetail =
    details.non_field_errors?.[0] ??
    details.detail?.[0] ??
    Object.values(details)[0]?.[0];

  return {
    message: explicitMessage ?? firstDetail ?? fallbackMessage,
    details: Object.keys(details).length > 0 ? details : undefined,
  };
}

// ── Response Type ─────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
  nextPage: number | null;
}

// ── CSRF Token ────────────────────────────────────────────────

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "csrftoken") return decodeURIComponent(value);
  }
  return null;
}

async function ensureCsrfToken(): Promise<string | null> {
  let csrf = getCsrfToken();
  if (csrf || typeof document === "undefined") return csrf;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        csrfToken?: string;
      } | null;
      if (body?.csrfToken) {
        return body.csrfToken;
      }
    }
  } catch {
    return null;
  }

  csrf = getCsrfToken();
  return csrf;
}

// ── Base Request ──────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Build headers
  const isFormData =
    typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  // Add CSRF token for state-mutating requests
  const method = (fetchOptions.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = await ensureCsrfToken();
    if (csrf) {
      headers["X-CSRFToken"] = csrf;
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      ...fetchOptions,
      headers,
      credentials: "include", // Include session cookies
    });
  } catch {
    throw new NetworkError();
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(response.status, `HTTP ${response.status}`);
    }
    return undefined as T;
  }

  if (!response.ok) {
    const { message, details } = normalizeErrorBody(body, `HTTP ${response.status}`);
    throw new ApiError(
      response.status,
      message,
      details
    );
  }

  return body as T;
}

// ── HTTP Method Helpers ───────────────────────────────────────

export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "GET" });
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },

  /**
   * Upload a file using multipart/form-data
   */
  upload<T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "POST",
      body: formData,
    });
  },
};
