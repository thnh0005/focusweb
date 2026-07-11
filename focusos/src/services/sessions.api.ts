import { apiClient } from "./client";
import type {
  ActiveSession,
  Session,
  SessionSummary,
  GoalTemplate,
  SmartPreset,
  CreateSessionPayload,
  UpdateSessionPayload,
  EndSessionPayload,
} from "@/types/session.types";

interface ActiveSessionLookupResponse {
  has_active_session: boolean;
  session: ActiveSession | null;
}

export const sessionsApi = {
  /**
   * Create and start a new focus session.
   */
  createSession(payload: CreateSessionPayload): Promise<ActiveSession> {
    return apiClient.post<ActiveSession>("/sessions/", payload);
  },

  /**
   * Fetch the currently active session, used when the backend rejects
   * creating a duplicate open session.
   */
  async getActiveSession(): Promise<ActiveSession | null> {
    const response = await apiClient.get<ActiveSessionLookupResponse>(
      "/extension/active-session/"
    );
    return response.has_active_session ? response.session : null;
  },

  /**
   * Update active focus session (e.g. pause, resume, cancel, note, tags).
   */
  updateSession(id: string, payload: UpdateSessionPayload): Promise<Session> {
    return apiClient.patch<Session>(`/sessions/${id}/`, payload);
  },

  /**
   * Complete/end an active session.
   */
  endSession(id: string, payload: EndSessionPayload): Promise<Session> {
    return apiClient.post<Session>(`/sessions/${id}/end/`, payload);
  },

  /**
   * Cancel an active session.
   */
  cancelSession(id: string): Promise<void> {
    return apiClient.post<void>(`/sessions/${id}/cancel/`);
  },

  /**
   * Fetch the summary of a completed session, including AI insights.
   */
  getSessionSummary(id: string): Promise<SessionSummary> {
    return apiClient.get<SessionSummary>(`/sessions/${id}/summary/`);
  },

  /**
   * Fetch the user's pre-seeded and custom goal templates.
   */
  getGoalTemplates(): Promise<GoalTemplate[]> {
    return apiClient.get<GoalTemplate[]>("/sessions/templates/");
  },

  /**
   * Retrieve AI-driven smart preset suggestion for session modes.
   */
  getSmartPreset(): Promise<SmartPreset> {
    return apiClient.get<SmartPreset>("/sessions/smart-preset/");
  },

  /**
   * Fetch historical sessions with filtering.
   */
  getSessions(params?: {
    page?: number;
    mode?: string;
    tag?: string;
    limit?: number;
  }): Promise<{ results: Session[]; count: number; nextPage: number | null }> {
    return apiClient.get("/sessions/", { params });
  },
};
