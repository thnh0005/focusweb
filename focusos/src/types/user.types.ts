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
  musicEnabled: boolean;
  musicTrack: string;
  customPlaylistUrl: string;
  musicAutoplay: boolean;
  useCustomPlaylist: boolean;
  customPlaylistProvider: string;
  ambientEffectEnabled: boolean;
  ambientEffectIntensity: number;
  themeAccent: string;
  workspaceBackgroundUrl: string;
  autoResumeSession: boolean;
  language: "vi" | "en";
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
  skipped?: boolean;
}

// ── Theme & Appearance ────────────────────────────────────────

export type AppTheme =
  | "minimal"
  | "forest"
  | "aurora-night"
  | "rain-room";

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
  notificationsEnabled: boolean;
  sessionReminderEnabled: boolean;
  sessionReminderTime: string | null;
  weeklySummaryEnabled: boolean;
  deepWorkSuggestionEnabled: boolean;
  browserPermissionGranted?: boolean;
}

export interface ThemePreferences {
  theme: AppTheme;
  themeAccent: string;
  workspaceBackgroundUrl: string;
}

// ── Blacklist Entry ───────────────────────────────────────────

export type BlacklistSeverity = "high" | "medium" | "low";

export interface BlacklistEntry {
  id: string;
  domain: string;
  severity: BlacklistSeverity;
  enabled: boolean;
  source?: "DEFAULT" | "USER";
  isDefault: boolean;
  addedAt: string;
  updatedAt?: string;
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
  musicEnabled?: boolean;
  musicTrack?: string;
  customPlaylistUrl?: string;
  musicAutoplay?: boolean;
  useCustomPlaylist?: boolean;
  customPlaylistProvider?: string;
  ambientEffectEnabled?: boolean;
  ambientEffectIntensity?: number;
  themeAccent?: string;
  workspaceBackgroundUrl?: string;
  autoResumeSession?: boolean;
  language?: "vi" | "en";
}

export interface UpdateNotificationSettingsPayload {
  notificationsEnabled?: boolean;
  sessionReminderEnabled?: boolean;
  sessionReminderTime?: string | null;
  weeklySummaryEnabled?: boolean;
  deepWorkSuggestionEnabled?: boolean;
}

export interface UpdateThemePreferencesPayload {
  theme?: AppTheme;
  themeAccent?: string;
  workspaceBackgroundUrl?: string;
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

export interface AccountExportJob {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "expired" | "cancelled";
  format: "zip";
  downloadUrl: string;
  downloadReady: boolean;
  fileSize: number;
  checksum: string;
  progress: number;
  errorCode: string;
  errorMessage: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface AccountDeletionJob {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  confirmed: boolean;
  errorCode: string;
  errorMessage: string;
  requestedAt: string;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AccountDeletionReceipt {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  statusToken: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  statusExpiresAt: string;
}

export interface AccountDeletionStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  statusExpiresAt: string;
  errorCode: string;
  errorMessage: string;
}

export interface StoredAccountDeletionReceipt {
  jobId: string;
  statusToken: string;
  statusExpiresAt: string;
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
