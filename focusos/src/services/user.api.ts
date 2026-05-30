import { apiClient } from "./client";
import type {
  UserProfile,
  UserPreferences,
  StreakData,
  UpdateProfilePayload,
  UpdatePreferencesPayload,
} from "@/types/user.types";

export const userApi = {
  /**
   * Fetch expanded details of authenticated user profile.
   */
  getProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>("/user/profile/");
  },

  /**
   * Modify profile avatar URL or display name.
   */
  updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    return apiClient.patch<UserProfile>("/user/profile/", payload);
  },

  /**
   * Adjust default styling themes, sound volumes, and reminder schedules.
   */
  updatePreferences(payload: UpdatePreferencesPayload): Promise<UserPreferences> {
    return apiClient.patch<UserPreferences>("/user/preferences/", payload);
  },

  /**
   * Retrieve consecutive focus study days stats.
   */
  getStreakData(): Promise<StreakData> {
    return apiClient.get<StreakData>("/user/streak/");
  },
};
