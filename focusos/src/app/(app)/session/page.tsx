"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Brain, Clock, Sparkles, Zap } from "lucide-react";
import { AmbientWorkspaceBackground } from "@/components/focus-home/AmbientWorkspaceBackground";
import { SceneSwitcher } from "@/components/features/focus/SceneSwitcher";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { sessionsApi } from "@/services/sessions.api";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { useExtensionStore } from "@/stores/extension.store";
import { useSessionStore } from "@/stores/session.store";
import { cn } from "@/lib/utils/cn";
import { requestFocusFullscreen } from "@/lib/utils/fullscreen";
import type { SessionMode } from "@/types/session.types";

const presetDurations = [
  { minutes: 25, label: "25 min", note: "Quick reset" },
  { minutes: 50, label: "50 min", note: "Focused block" },
  { minutes: 90, label: "90 min", note: "Long room" },
];

const fallbackTemplates = [
  "Finish the next concrete task",
  "Study one concept without switching tabs",
  "Draft the first complete version",
];

export default function SessionConfigPage() {
  const router = useRouter();
  const { startSession } = useSessionStore();
  const { connected } = useExtensionStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [mode, setMode] = React.useState<SessionMode>("normal");
  const [duration, setDuration] = React.useState<string>("50");
  const [goal, setGoal] = React.useState<string>("");
  const [customDuration, setCustomDuration] = React.useState<string>("");

  useHeartbeat();

  const { data: templates } = useQuery({
    queryKey: ["goal-templates"],
    queryFn: sessionsApi.getGoalTemplates,
    retry: false,
  });

  const { data: smartPreset } = useQuery({
    queryKey: ["smart-preset"],
    queryFn: sessionsApi.getSmartPreset,
    retry: false,
  });

  const finalDuration = customDuration ? parseInt(customDuration, 10) : parseInt(duration, 10);
  const hasValidDuration = Number.isFinite(finalDuration) && finalDuration > 0;
  const requiresGoal = mode === "deep-work";
  const isValid = hasValidDuration && (!requiresGoal || goal.trim().length > 0);
  const templateLabels = templates?.length
    ? templates.map((template) => template.text)
    : fallbackTemplates;

  const handleStartSession = async () => {
    if (!isValid) return;

    void requestFocusFullscreen();
    setIsLoading(true);
    try {
      await startSession({
        mode,
        durationMinutes: finalDuration,
        goal: mode === "deep-work" ? goal.trim() : undefined,
        tags: [],
      });
      router.push("/session/active");
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsLoading(false);
    }
  };

  const applySmartPreset = () => {
    if (!smartPreset) return;
    setMode(smartPreset.mode);
    setDuration(String(smartPreset.durationMinutes));
    setCustomDuration("");
  };

  return (
    <AmbientWorkspaceBackground className="min-h-[100dvh]">
      <main className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6">
        <div className="grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,42rem)_20rem] lg:items-start">
          <section className="glass-card ambient-glow w-full rounded-[2rem] p-5 shadow-ambient sm:p-7 md:p-9">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-text-muted">Focus room</p>
                <h1 className="mt-2 text-4xl font-light leading-tight text-text-primary md:text-5xl">
                  Set your focus
                </h1>
                <p className="mt-3 max-w-[32rem] text-sm font-light leading-relaxed text-text-secondary">
                  Choose a mode, pick a duration, and enter the room.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Go back"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              </button>
            </div>

          {smartPreset && (
            <button
              type="button"
              onClick={applySmartPreset}
              className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left transition-all duration-fast hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-primary">
                  Suggested {smartPreset.durationMinutes} minute {smartPreset.mode === "deep-work" ? "Deep Work" : "Normal"} session
                </span>
                <span className="mt-1 line-clamp-2 block text-xs text-text-muted">
                  {smartPreset.rationale}
                </span>
              </span>
            </button>
          )}

          {!connected && (
            <div className="mb-5 rounded-2xl border border-urgency-amber/25 bg-urgency-amber/10 p-4 text-sm text-urgency-amber">
              Extension tracking is not connected. You can still start, but live distraction detection may be limited.
            </div>
          )}

          <div className="space-y-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard
                active={mode === "normal"}
                icon={<Zap className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />}
                title="Normal"
                body="Lightweight timer and blacklist-aware focus support."
                onClick={() => setMode("normal")}
              />
              <ModeCard
                active={mode === "deep-work"}
                icon={<Brain className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />}
                title="Deep Work"
                body="Goal-led session with semantic focus scoring."
                onClick={() => setMode("deep-work")}
              />
            </div>

            {mode === "deep-work" && (
              <div className="space-y-3">
                <label htmlFor="session-goal" className="text-sm font-medium text-text-primary">
                  What are you here to finish?
                </label>
                <textarea
                  id="session-goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="Complete the auth flow and write the edge-case tests"
                  className="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-base font-light leading-relaxed text-text-primary placeholder:text-text-muted transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={4}
                />
                <div className="flex flex-wrap gap-2">
                  {templateLabels.slice(0, 5).map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setGoal(template)}
                      className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-text-primary">
                  Duration
                </label>
                <span className="text-xs font-mono text-text-muted">
                  {hasValidDuration ? `${finalDuration} min` : "Choose time"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {presetDurations.map((preset) => (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => {
                      setDuration(String(preset.minutes));
                      setCustomDuration("");
                    }}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all duration-fast active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      duration === String(preset.minutes) && !customDuration
                        ? "border-primary/50 bg-primary/[0.14] text-text-primary shadow-focus-purple"
                        : "border-white/10 bg-white/[0.04] text-text-secondary hover:bg-white/[0.07] hover:text-text-primary"
                    )}
                  >
                    <Clock className="mb-5 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                    <span className="block text-2xl font-light text-text-primary">
                      {preset.label}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      {preset.note}
                    </span>
                  </button>
                ))}
              </div>

              <Input
                type="number"
                min="1"
                max="480"
                value={customDuration}
                onChange={(event) => {
                  setCustomDuration(event.target.value);
                  if (event.target.value) setDuration("");
                }}
                placeholder="Custom duration in minutes"
                className="h-12 rounded-2xl bg-white/[0.04]"
                isMonospace
              />
            </div>

            {requiresGoal && goal.trim().length === 0 && (
              <p className="text-sm text-urgency-amber">
                Deep Work needs a clear goal before the session can begin.
              </p>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                type="button"
                onClick={handleStartSession}
                disabled={!isValid || isLoading}
                variant="session"
                className="h-[52px] flex-1 rounded-full px-7 text-base"
              >
                {isLoading ? "Starting focus" : "Start Focus"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="h-[52px] rounded-full px-7"
              >
                Cancel
              </Button>
            </div>
          </div>
          </section>

          <SceneSwitcher mode="inline" className="hidden lg:block" />
        </div>
      </main>
    </AmbientWorkspaceBackground>
  );
}

interface ModeCardProps {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}

function ModeCard({ active, icon, title, body, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all duration-fast active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/50 bg-primary/[0.14] shadow-focus-purple"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
      )}
      aria-pressed={active}
    >
      <span
        className={cn(
          "mb-4 flex h-10 w-10 items-center justify-center rounded-full border",
          active
            ? "border-primary/40 bg-primary/[0.18] text-primary"
            : "border-white/10 bg-white/[0.04] text-text-secondary"
        )}
      >
        {icon}
      </span>
      <span className="block text-lg font-light text-text-primary">{title}</span>
      <span className="mt-2 block text-sm font-light leading-relaxed text-text-secondary">
        {body}
      </span>
    </button>
  );
}
