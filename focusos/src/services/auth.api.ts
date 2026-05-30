import { apiClient } from "./client";
import type {
  User,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  OnboardingData,
} from "@/types/user.types";

export const authApi = {
  /**
   * Login with email and password.
   * Django sets HttpOnly session cookie on success.
   */
  login(credentials: LoginCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>("/auth/login/", credentials);
  },

  /**
   * Register a new user account.
   */
  register(credentials: RegisterCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>("/auth/register/", credentials);
  },

  /**
   * Logout — clears server-side session.
   */
  logout(): Promise<void> {
    return apiClient.post<void>("/auth/logout/");
  },

  /**
   * Get the currently authenticated user.
   */
  getMe(): Promise<User> {
    return apiClient.get<User>("/auth/me/");
  },

  /**
   * Save onboarding survey data.
   */
  saveOnboarding(data: OnboardingData): Promise<void> {
    return apiClient.post<void>("/auth/onboarding/", data);
  },

  /**
   * Request password reset email.
   */
  requestPasswordReset(email: string): Promise<void> {
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
    return apiClient.post<void>("/auth/password-reset/confirm/", {
      token,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    });
  },
};
