"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Flag,
  Home,
  RotateCcw,
  Sparkles,
  Timer,
  TrendingUp,
} from "lucide-react";
import { AmbientWorkspaceBackground } from "@/components/focus-home";
import { Button } from "@/components/ui/Button";
import { FocusScoreGauge } from "@/components/ui/FocusScoreGauge";
import { Spinner } from "@/components/ui/Spinner";
import { sessionsApi } from "@/services/sessions.api";
import { cn } from "@/lib/utils/cn";
import type { FocusScoreBreakdown, FocusStateLabel, SessionAIInsight } from "@/types/session.types";

const POLL_INTERVAL_MS = 3000;

type T = (key: string, options?: Record<string, string | number | undefined>) => string;

type ScoreEvaluation = {
  title: string;
  summary: string;
  strongest: string;
  weakest: string;
};

function getFocusStateLabel(score: number | null, state: FocusStateLabel | null, t: T) {
  if (state) return t(`scoreLabels.${state}`);
  if (typeof score !== "number") return t("scoreLabels.unknown");
  if (score >= 85) return t("scoreLabels.deep-focus");
  if (score >= 70) return t("scoreLabels.focused");
  if (score >= 50) return t("scoreLabels.average");
  if (score >= 30) return t("scoreLabels.distracted");
  return t("scoreLabels.highly-distracted");
}

function getComponentLabel(key: keyof FocusScoreBreakdown, t: T) {
  return {
    contentRelevance: t("summary.signals.contentRelevance"),
    focusContinuity: t("summary.signals.focusContinuity"),
    tabStability: t("summary.signals.tabStability"),
    distractionPenalty: t("summary.signals.distractionPenalty"),
    total: t("summary.signals.total"),
  }[key];
}

function buildScoreEvaluation(
  breakdown: FocusScoreBreakdown | undefined,
  score: number | null,
  tabSwitchCount: number | undefined,
  t: T
): ScoreEvaluation {
  if (!breakdown || typeof score !== "number") {
    return {
      title: t("summary.scoreEvaluation.pendingTitle"),
      summary: t("summary.scoreEvaluation.pendingSummary"),
      strongest: t("summary.scoreEvaluation.noStrongest"),
      weakest: t("summary.scoreEvaluation.noWeakest"),
    };
  }

  const entries = ([
    ["contentRelevance", breakdown.contentRelevance],
    ["focusContinuity", breakdown.focusContinuity],
    ["tabStability", breakdown.tabStability],
    ["distractionPenalty", breakdown.distractionPenalty],
  ] as Array<[keyof FocusScoreBreakdown, number]>).sort((a, b) => b[1] - a[1]);
  const strongest = entries[0];
  const weakest = entries[entries.length - 1];
  const title =
    score >= 85
      ? t("summary.scoreEvaluation.excellent")
      : score >= 70
        ? t("summary.scoreEvaluation.solid")
        : score >= 50
          ? t("summary.scoreEvaluation.mixed")
          : t("summary.scoreEvaluation.recovery");

  return {
    title,
    summary: t("summary.scoreEvaluation.summary", {
      count: typeof tabSwitchCount === "number" ? tabSwitchCount : 0,
    }),
    strongest: t("summary.scoreEvaluation.strongest", {
      signal: getComponentLabel(strongest[0], t),
      value: Math.round(strongest[1]),
    }),
    weakest: t("summary.scoreEvaluation.weakest", {
      signal: getComponentLabel(weakest[0], t),
      value: Math.round(weakest[1]),
    }),
  };
}

function insightLabel(status: string, source: string | null | undefined, t: T) {
  if (status === "FAILED") return t("summary.insight.failed");
  if (status === "COMPLETED" && source === "AI") return t("summary.insight.ai");
  if (status === "COMPLETED" && source === "RULE_BASED_FALLBACK") return t("summary.insight.fallback");
  return t("summary.insight.processing");
}

function readNonnegativeCount(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : undefined;
}

