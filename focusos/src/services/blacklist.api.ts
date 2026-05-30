import { apiClient } from "./client";
import type {
  BlacklistEntry,
  BlacklistSeverity,
  AddBlacklistEntryPayload,
} from "@/types/user.types";

export const blacklistApi = {
  /**
   * Fetch all domain restriction entries.
   */
  getBlacklist(): Promise<BlacklistEntry[]> {
    return apiClient.get<BlacklistEntry[]>("/blacklist/");
  },

  /**
   * Add a new blocked domain entry.
   */
  addBlacklistEntry(payload: AddBlacklistEntryPayload): Promise<BlacklistEntry> {
    return apiClient.post<BlacklistEntry>("/blacklist/", payload);
  },

  /**
   * Remove a domain from blocked list.
   */
  removeBlacklistEntry(id: string): Promise<void> {
    return apiClient.delete<void>(`/blacklist/${id}/`);
  },

  /**
   * Modify penalty levels for navigating to the site during active session.
   */
  changeSeverity(id: string, severity: BlacklistSeverity): Promise<BlacklistEntry> {
    return apiClient.patch<BlacklistEntry>(`/blacklist/${id}/`, { severity });
  },
};
