// ═══════════════════════════════════════════════════════════════
// API Client — FocusOS
// Centralized fetch wrapper with auth, CSRF, and error handling
// ═══════════════════════════════════════════════════════════════

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

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

// ── Base Request ──────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, skipAuth: _skipAuth, ...fetchOptions } = options;

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Add CSRF token for state-mutating requests
  const method = (fetchOptions.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCsrfToken();
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
    const errorBody = body as {
      message?: string;
      detail?: string;
      errors?: Record<string, string[]>;
    };
    throw new ApiError(
      response.status,
      errorBody.message ?? errorBody.detail ?? `HTTP ${response.status}`,
      errorBody.errors
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
    const { headers: _headers, ...rest } = options ?? {};
    return request<T>(endpoint, {
      ...rest,
      method: "POST",
      body: formData,
      headers: {}, // Let browser set Content-Type with boundary
    });
  },
};
