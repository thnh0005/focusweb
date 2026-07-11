import { apiClient } from "./client";

export type NotificationRecordType =
  | "session_reminder"
  | "weekly_summary"
  | "deep_work_suggestion"
  | "test";

export interface NotificationRecord {
  id: string;
  type: NotificationRecordType;
  title: string;
  message: string;
  status: "pending" | "created" | "delivered" | "failed" | "read";
  scheduledFor: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TestNotificationResponse {
  status: "created";
  test: true;
  notification: NotificationRecord & {
    source_type: "session_reminder" | "weekly_summary" | "deep_work_suggestion" | "generic";
  };
}

export const notificationsApi = {
  createTestNotification(
    type: "session_reminder" | "weekly_summary" | "deep_work_suggestion" | "generic"
  ): Promise<TestNotificationResponse> {
    return apiClient.post<TestNotificationResponse>("/notifications/test/", { type });
  },
};
