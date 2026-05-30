import { create } from "zustand";
import { sessionsApi } from "@/services/sessions.api";
import { blacklistApi } from "@/services/blacklist.api";
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
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  endSession: () => Promise<Session>;
  cancelSession: () => Promise<void>;
  updateRealtimeScore: (score: number, state: FocusStateLabel) => void;
  triggerWarning: (level: 1 | 2 | 3) => void;
  clearWarning: () => void;
  triggerAutoPause: () => void;
  setSessionNote: (note: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  sessionConfig: null,
  realtimeFocusScore: 100,
  focusState: "deep-focus" as FocusStateLabel,
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

      // 2. Register session in database
      const activeSession = await sessionsApi.createSession({
        mode: config.mode,
        goal: config.goal,
        targetDurationSeconds: config.durationMinutes * 60,
        tags: config.tags,
      });

      // 3. Dispatch to Chrome Extension bridge
      await notifySessionStart(
        activeSession.id,
        config.goal,
        config.mode,
        blacklistPayloads
      );

      // 4. Update local state
      set({
        activeSession,
        sessionConfig: config,
        sessionStatus: "active",
        realtimeFocusScore: 100,
        focusState: "deep-focus",
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

  pauseSession: async () => {
    const session = get().activeSession;
    if (!session) return;
    set({ isLoading: true });
    try {
      await sessionsApi.updateSession(session.id, { status: "paused" });
      await notifySessionPause(session.id);
      set({ sessionStatus: "paused", isLoading: false });
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
      await sessionsApi.updateSession(session.id, { status: "active" });
      await notifySessionResume(session.id);
      set({ sessionStatus: "active", isAutoPaused: false, warningLevel: null, isLoading: false });
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

      const completedSession = await sessionsApi.endSession(session.id, {
        actualDurationSeconds,
        note: get().sessionNote,
      });

      await notifySessionEnd(session.id);

      set({
        activeSession: null,
        sessionConfig: null,
        sessionStatus: "completed",
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
      await sessionsApi.cancelSession(session.id);
      await notifySessionEnd(session.id); // Cancel also signals tracking stop
      set({
        activeSession: null,
        sessionConfig: null,
        sessionStatus: "cancelled",
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

  setSessionNote: (note) => {
    set({ sessionNote: note });
  },
}));
