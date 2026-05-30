// ═══════════════════════════════════════════════════════════════
// Session Types — FocusOS
// ═══════════════════════════════════════════════════════════════

export type SessionMode = "normal" | "deep-work";

export type SessionStatus =
  | "idle"
  | "configuring"
  | "active"
  | "paused"
  | "auto-paused"
  | "ending"
  | "completed"
  | "cancelled";

export type FocusStateLabel =
  | "deep-focus"
  | "focused"
  | "average"
  | "distracted"
  | "highly-distracted";

export type FocusStateLabelDisplay =
  | "Deep Focus"
  | "Focused"
  | "Average"
  | "Distracted"
  | "Highly Distracted";

export type WarningLevel = 1 | 2 | 3;

export type DistractionLevel = "focused" | "potentially-distracted" | "distracted";

// ── Session Configuration (pre-session setup) ─────────────────

export interface SessionConfig {
  mode: SessionMode;
  goal?: string;
  goalTemplateId?: string;
  durationMinutes: number;
  tags: string[];
  note?: string;
}

// ── Active Session (during session) ──────────────────────────

export interface ActiveSession {
  id: string;
  userId: string;
  mode: SessionMode;
  goal?: string;
  tags: string[];
  targetDurationSeconds: number;
  startedAt: Date;
  status: SessionStatus;
}

// ── Session (stored / historical) ────────────────────────────

export interface Session {
  id: string;
  userId: string;
  name?: string;
  mode: SessionMode;
  goal?: string;
  tags: string[];
  note?: string;
  targetDurationSeconds: number;
  actualDurationSeconds: number;
  focusScore: number | null;
  focusState: FocusStateLabel | null;
  status: SessionStatus;
  scoreBreakdown?: FocusScoreBreakdown;
  aiInsight?: string[];
  distractionCount?: number;
  tabSwitchCount?: number;
  startedAt: string; // ISO string
  endedAt?: string;  // ISO string
  createdAt: string;
}

// ── Focus Score ───────────────────────────────────────────────

export interface FocusScoreBreakdown {
  contentRelevance: number;  // 0–100, weight: 40%
  focusContinuity: number;   // 0–100, weight: 30%
  tabStability: number;      // 0–100, weight: 15%
  distractionPenalty: number; // 0–100, weight: 15%
  total: number;             // 0–100 final score
}

export interface RealtimeFocusData {
  score: number;
  state: FocusStateLabel;
  updatedAt: Date;
}

// ── Session Summary ───────────────────────────────────────────

export interface SessionSummary {
  session: Session;
  scoreBreakdown: FocusScoreBreakdown;
  aiInsights: string[];
  distractionEvents: DistractionEvent[];
  recommendation?: string;
  isAiInsightReady: boolean;
}

export interface DistractionEvent {
  id: string;
  sessionId: string;
  warningLevel: WarningLevel;
  domain?: string;
  triggeredAt: string;
  resolved: boolean;
}

// ── Goal Template ─────────────────────────────────────────────

export interface GoalTemplate {
  id: string;
  label: string;
  text: string;
  isBuiltIn: boolean;
  usageCount?: number;
  lastUsedAt?: string;
}

// ── Smart Preset ──────────────────────────────────────────────

export interface SmartPreset {
  mode: SessionMode;
  durationMinutes: number;
  rationale: string;
  confidence: number;
}

// ── Ambient Track ─────────────────────────────────────────────

export interface AmbientTrack {
  id: string;
  label: string;
  category: "lofi" | "rain" | "nature" | "cafe" | "whitenoise" | "custom";
  audioUrl?: string;
  streamUrl?: string;
  icon: string;
}

// ── Session Phase ─────────────────────────────────────────────

export type SessionPhase = "focus" | "short-break" | "long-break";

export interface PhaseConfig {
  phase: SessionPhase;
  durationMinutes: number;
  glowColor: string;
  timerRingColor: string;
  microcopy: string;
}

// ── API Payloads ──────────────────────────────────────────────

export interface CreateSessionPayload {
  mode: SessionMode;
  goal?: string;
  targetDurationSeconds: number;
  tags?: string[];
}

export interface UpdateSessionPayload {
  status?: SessionStatus;
  note?: string;
  tags?: string[];
}

export interface EndSessionPayload {
  actualDurationSeconds: number;
  note?: string;
}
