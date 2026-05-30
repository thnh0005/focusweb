// ═══════════════════════════════════════════════════════════════
// User Types — FocusOS
// ═══════════════════════════════════════════════════════════════

import type { SessionMode } from "./session.types";

// ── Core User ─────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  onboardingComplete: boolean;
  isEmailVerified: boolean;
}

// ── User Profile (extended) ───────────────────────────────────

export interface UserProfile extends User {
  profession?: UserProfession;
  learningDomain?: string[];
  streakCount: number;
  streakUpdatedAt?: string;
  totalSessions: number;
  totalFocusMinutes: number;
}

// ── User Preferences ──────────────────────────────────────────

export interface UserPreferences {
  defaultMode: SessionMode;
  defaultDurationMinutes: number;
  theme: AppTheme;
  ambientEffect: AmbientEffect | null;
  notificationsEnabled: boolean;
  sessionReminderEnabled: boolean;
  sessionReminderTime: string | null; // "HH:mm" format
  weeklySummaryEnabled: boolean;
  deepWorkSuggestionEnabled: boolean;
  goalTemplates: import("./session.types").GoalTemplate[];
  customBlacklist: string[];
  soundEnabled: boolean;
  ambientSoundVolume: number; // 0-100
}

// ── Onboarding ────────────────────────────────────────────────

export type UserProfession =
  | "student"
  | "developer"
  | "designer"
  | "freelancer"
  | "researcher"
  | "other";

export interface OnboardingData {
  profession?: UserProfession;
  learningDomain?: string[];
  preferredDurationMinutes?: number;
  extensionInstalled?: boolean;
}

// ── Theme & Appearance ────────────────────────────────────────

export type AppTheme = "cyber" | "minimal" | "forest";

export type AmbientEffect = "rain" | "snow" | "stars" | "leaves" | null;

export interface ThemeConfig {
  id: AppTheme;
  label: string;
  description: string;
  previewImage?: string;
  cssClass: string;
}

// ── Streak ────────────────────────────────────────────────────

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastSessionDate?: string;
  milestoneReached?: 7 | 14 | 30 | null;
}

// ── Notification Settings ─────────────────────────────────────

export interface NotificationSettings {
  sessionReminderEnabled: boolean;
  sessionReminderTime: string | null;
  weeklySummaryEnabled: boolean;
  deepWorkSuggestionEnabled: boolean;
  browserPermissionGranted: boolean;
}

// ── Blacklist Entry ───────────────────────────────────────────

export type BlacklistSeverity = "high" | "medium";

export interface BlacklistEntry {
  id: string;
  domain: string;
  severity: BlacklistSeverity;
  isDefault: boolean;
  addedAt: string;
}

// ── API Payloads ──────────────────────────────────────────────

export interface UpdateProfilePayload {
  displayName?: string;
  avatarUrl?: string;
}

export interface UpdatePreferencesPayload {
  defaultMode?: SessionMode;
  defaultDurationMinutes?: number;
  theme?: AppTheme;
  ambientEffect?: AmbientEffect | null;
  notificationsEnabled?: boolean;
  sessionReminderEnabled?: boolean;
  sessionReminderTime?: string | null;
  weeklySummaryEnabled?: boolean;
  deepWorkSuggestionEnabled?: boolean;
  soundEnabled?: boolean;
  ambientSoundVolume?: number;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

export interface AddBlacklistEntryPayload {
  domain: string;
  severity: BlacklistSeverity;
}

// ── Auth ──────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  passwordConfirm: string;
}

export interface AuthResponse {
  user: User;
  message?: string;
}
