import { apiClient } from "./client";
import type {
  Task,
  CreateTaskPayload,
  UpdateTaskPayload,
} from "@/types/task.types";

export const tasksApi = {
  /**
   * Fetch all tasks. Optionally filter by focus session ID.
   */
  getTasks(sessionId?: string): Promise<Task[]> {
    return apiClient.get<Task[]>("/tasks/", {
      params: { session_id: sessionId },
    });
  },

  /**
   * Create a new task checklist item.
   */
  createTask(payload: CreateTaskPayload): Promise<Task> {
    return apiClient.post<Task>("/tasks/", payload);
  },

  /**
   * Update task description, status or associated focus session.
   */
  updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
    return apiClient.patch<Task>(`/tasks/${id}/`, payload);
  },

  /**
   * Permanently delete a task item from checklist.
   */
  deleteTask(id: string): Promise<void> {
    return apiClient.delete<void>(`/tasks/${id}/`);
  },
};
