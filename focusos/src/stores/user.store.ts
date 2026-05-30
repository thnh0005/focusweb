import { create } from "zustand";
import { userApi } from "@/services/user.api";
import type { UserProfile, UserPreferences } from "@/types/user.types";

export interface UserState {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  streak: number;
  streakUpdatedAt: Date | null;
  isLoading: boolean;

  // Actions
  fetchProfile: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (payload: { displayName?: string; avatarUrl?: string }) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  fetchStreak: () => Promise<void>;
  incrementStreak: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  preferences: null,
  streak: 0,
  streakUpdatedAt: null,
  isLoading: false,

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const profile = await userApi.getProfile();
      set({
        profile,
        streak: profile.streakCount,
        streakUpdatedAt: profile.streakUpdatedAt ? new Date(profile.streakUpdatedAt) : null,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  setProfile: (profile) => {
    set({
      profile,
      streak: profile.streakCount,
      streakUpdatedAt: profile.streakUpdatedAt ? new Date(profile.streakUpdatedAt) : null,
    });
  },

  updateProfile: async (payload) => {
    set({ isLoading: true });
    try {
      const updatedProfile = await userApi.updateProfile(payload);
      set({ profile: updatedProfile, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  updatePreferences: async (prefs) => {
    set({ isLoading: true });
    try {
      const updatedPrefs = await userApi.updatePreferences(prefs);
      set({ preferences: updatedPrefs, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchStreak: async () => {
    try {
      const streakData = await userApi.getStreakData();
      set({
        streak: streakData.currentStreak,
        streakUpdatedAt: streakData.lastSessionDate ? new Date(streakData.lastSessionDate) : null,
      });
    } catch (error) {
      console.warn("Failed to fetch streak data:", error);
    }
  },

  incrementStreak: () => {
    const currentStreak = get().streak;
    set({
      streak: currentStreak + 1,
      streakUpdatedAt: new Date(),
    });
  },
}));
