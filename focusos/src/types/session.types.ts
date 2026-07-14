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

export type LiveFocusStateLabel = FocusStateLabel | "unknown";

export type FocusStateLabelDisplay =
  | "Deep Focus"
  | "Focused"
  | "Average"
  | "Distracted"
  | "Highly Distracted"
  | "Gathering Data";

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
  elapsedActiveSeconds?: number;
  extensionBridgeToken?: string;
  startedAt: string;
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
  elapsedActiveSeconds?: number;
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
  score: number | null;
  state: LiveFocusStateLabel;
  updatedAt: Date;
}

export interface BackendRealtimeScore {
  session_id: string;
  session_status: SessionStatus;
  score: number | null;
  label: string | null;
  components: Record<string, number | null>;
  weights?: Record<string, number>;
  window_seconds?: number;
  event_count: number;
  data_quality: "INSUFFICIENT" | "PARTIAL" | "SUFFICIENT" | string;
  stale: boolean;
  source?: string;
  warning_count?: number;
  active_warning_cycle_count?: number;
  ai_status?: string;
  ai_error_code?: string | null;
  calculated_at?: string;
}

export interface SessionWarningEntry {
  id: string;
  cycle_id: string | null;
  level: WarningLevel;
  decision_state: string;
  decision_source?: string;
  decision_score: number | null;
  domain: string;
  reason_codes: string[];
  auto_pause_required: boolean;
  triggered_at: string;
}

export interface SessionWarningCycle {
  cycle_id: string;
  status: string;
  current_level: WarningLevel;
  decision_source?: string;
  next_warning_at: string | null;
  auto_pause_required: boolean;
  started_at: string;
  resolved_at: string | null;
}

export interface SessionWarningsResponse {
  session_id: string;
  session_status: SessionStatus;
  mode: SessionMode;
  warning_count: number;
  active_cycle: SessionWarningCycle | null;
  warnings: SessionWarningEntry[];
}

// ── Session Summary ───────────────────────────────────────────

export interface SessionSummary {
  session: Session;
  scoreBreakdown: FocusScoreBreakdown;
  scoreMetadata?: {
    source?: string;
    hasTrackingSignals?: boolean;
    hasBrowserEvents?: boolean;
    hasSemanticAi?: boolean;
    hasWarningEvents?: boolean;
    browserEventCount?: number;
    tabSwitchCount?: number;
    warningCount?: number;
    warningCycleCount?: number;
    semanticAnalysisCount?: number;
    durationRatio?: number;
    topWarningDomains?: Array<{ domain: string; count: number }>;
    [key: string]: unknown;
  };
  aiInsights: string[];
  distractionEvents: DistractionEvent[];
  recommendation?: string;
  isAiInsightReady: boolean;
  aiInsightStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  aiInsightSource?: "AI" | "RULE_BASED_FALLBACK" | null;
  aiInsightErrorCode?: string | null;
  aiInsightGeneratedAt?: string | null;
}

export interface SessionAIInsight {
  session_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  observations: string[];
  source: "AI" | "RULE_BASED_FALLBACK" | null;
  model: string | null;
  generated_at: string | null;
  retry_count: number;
  error_code: string | null;
}

export interface SessionAIInsightRetry {
  session_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  message: string;
  retry_count: number;
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
