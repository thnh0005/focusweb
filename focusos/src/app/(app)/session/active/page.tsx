"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session.store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function ActiveSessionPage() {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = React.useState<number>(0);
  const [totalDuration, setTotalDuration] = React.useState<number>(0);
  const {
    sessionConfig,
    sessionStatus,
    realtimeFocusScore,
    warningLevel,
    isAutoPaused,
  } = useSessionStore();

  // Initialize timer and redirect if no session config
  React.useEffect(() => {
    if (!sessionConfig) {
      router.push("/session");
      return;
    }

    const durationSeconds = sessionConfig.durationMinutes * 60;
    setTotalDuration(durationSeconds);
    setTimeLeft(durationSeconds);

    // Timer countdown
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionConfig, router]);

  if (!sessionConfig) {
    return null;
  }

  const progress = ((totalDuration - timeLeft) / totalDuration) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleEndSession = () => {
    router.push("/dashboard");
  };

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-ambient-dark via-surface-deep to-ambient-dark">
      {/* Ambient Background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0 transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(168, 85, 247, ${0.05 + (realtimeFocusScore ?? 50) / 500}), transparent 70%)`,
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-12">
        {/* Timer Display */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* SVG Circle */}
          <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 280 280">
            <circle
              cx="140"
              cy="140"
              r="130"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="6"
            />
            <circle
              cx="140"
              cy="140"
              r="130"
              fill="none"
              stroke="rgba(168, 85, 247, 1)"
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 130}`}
              strokeDashoffset={`${2 * Math.PI * 130 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>

          {/* Time Display */}
          <div className="text-center z-10">
            <p className="text-6xl font-extralight text-text-primary">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </p>
            <p className="text-sm text-text-muted mt-2 font-light">
              {sessionConfig.mode === "deep-work" ? "Deep Work" : "Focus"} Session
            </p>
          </div>
        </div>

        {/* Focus Score */}
        <div className="absolute top-8 right-8 text-right">
          <p className="text-xs text-text-muted font-light">Focus Score</p>
          <p className="text-4xl font-light text-focus-purple">
            {realtimeFocusScore ?? 100}%
          </p>
        </div>

        {/* Session Goal */}
        {sessionConfig.goal && (
          <Card className="mt-8 p-6 max-w-md bg-focus-purple/10 border-focus-purple/30">
            <p className="text-xs text-text-muted font-medium mb-2">GOAL</p>
            <p className="text-sm text-text-secondary font-light">
              {sessionConfig.goal}
            </p>
          </Card>
        )}
      </div>

      {/* Session Controls */}
      <div className="absolute bottom-8 right-8">
        <Button
          onClick={handleEndSession}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          End Session
        </Button>
      </div>

      {/* Warning Badge */}
      {warningLevel && (
        <div className="absolute top-8 left-8 p-3 rounded-lg bg-amber-500/20 border border-amber-500/50">
          <p className="text-sm font-medium text-amber-300">
            ⚠ Distraction Warning {warningLevel}/3
          </p>
        </div>
      )}

      {/* Auto-Pause Indicator */}
      {isAutoPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
          <Card className="p-6 text-center">
            <p className="text-lg font-medium text-text-primary">Session Paused</p>
            <p className="text-sm text-text-secondary mt-2 font-light">
              Distraction detected. Click below to resume.
            </p>
            <Button className="mt-4 bg-focus-purple hover:bg-focus-purple/90 text-white">
              Resume
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
