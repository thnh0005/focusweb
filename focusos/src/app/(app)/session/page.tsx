"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session.store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

export default function SessionConfigPage() {
  const router = useRouter();
  const { startSession } = useSessionStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [mode, setMode] = React.useState<"normal" | "deep-work">("normal");
  const [duration, setDuration] = React.useState<string>("50");
  const [goal, setGoal] = React.useState<string>("");
  const [customDuration, setCustomDuration] = React.useState<string>("");

  const presetDurations = [25, 50, 90];

  const handleStartSession = async () => {
    const finalDuration = customDuration
      ? parseInt(customDuration)
      : parseInt(duration);

    setIsLoading(true);
    try {
      await startSession({
        mode,
        durationMinutes: finalDuration,
        goal: mode === "deep-work" ? goal : undefined,
        tags: [],
      });
      router.push("/session/active");
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsLoading(false);
    }
  };

  const isValid =
    duration || (customDuration && parseInt(customDuration) > 0);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-10">
        {/* Header */}
        <div className="space-y-3 text-center">
          <h1 className="text-4xl font-extralight text-text-primary leading-tight">
            Ready to Focus?
          </h1>
          <p className="text-base text-text-secondary font-light">
            Configure your session and dive into deep work
          </p>
        </div>

        {/* Mode Selection */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-text-primary">
            Session Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "normal",
                label: "Normal Mode",
                description: "Basic tracking",
              },
              {
                id: "deep-work",
                label: "Deep Work Mode",
                description: "AI-powered analysis",
              },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`p-4 rounded-lg border-2 transition-all text-center space-y-1 ${
                  mode === m.id
                    ? "border-focus-purple bg-focus-purple/10"
                    : "border-subtle-border hover:border-text-muted/50"
                }`}
              >
                <p className="font-medium text-text-primary text-sm">
                  {m.label}
                </p>
                <p className="text-xs text-text-muted">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Goal Input (Deep Work Only) */}
        {mode === "deep-work" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              What&apos;s your session goal?
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Complete Django authentication tutorial"
              className="w-full p-3 rounded-lg bg-surface-deep border border-subtle-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-focus-purple text-sm resize-none"
              rows={3}
            />
          </div>
        )}

        {/* Duration Selection */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-text-primary">
            Session Duration
          </label>
          <div className="grid grid-cols-3 gap-2">
            {presetDurations.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDuration(String(d));
                  setCustomDuration("");
                }}
                className={`py-3 rounded-lg border-2 transition-all font-medium text-sm ${
                  duration === String(d) && !customDuration
                    ? "border-focus-purple bg-focus-purple text-white"
                    : "border-subtle-border text-text-primary hover:border-text-muted/50"
                }`}
              >
                {d}m
              </button>
            ))}
          </div>

          {/* Custom Duration */}
          <div className="relative">
            <Input
              type="number"
              min="1"
              max="480"
              value={customDuration}
              onChange={(e) => {
                setCustomDuration(e.target.value);
                if (e.target.value) setDuration("");
              }}
              placeholder="Or enter custom duration (min)"
              className="bg-surface-deep border-subtle-border text-text-primary"
            />
          </div>
        </div>

        {/* Start Button */}
        <Button
          onClick={handleStartSession}
          disabled={!isValid || isLoading}
          className="w-full bg-focus-purple hover:bg-focus-purple/90 text-white font-medium h-12 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Starting..." : "Start Session"}
        </Button>

        {/* Cancel Button */}
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="w-full border-subtle-border text-text-primary"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
