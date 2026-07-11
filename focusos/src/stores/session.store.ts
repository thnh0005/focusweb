import { create } from "zustand";
import { sessionsApi } from "@/services/sessions.api";
import { blacklistApi } from "@/services/blacklist.api";
import { ApiError } from "@/services/client";
import {
  notifySessionStart,
  notifySessionPause,
  notifySessionResume,
  notifySessionEnd,
} from "@/lib/extension/bridge";
import type {
  ActiveSession,
  SessionConfig,
  Session,
  SessionStatus,
  FocusStateLabel,
} from "@/types/session.types";
import type { BlacklistPayload } from "@/types/extension.types";

export interface SessionState {
  // Current session details
  activeSession: ActiveSession | null;
  sessionConfig: SessionConfig | null;

  // Realtime extension telemetry
  realtimeFocusScore: number | null;
  focusState: FocusStateLabel | null;
  realtimeScoreUpdatedAt: number | null;
  realtimeScoreSource: "extension" | "backend" | null;
  warningLevel: 1 | 2 | 3 | null;
  isAutoPaused: boolean;
  tabSwitchCount: number;

  // Session lifecycle status
  sessionStatus: SessionStatus;

  // Interactive session notepad
  sessionNote: string;
  isLoading: boolean;

  // Actions
  startSession: (config: SessionConfig) => Promise<ActiveSession>;
  hydrateActiveSession: () => Promise<ActiveSession | null>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  endSession: () => Promise<Session>;
  cancelSession: () => Promise<void>;
  updateRealtimeScore: (score: number, state: FocusStateLabel) => void;
  triggerWarning: (level: 1 | 2 | 3) => void;
  clearWarning: () => void;
  triggerAutoPause: () => void;
  setTabSwitchCount: (count: number) => void;
  setSessionNote: (note: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  sessionConfig: null,
  realtimeFocusScore: null,
  focusState: null,
  realtimeScoreUpdatedAt: null,
  realtimeScoreSource: null,
  warningLevel: null,
  isAutoPaused: false,
  tabSwitchCount: 0,
  sessionStatus: "idle",
  sessionNote: "",
  isLoading: false,

  startSession: async (config) => {
    set({ isLoading: true });
    try {
      // 1. Fetch current blacklist entries to load into the extension bridge
      let blacklistPayloads: BlacklistPayload[] = [];
      try {
        const blacklistEntries = await blacklistApi.getBlacklist();
        blacklistPayloads = blacklistEntries.map((entry) => ({
          domain: entry.domain,
          severity: entry.severity,
        }));
      } catch (err) {
        console.warn("Could not load blacklist entries for extension sync:", err);
      }

      // 2. Register session in database. Nếu backend báo đã có session mở,
      // lấy lại session đó để người dùng tiếp tục vào phòng focus thay vì kẹt HTTP 400.
      let activeSession: ActiveSession;
      try {
        activeSession = await sessionsApi.createSession({
          mode: config.mode,
          goal: config.goal,
          targetDurationSeconds: config.durationMinutes * 60,
          tags: config.tags,
        });
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 400) {
          const existingSession = await sessionsApi.getActiveSession();
          if (existingSession) {
            activeSession = existingSession;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      // 3. Dispatch to Chrome Extension bridge
      await notifySessionStart(
        activeSession.id,
        config.goal,
        config.mode,
        blacklistPayloads,
        config.durationMinutes
      );

      // 4. Update local state
      set({
        activeSession,
        sessionConfig: config,
        sessionStatus: "active",
        realtimeFocusScore: null,
        focusState: null,
        realtimeScoreUpdatedAt: null,
        realtimeScoreSource: null,
        warningLevel: null,
        isAutoPaused: false,
        tabSwitchCount: 0,
        sessionNote: config.note ?? "",
        isLoading: false,
      });

      return activeSession;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  hydrateActiveSession: async () => {
    const existingSession = get().activeSession;
    if (existingSession) {
      return existingSession;
    }

    set({ isLoading: true });
    try {
      const activeSession = await sessionsApi.getActiveSession();
      if (!activeSession) {
        set({
          activeSession: null,
          sessionConfig: null,
          sessionStatus: "idle",
          realtimeFocusScore: null,
          focusState: null,
          realtimeScoreUpdatedAt: null,
          realtimeScoreSource: null,
          warningLevel: null,
          isAutoPaused: false,
          isLoading: false,
        });
        return null;
      }

      set({
        activeSession,
        sessionConfig: {
          mode: activeSession.mode,
          goal: activeSession.goal,
          durationMinutes: Math.round(activeSession.targetDurationSeconds / 60),
          tags: activeSession.tags,
        },
        sessionStatus: activeSession.status,
        sessionNote: "",
        isAutoPaused: activeSession.status === "auto-paused",
        isLoading: false,
      });

      return activeSession;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  pauseSession: async () => {
    const session = get().activeSession;
    if (!session) return;
    set({ isLoading: true });
    try {
      await notifySessionPause(session.id);
      const updatedSession = await sessionsApi.updateSession(session.id, { status: "paused" });
      set({
        activeSession: {
          ...session,
          elapsedActiveSeconds: updatedSession.elapsedActiveSeconds,
          status: updatedSession.status,
        },
        sessionStatus: updatedSession.status,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  resumeSession: async () => {
    const session = get().activeSession;
    if (!session) return;
    set({ isLoading: true });
    try {
      const updatedSession = await sessionsApi.updateSession(session.id, { status: "active" });
      await notifySessionResume(session.id);
      set({
        activeSession: {
          ...session,
          elapsedActiveSeconds: updatedSession.elapsedActiveSeconds,
          status: updatedSession.status,
        },
        sessionStatus: updatedSession.status,
        isAutoPaused: false,
        warningLevel: null,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  endSession: async () => {
    const session = get().activeSession;
    if (!session) throw new Error("No active session to end");
    set({ isLoading: true });
    try {
      const actualDurationSeconds = Math.round(
        (Date.now() - new Date(session.startedAt).getTime()) / 1000
      );

      await notifySessionEnd(session.id);
      const completedSession = await sessionsApi.endSession(session.id, {
        actualDurationSeconds,
        note: get().sessionNote,
      });

      set({
        activeSession: null,
        sessionConfig: null,
        sessionStatus: "completed",
        realtimeFocusScore: null,
        focusState: null,
        realtimeScoreUpdatedAt: null,
        realtimeScoreSource: null,
        warningLevel: null,
        isLoading: false,
      });

      return completedSession;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  cancelSession: async () => {
    const session = get().activeSession;
    if (!session) return;
    set({ isLoading: true });
    try {
      await notifySessionEnd(session.id); // Cancel also signals tracking stop
      await sessionsApi.cancelSession(session.id);
      set({
        activeSession: null,
        sessionConfig: null,
        sessionStatus: "cancelled",
        realtimeFocusScore: null,
        focusState: null,
        realtimeScoreUpdatedAt: null,
        realtimeScoreSource: null,
        warningLevel: null,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  updateRealtimeScore: (score, state) => {
    set({
      realtimeFocusScore: score,
      focusState: state,
      realtimeScoreUpdatedAt: Date.now(),
      realtimeScoreSource: "extension",
    });
  },

  triggerWarning: (level) => {
    set({ warningLevel: level });
  },

  clearWarning: () => {
    set({ warningLevel: null });
  },

  triggerAutoPause: () => {
    const session = get().activeSession;
    if (!session) return;
    
    // Switch to auto-paused
    notifySessionPause(session.id);
    set({
      sessionStatus: "auto-paused",
      isAutoPaused: true,
    });
  },

  setTabSwitchCount: (count) => {
    set({ tabSwitchCount: Math.max(0, count) });
  },

  setSessionNote: (note) => {
    set({ sessionNote: note });
  },
}));
