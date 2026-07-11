import { ApiError, apiClient } from "./client";
import type {
  UserProfile,
  UserPreferences,
  StreakData,
  AccountDeletionJob,
  AccountDeletionReceipt,
  AccountDeletionStatus,
  AccountExportJob,
  NotificationSettings,
  StoredAccountDeletionReceipt,
  ThemePreferences,
  UpdateNotificationSettingsPayload,
  UpdateProfilePayload,
  UpdatePreferencesPayload,
  UpdateThemePreferencesPayload,
} from "@/types/user.types";

const ACCOUNT_DELETION_RECEIPT_KEY = "focusos.accountDeletionReceipt";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
   * Fetch current focus, notification, sound, music, and theme defaults.
   */
  getPreferences(): Promise<UserPreferences> {
    return apiClient.get<UserPreferences>("/user/preferences/");
  },

  /**
   * Adjust default styling themes, sound volumes, and reminder schedules.
   */
  updatePreferences(payload: UpdatePreferencesPayload): Promise<UserPreferences> {
    return apiClient.patch<UserPreferences>("/user/preferences/", payload);
  },

  getNotificationSettings(): Promise<NotificationSettings> {
    return apiClient.get<NotificationSettings>("/notifications/settings/");
  },

  updateNotificationSettings(
    payload: UpdateNotificationSettingsPayload
  ): Promise<NotificationSettings> {
    return apiClient.patch<NotificationSettings>("/notifications/settings/", payload);
  },

  getThemePreferences(): Promise<ThemePreferences> {
    return apiClient.get<ThemePreferences>("/theme/preferences/");
  },

  updateThemePreferences(
    payload: UpdateThemePreferencesPayload
  ): Promise<ThemePreferences> {
    return apiClient.patch<ThemePreferences>("/theme/preferences/", payload);
  },

  /**
   * Retrieve consecutive focus study days stats.
   */
  getStreakData(): Promise<StreakData> {
    return apiClient.get<StreakData>("/user/streak/");
  },

  requestAccountExport(): Promise<AccountExportJob> {
    return apiClient.post<AccountExportJob>("/account/export-data/");
  },

  getAccountExportJob(jobId: string): Promise<AccountExportJob> {
    return apiClient.get<AccountExportJob>(`/account/export-data/${jobId}/`);
  },

  deleteAccount(currentPassword: string): Promise<AccountDeletionReceipt> {
    return apiClient.delete<AccountDeletionReceipt>("/account/delete/", {
      body: JSON.stringify({ currentPassword }),
    });
  },

  getAccountDeletionJob(jobId: string): Promise<AccountDeletionJob> {
    return apiClient.get<AccountDeletionJob>(`/account/delete/${jobId}/`);
  },

  getAccountDeletionStatus(
    receipt: StoredAccountDeletionReceipt
  ): Promise<AccountDeletionStatus> {
    return apiClient.get<AccountDeletionStatus>(
      `/account/delete/${receipt.jobId}/status/`,
      {
        headers: {
          "X-Deletion-Status-Token": receipt.statusToken,
        },
      }
    );
  },

  saveAccountDeletionReceipt(receipt: AccountDeletionReceipt): void {
    if (!canUseSessionStorage()) return;
    const stored: StoredAccountDeletionReceipt = {
      jobId: receipt.jobId,
      statusToken: receipt.statusToken,
      statusExpiresAt: receipt.statusExpiresAt,
    };
    window.sessionStorage.setItem(
      ACCOUNT_DELETION_RECEIPT_KEY,
      JSON.stringify(stored)
    );
  },

  getStoredAccountDeletionReceipt(): StoredAccountDeletionReceipt | null {
    if (!canUseSessionStorage()) return null;
    const raw = window.sessionStorage.getItem(ACCOUNT_DELETION_RECEIPT_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredAccountDeletionReceipt;
      if (!parsed.jobId || !parsed.statusToken || !parsed.statusExpiresAt) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  clearAccountDeletionReceipt(): void {
    if (!canUseSessionStorage()) return;
    window.sessionStorage.removeItem(ACCOUNT_DELETION_RECEIPT_KEY);
  },

  async pollAccountDeletionStatus(
    receipt: StoredAccountDeletionReceipt,
    options: { intervalMs?: number; timeoutMs?: number } = {}
  ): Promise<AccountDeletionStatus | { status: "expired"; jobId: string }> {
    const intervalMs = options.intervalMs ?? 2000;
    const timeoutMs = options.timeoutMs ?? 120000;
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      if (Date.now() >= new Date(receipt.statusExpiresAt).getTime()) {
        userApi.clearAccountDeletionReceipt();
        return { status: "expired", jobId: receipt.jobId };
      }

      try {
        const deletionStatus = await userApi.getAccountDeletionStatus(receipt);
        if (["completed", "failed", "cancelled"].includes(deletionStatus.status)) {
          userApi.clearAccountDeletionReceipt();
          return deletionStatus;
        }
      } catch (error) {
        if (error instanceof ApiError && error.statusCode !== 401) {
          throw error;
        }
      }

      await wait(intervalMs);
    }

    return userApi.getAccountDeletionStatus(receipt);
  },
};
