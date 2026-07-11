import { apiClient } from "./client";
import type {
  User,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  OnboardingData,
} from "@/types/user.types";

const MOCK_AUTH_REQUESTED = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";
const MOCK_AUTH_ENABLED =
  MOCK_AUTH_REQUESTED && process.env.NODE_ENV !== "production";
const MOCK_STORAGE_KEY = "focusos.mock.auth";
const DEFAULT_MOCK_EMAIL =
  process.env.NEXT_PUBLIC_MOCK_AUTH_EMAIL || "dev@example.com";
const DEFAULT_MOCK_PASSWORD =
  process.env.NEXT_PUBLIC_MOCK_AUTH_PASSWORD || "dev-password";
let didWarnMockAuth = false;

interface MockAuthRecord {
  user: User;
  password: string;
}

async function prepareCsrf(): Promise<void> {
  await apiClient.get<{ csrfToken: string }>("/auth/csrf/");
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readMockRecord(): MockAuthRecord | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockAuthRecord;
  } catch {
    return null;
  }
}

function writeMockRecord(record: MockAuthRecord) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(record));
}

function clearMockRecord() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(MOCK_STORAGE_KEY);
}

function warnMockAuthState() {
  if (didWarnMockAuth || typeof window === "undefined") return;
  didWarnMockAuth = true;

  if (MOCK_AUTH_ENABLED) {
    console.warn(
      "[FocusOS] Mock auth is enabled for local development only. Disable NEXT_PUBLIC_MOCK_AUTH for production-like testing."
    );
  } else if (MOCK_AUTH_REQUESTED && process.env.NODE_ENV === "production") {
    console.warn("[FocusOS] NEXT_PUBLIC_MOCK_AUTH is ignored in production builds.");
  }
}

function createMockUser(email: string, overrides?: Partial<User>): User {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mock-${Date.now()}`;
  return {
    id,
    email,
    displayName: email.split("@")[0],
    createdAt: new Date().toISOString(),
    onboardingComplete: false,
    isEmailVerified: true,
    ...overrides,
  };
}

function seedDefaultRecord(): MockAuthRecord {
  const user = createMockUser(DEFAULT_MOCK_EMAIL, {
    displayName: "thnh",
    onboardingComplete: true,
  });
  const record = { user, password: DEFAULT_MOCK_PASSWORD };
  writeMockRecord(record);
  return record;
}

export const authApi = {
  /**
   * Login with email and password.
   * Django sets HttpOnly session cookie on success.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    warnMockAuthState();
    if (MOCK_AUTH_ENABLED) {
      if (
        credentials.email === DEFAULT_MOCK_EMAIL &&
        credentials.password === DEFAULT_MOCK_PASSWORD
      ) {
        return { user: seedDefaultRecord().user };
      }

      const record = readMockRecord();
      if (!record) {
        return Promise.reject(new Error("Invalid email or password"));
      }

      if (
        credentials.email === record.user.email &&
        credentials.password === record.password
      ) {
        return { user: record.user };
      }

      return Promise.reject(new Error("Invalid email or password"));
    }
    await prepareCsrf();
    return apiClient.post<AuthResponse>("/auth/login/", credentials);
  },

  /**
   * Register a new user account.
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    warnMockAuthState();
    if (MOCK_AUTH_ENABLED) {
      const user = createMockUser(credentials.email, {
        onboardingComplete: false,
      });
      const record: MockAuthRecord = {
        user,
        password: credentials.password,
      };
      writeMockRecord(record);
      return { user };
    }
    await prepareCsrf();
    return apiClient.post<AuthResponse>("/auth/register/", credentials);
  },

  /**
   * Logout — clears server-side session.
   */
  logout(): Promise<void> {
    warnMockAuthState();
    if (MOCK_AUTH_ENABLED) {
      clearMockRecord();
      return Promise.resolve();
    }
    return apiClient.post<void>("/auth/logout/");
  },

  /**
   * Get the currently authenticated user.
   */
  getMe(): Promise<User> {
    warnMockAuthState();
    if (MOCK_AUTH_ENABLED) {
      const record = readMockRecord();
      if (!record) {
        return Promise.reject(new Error("Not authenticated"));
      }
      return Promise.resolve(record.user);
    }
    return apiClient.get<User>("/auth/me/");
  },

  /**
   * Save onboarding survey data.
   */
  saveOnboarding(data: OnboardingData): Promise<AuthResponse> {
    warnMockAuthState();
    if (MOCK_AUTH_ENABLED) {
      const record = readMockRecord();
      if (record) {
        const updatedUser = {
          ...record.user,
          onboardingComplete: true,
        };
        writeMockRecord({
          ...record,
          user: updatedUser,
        });
        return Promise.resolve({
          user: updatedUser,
          message: "Onboarding completed.",
        });
      }
      return Promise.reject(new Error("Not authenticated"));
    }
    return apiClient.post<AuthResponse>("/auth/onboarding/", data);
  },

  /**
   * Request password reset email.
   */
  requestPasswordReset(email: string): Promise<void> {
    warnMockAuthState();
    if (MOCK_AUTH_ENABLED) {
      const record = readMockRecord();
      if (!record || record.user.email !== email) {
        return Promise.reject(new Error("Email not found"));
      }
      return Promise.resolve();
    }
    return apiClient.post<void>("/auth/password-reset/", { email });
  },

  /**
   * Confirm password reset with token.
   */
  confirmPasswordReset(
    token: string,
    newPassword: string,
    newPasswordConfirm: string
  ): Promise<void> {
    warnMockAuthState();
    if (MOCK_AUTH_ENABLED) {
      if (newPassword !== newPasswordConfirm) {
        return Promise.reject(new Error("Passwords do not match"));
      }
      const record = readMockRecord();
      if (!record) {
        return Promise.reject(new Error("No mock account found"));
      }
      writeMockRecord({ ...record, password: newPassword });
      return Promise.resolve();
    }
    return apiClient.post<void>("/auth/password-reset/confirm/", {
      token,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    });
  },
};