export default function SessionSummaryPage() {
  const { t } = useTranslation("focus");
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const {
    data: session,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["session-summary", sessionId],
    queryFn: () => sessionsApi.getSessionSummary(sessionId),
    refetchInterval: (query) => {
      const summary = query.state.data;
      if (!summary) return POLL_INTERVAL_MS;
      return summary.scoreBreakdown ? false : POLL_INTERVAL_MS;
    },
    retry: false,
  });
  const summarySessionId = session?.session?.id;
  const hasMismatchedSummary = Boolean(summarySessionId && summarySessionId !== sessionId);

  React.useEffect(() => {
    if (!summarySessionId || summarySessionId === sessionId) return;
    void queryClient.invalidateQueries({ queryKey: ["session-summary", sessionId] });
    void refetch();
  }, [queryClient, refetch, sessionId, summarySessionId]);

  const insightQuery = useQuery({
    queryKey: ["session-ai-insight", sessionId],
    queryFn: () => sessionsApi.getSessionAIInsight(sessionId),
    enabled: Boolean(session),
    refetchInterval: (query) => {
      const insight = query.state.data;
      if (!insight) return POLL_INTERVAL_MS;
      return insight.status === "PENDING" || insight.status === "PROCESSING"
        ? POLL_INTERVAL_MS
        : false;
    },
    retry: false,
  });

  const retryInsightMutation = useMutation({
    mutationFn: () => sessionsApi.retrySessionAIInsight(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session-ai-insight", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["session-summary", sessionId] });
    },
  });

  if (isLoading) {
    return (
      <AmbientWorkspaceBackground className="min-h-[100dvh]">
        <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="glass-panel flex h-20 w-20 items-center justify-center rounded-3xl">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-text-muted">{t("summary.loading")}</p>
        </main>
      </AmbientWorkspaceBackground>
    );
  }

  if (isError || !session || hasMismatchedSummary) {
    return (
      <AmbientWorkspaceBackground className="min-h-[100dvh]">
        <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
          <section className="max-w-md rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.68)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <h1 className="text-2xl font-light text-text-primary">{t("summary.notFoundTitle")}</h1>
            <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
              {t("summary.notFoundDescription")}
            </p>
            <Button
              type="button"
              onClick={() => router.push("/dashboard")}
              variant="session"
              className="mt-6 rounded-full px-6"
            >
              {t("summary.backHome")}
            </Button>
          </section>
        </main>
      </AmbientWorkspaceBackground>
    );
  }

  const sess = session.session;
  const targetDurationMinutes = Math.floor(sess.targetDurationSeconds / 60);
  const actualDurationMinutes = Math.floor(sess.actualDurationSeconds / 60);
  const hasScore = typeof sess.focusScore === "number";
  const focusScoreValue = hasScore ? Math.round(sess.focusScore ?? 0) : null;
  const focusStateLabel = getFocusStateLabel(focusScoreValue, sess.focusState, t);
  const scoreBreakdown = session.scoreBreakdown ?? sess.scoreBreakdown;
  const liveInsight: SessionAIInsight | undefined = insightQuery.data;
  const insights = liveInsight?.observations?.length
    ? liveInsight.observations
    : session.aiInsights?.length
      ? session.aiInsights
      : sess.aiInsight ?? [];
  const currentInsightStatus =
    liveInsight?.status ?? session.aiInsightStatus ?? (session.isAiInsightReady ? "COMPLETED" : "PENDING");
  const currentInsightSource = liveInsight?.source ?? session.aiInsightSource;
  const tabSwitchCount =
    readNonnegativeCount(session.scoreMetadata?.tabSwitchCount) ?? readNonnegativeCount(sess.tabSwitchCount);
  const scoreEvaluation = buildScoreEvaluation(scoreBreakdown, focusScoreValue, tabSwitchCount, t);
  const recommendation = session.distractionEvents?.length
    ? t("summary.recommendations.reviewDistractions")
    : t("summary.recommendations.tryAnother", { count: targetDurationMinutes || 50 });

  return (
    <AmbientWorkspaceBackground className="min-h-[100dvh]">
      <main className="mx-auto flex h-[100dvh] w-full max-w-[1320px] flex-col gap-4 overflow-hidden px-4 py-4 sm:px-5 lg:px-6">
        <section className="min-w-0 shrink-0 rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.58)] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-5">
          <nav className="mb-4 flex items-center justify-between gap-3" aria-label={t("summary.nav")}>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 text-xs text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("summary.backHome")}
            >
              <ArrowLeft className="h-3.5 w-3.5 stroke-[1.6]" aria-hidden="true" />
              {t("summary.backHome")}
            </button>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-text-muted">
              {t("summary.completed")}
            </span>
          </nav>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs text-text-muted">{t("summary.eyebrow")}</p>
              <h1 className="mt-2 truncate text-3xl font-light leading-tight text-text-primary md:text-4xl">
                {t("summary.title", { count: actualDurationMinutes })}
              </h1>
              <p className="mt-2 line-clamp-2 max-w-[48rem] text-sm font-light leading-relaxed text-text-secondary">
                {t("summary.subtitle", { state: focusStateLabel })}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <MetricTile label={t("summary.metrics.target")} value={t("summary.minutes", { count: targetDurationMinutes })} />
                <MetricTile label={t("summary.metrics.actual")} value={t("summary.minutes", { count: actualDurationMinutes })} />
                <MetricTile label={t("summary.metrics.mode")} value={sess.mode === "deep-work" ? t("deepWorkMode") : t("normalMode")} />
                {typeof tabSwitchCount === "number" && (
                  <MetricTile label={t("summary.details.tabSwitches")} value={String(tabSwitchCount)} />
                )}
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-center gap-4 rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-3 lg:flex-col lg:gap-2">
              {hasScore && focusScoreValue !== null ? (
                <>
                  <FocusScoreGauge
                    score={focusScoreValue}
                    size={108}
                    strokeWidth={6}
                    showScore={false}
                    showLabel={false}
                  />
                  <div className="text-center">
                    <p className="text-3xl font-light tabular-nums text-text-primary">
                      {focusScoreValue}/100
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-text-secondary">{focusStateLabel}</p>
                  </div>
                </>
              ) : (
                <div className="flex h-[108px] w-[108px] items-center justify-center rounded-full border border-white/10 text-sm text-text-muted">
                  {t("summary.noScore")}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_300px]">
          <div className="grid min-h-0 min-w-0 gap-4">
            <SummaryPanel
              icon={TrendingUp}
              title={t("summary.scoreEvaluation.title")}
              description={t("summary.scoreEvaluation.description")}
              compact
            >
              <div className="grid gap-2">
                <ScoreEvaluationCard
                  label={scoreEvaluation.title}
                  value={focusScoreValue !== null ? `${focusScoreValue}/100` : t("summary.pending")}
                  description={scoreEvaluation.summary}
                  compact
                />
                <ScoreEvaluationCard
                  label={t("summary.scoreEvaluation.strongestLabel")}
                  value={t("summary.scoreEvaluation.keep")}
                  description={scoreEvaluation.strongest}
                  compact
                />
                <ScoreEvaluationCard
                  label={t("summary.scoreEvaluation.nextLabel")}
                  value={t("summary.scoreEvaluation.adjust")}
                  description={scoreEvaluation.weakest}
                  compact
                />
              </div>
            </SummaryPanel>

            <SummaryPanel
              icon={BarChart3}
              title={t("summary.breakdown.title")}
              description={t("summary.breakdown.description")}
              compact
            >
              {scoreBreakdown ? (
                <BreakdownList breakdown={scoreBreakdown} t={t} compact />
              ) : (
                <p className="text-sm text-text-secondary">{t("summary.breakdown.empty")}</p>
              )}
            </SummaryPanel>
          </div>

          <SummaryPanel
            icon={Sparkles}
            title={t("summary.insight.title")}
            description={insightLabel(currentInsightStatus, currentInsightSource, t)}
            compact
          >
            {insights.length > 0 ? (
              <div className="space-y-2">
                {insights.slice(0, 3).map((insight, index) => (
                  <p
                    key={`${insight}-${index}`}
                    className="line-clamp-4 rounded-[1rem] border border-white/10 bg-white/[0.035] p-3 text-sm font-light leading-relaxed text-text-secondary"
                    title={insight}
                  >
                    {insight}
                  </p>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="line-clamp-4 text-sm font-light leading-relaxed text-text-secondary">
                  {currentInsightStatus === "FAILED"
                    ? t("summary.insight.failedBody")
                    : t("summary.insight.processingBody")}
                </p>
                {currentInsightStatus === "FAILED" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => retryInsightMutation.mutate()}
                    disabled={retryInsightMutation.isPending}
                    className="rounded-full"
                  >
                    {retryInsightMutation.isPending
                      ? t("summary.insight.retrying")
                      : t("summary.insight.retry")}
                  </Button>
                )}
              </div>
            )}
          </SummaryPanel>

          <aside className="grid min-h-0 min-w-0 gap-4">
            <section className="min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[rgb(10_13_10/0.56)] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
              <h2 className="text-lg font-light text-text-primary">{t("summary.nextStep.title")}</h2>
              <p className="mt-2 line-clamp-3 text-sm font-light leading-relaxed text-text-secondary">
                {recommendation}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button type="button" variant="session" onClick={() => router.push("/dashboard")} className="h-10 rounded-full">
                  <RotateCcw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  {t("summary.nextStep.tryAgain", { count: targetDurationMinutes || 50 })}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/analytics")} className="h-10 rounded-full">
                  <BarChart3 className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  {t("summary.nextStep.analytics")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")} className="h-10 rounded-full">
                  <Home className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  {t("summary.backHome")}
                </Button>
              </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[rgb(10_13_10/0.56)] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
              <h2 className="text-base font-light text-text-primary">{t("summary.details.title")}</h2>
              <div className="mt-3 space-y-2">
                <MetaRow icon={Flag} label={t("summary.details.mode")} value={sess.mode === "deep-work" ? t("deepWorkMode") : t("normalMode")} />
                <MetaRow icon={Clock} label={t("summary.details.target")} value={t("summary.minutes", { count: targetDurationMinutes })} />
                <MetaRow icon={Timer} label={t("summary.details.actual")} value={t("summary.minutes", { count: actualDurationMinutes })} />
              </div>
              {sess.goal && (
                <div className="mt-3 rounded-[1rem] border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-xs font-mono text-text-muted">{t("summary.details.goal")}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-light leading-relaxed text-text-secondary" title={sess.goal}>
                    {sess.goal}
                  </p>
                </div>
              )}
            </section>
          </aside>
        </section>
      </main>
    </AmbientWorkspaceBackground>
  );
}

type SummaryIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function SummaryPanel({
  icon: Icon,
  title,
  description,
  children,
  compact = false,
}: {
  icon: SummaryIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[rgb(10_13_10/0.56)] shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl",
        compact ? "p-4" : "p-5 sm:p-6"
      )}
    >
      <div className={cn("flex items-center gap-3", compact ? "mb-3" : "mb-5")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.045] text-primary">
          <Icon className="h-4 w-4 stroke-[1.6]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className={cn("truncate font-light text-text-primary", compact ? "text-base" : "text-xl")}>{title}</h2>
          <p className={cn("text-text-muted", compact ? "line-clamp-1 text-xs" : "text-sm")}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[1rem] border border-white/10 bg-white/[0.035] p-2.5">
      <p className="truncate text-[11px] text-text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

function BreakdownList({ breakdown, t, compact = false }: { breakdown: FocusScoreBreakdown; t: T; compact?: boolean }) {
  const rows = [
    { key: "contentRelevance" as const, value: breakdown.contentRelevance },
    { key: "focusContinuity" as const, value: breakdown.focusContinuity },
    { key: "tabStability" as const, value: breakdown.tabStability },
    { key: "distractionPenalty" as const, value: breakdown.distractionPenalty },
  ];

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {rows.map((row) => (
        <div key={row.key} className={cn("rounded-[1rem] border border-white/10 bg-white/[0.025]", compact ? "p-2.5" : "p-4")}>
          <div className={cn("flex items-center justify-between gap-4", compact ? "mb-2" : "mb-3")}>
            <span className="truncate text-sm text-text-secondary">{getComponentLabel(row.key, t)}</span>
            <span className="text-sm font-mono tabular-nums text-text-primary">
              {Math.round(row.value)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-slow",
                row.key === "distractionPenalty" ? "bg-urgency-amber" : "bg-primary"
              )}
              style={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreEvaluationCard({
  label,
  value,
  description,
  compact = false,
}: {
  label: string;
  value: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <article className={cn("min-w-0 rounded-[1rem] border border-white/10 bg-white/[0.035]", compact ? "p-3" : "p-4")}>
      <p className="truncate text-xs font-mono text-text-muted">{label}</p>
      <p className={cn("font-light text-text-primary", compact ? "mt-1.5 text-lg" : "mt-3 text-2xl")}>{value}</p>
      <p className={cn("text-sm font-light leading-relaxed text-text-secondary", compact ? "mt-1 line-clamp-2" : "mt-3")}>{description}</p>
    </article>
  );
}

type MetaIcon = React.ComponentType<{ className?: string }>;

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: MetaIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
        <Icon className="h-4 w-4 shrink-0 stroke-[1.6] text-text-muted" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}
