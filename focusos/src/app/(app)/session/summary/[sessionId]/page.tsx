"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Clock, Flag, Home, RotateCcw, Sparkles, Timer } from "lucide-react";
import { AmbientScene } from "@/components/ambient/AmbientScene";
import { Button } from "@/components/ui/Button";
import { FocusScoreGauge } from "@/components/ui/FocusScoreGauge";
import { Spinner } from "@/components/ui/Spinner";
import { sessionsApi } from "@/services/sessions.api";
import { cn } from "@/lib/utils/cn";
import type { FocusScoreBreakdown, FocusStateLabel } from "@/types/session.types";

function getFocusStateLabel(score: number | null, state: FocusStateLabel | null) {
  if (state) {
    return state
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  if (typeof score !== "number") return "Reflection ready";
  if (score >= 85) return "Deep Focus";
  if (score >= 70) return "Focused";
  if (score >= 50) return "Average";
  if (score >= 30) return "Distracted";
  return "Highly Distracted";
}

export default function SessionSummaryPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const {
    data: session,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["session-summary", sessionId],
    queryFn: () => sessionsApi.getSessionSummary(sessionId),
  });

  if (isLoading) {
    return (
      <AmbientScene variant="minimal" intensity="low" className="min-h-[100dvh]">
        <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="glass-panel flex h-20 w-20 items-center justify-center rounded-3xl">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-text-muted">Loading session reflection</p>
        </main>
      </AmbientScene>
    );
  }

  if (isError || !session) {
    return (
      <AmbientScene variant="minimal" intensity="low" className="min-h-[100dvh]">
        <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="glass-card max-w-md rounded-3xl p-8">
            <h1 className="text-2xl font-light text-text-primary">Session not found</h1>
            <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
              The reflection for this session is not available.
            </p>
            <Button
              type="button"
              onClick={() => router.push("/dashboard")}
              variant="session"
              className="mt-6 rounded-full px-6"
            >
              Back to Focus Home
            </Button>
          </div>
        </main>
      </AmbientScene>
    );
  }

  const sess = session.session;
  const targetDurationMinutes = Math.floor(sess.targetDurationSeconds / 60);
  const actualDurationMinutes = Math.floor(sess.actualDurationSeconds / 60);
  const hasScore = typeof sess.focusScore === "number";
  const focusScoreValue = hasScore ? Math.round(sess.focusScore ?? 0) : null;
  const focusStateLabel = getFocusStateLabel(focusScoreValue, sess.focusState);
  const scoreBreakdown = session.scoreBreakdown ?? sess.scoreBreakdown;
  const insights = session.aiInsights?.length ? session.aiInsights : sess.aiInsight ?? [];
  const recommendation =
    session.recommendation || `Try another ${targetDurationMinutes || 50}-minute session`;

  return (
    <AmbientScene variant="forest" intensity="medium" className="min-h-[100dvh]">
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to Focus Home"
          title="Back to Focus Home"
        >
          <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
        </button>

        <section className="glass-card ambient-glow rounded-[2rem] p-5 shadow-ambient sm:p-7 lg:p-9">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <p className="text-sm text-text-muted">Session reflection</p>
              <h1 className="mt-3 max-w-3xl text-balance text-4xl font-light leading-tight text-text-primary md:text-6xl">
                You stayed focused for {actualDurationMinutes} minutes
              </h1>
              <p className="mt-4 max-w-[42rem] text-base font-light leading-relaxed text-text-secondary">
                {focusStateLabel} work, captured without turning the session into a report.
              </p>
            </div>

            <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              {hasScore && focusScoreValue !== null ? (
                <>
                  <FocusScoreGauge
                    score={focusScoreValue}
                    size={180}
                    strokeWidth={7}
                    showScore={false}
                    showLabel={false}
                  />
                  <p className="mt-4 text-center text-4xl font-light tabular-nums text-text-primary">
                    {focusScoreValue}/100
                  </p>
                </>
              ) : (
                <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border border-white/10 text-sm text-text-muted">
                  No score
                </div>
              )}
              <p className="mt-2 text-sm text-text-secondary">{focusStateLabel}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-primary">
                  <BarChart3 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-light text-text-primary">Focus breakdown</h2>
                  <p className="text-sm text-text-muted">Soft signals from the session</p>
                </div>
              </div>
              {scoreBreakdown ? (
                <BreakdownList breakdown={scoreBreakdown} />
              ) : (
                <p className="text-sm text-text-secondary">
                  Detailed scoring signals are not available for this session.
                </p>
              )}
            </div>

            <div className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-primary">
                  <Sparkles className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-light text-text-primary">AI insight</h2>
                  <p className="text-sm text-text-muted">
                    {session.isAiInsightReady ? "Observation ready" : "Still preparing"}
                  </p>
                </div>
              </div>
              {insights.length > 0 ? (
                <div className="space-y-3">
                  {insights.map((insight, index) => (
                    <p
                      key={`${insight}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm font-light leading-relaxed text-text-secondary"
                    >
                      {insight}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-light leading-relaxed text-text-secondary">
                  No AI observation is available yet. The session details are still saved.
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
              <h2 className="text-xl font-light text-text-primary">Next step</h2>
              <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
                {recommendation}
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <Button
                  type="button"
                  variant="session"
                  onClick={() => router.push("/session")}
                  className="rounded-full"
                >
                  <RotateCcw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  Try another {targetDurationMinutes || 50}-minute session
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/analytics")}
                  className="rounded-full"
                >
                  <BarChart3 className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  Review analytics
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                  className="rounded-full"
                >
                  <Home className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  Back to Focus Home
                </Button>
              </div>
            </div>

            <div className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
              <h2 className="text-lg font-light text-text-primary">Session details</h2>
              <div className="mt-5 space-y-3">
                <MetaRow icon={Flag} label="Mode" value={sess.mode === "deep-work" ? "Deep Work" : "Normal"} />
                <MetaRow icon={Clock} label="Target" value={`${targetDurationMinutes} min`} />
                <MetaRow icon={Timer} label="Actual" value={`${actualDurationMinutes} min`} />
                {typeof sess.tabSwitchCount === "number" && (
                  <MetaRow icon={BarChart3} label="Tab switches" value={String(sess.tabSwitchCount)} />
                )}
              </div>
              {sess.goal && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-mono text-text-muted">Goal</p>
                  <p className="mt-2 text-sm font-light leading-relaxed text-text-secondary">
                    {sess.goal}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </AmbientScene>
  );
}

function BreakdownList({ breakdown }: { breakdown: FocusScoreBreakdown }) {
  const rows = [
    { label: "Content relevance", value: breakdown.contentRelevance },
    { label: "Focus continuity", value: breakdown.focusContinuity },
    { label: "Tab stability", value: breakdown.tabStability },
    { label: "Distraction penalty", value: breakdown.distractionPenalty },
  ];

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="text-sm text-text-secondary">{row.label}</span>
            <span className="text-sm font-mono tabular-nums text-text-primary">
              {Math.round(row.value)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-slow",
                row.label === "Distraction penalty" ? "bg-urgency-amber" : "bg-primary"
              )}
              style={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
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
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="flex items-center gap-3 text-sm text-text-secondary">
        <Icon className="h-4 w-4 shrink-0 stroke-[1.6] text-text-muted" aria-hidden="true" />
        {label}
      </span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}
