import { create } from "zustand";
import { authApi } from "@/services/auth.api";
import type { User, LoginCredentials } from "@/types/user.types";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingComplete: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setOnboardingComplete: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  onboardingComplete: false,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login(credentials);
      set({
        user: response.user,
        isAuthenticated: true,
        onboardingComplete: response.user.onboardingComplete,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authApi.logout();
      set({
        user: null,
        isAuthenticated: false,
        onboardingComplete: false,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  refreshUser: async () => {
    set({ isLoading: true });
    try {
      const user = await authApi.getMe();
      set({
        user,
        isAuthenticated: true,
        onboardingComplete: user.onboardingComplete,
        isLoading: false,
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        onboardingComplete: false,
        isLoading: false,
      });
      throw error;
    }
  },

  setOnboardingComplete: () => {
    set({ onboardingComplete: true });
  },
}));
