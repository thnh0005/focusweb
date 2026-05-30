"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "@/services/sessions.api";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";

export default function SessionSummaryPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const { data: session, isLoading } = useQuery({
    queryKey: ["session-summary", sessionId],
    queryFn: () => sessionsApi.getSessionSummary(sessionId),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner className="h-7 w-7 text-focus-purple" />
        <span className="text-xs text-text-muted font-light">
          Loading session summary...
        </span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-text-secondary">Session not found</p>
        <Button
          onClick={() => router.push("/dashboard")}
          className="bg-focus-purple text-white"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const sess = session.session;
  const targetDurationMinutes = Math.floor(sess.targetDurationSeconds / 60);
  const actualDurationMinutes = Math.floor(sess.actualDurationSeconds / 60);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extralight text-text-primary">
          Session Complete
        </h1>
        <p className="text-text-secondary font-light">
          Great work! Here&apos;s how your session went.
        </p>
      </div>

      {/* Focus Score Card */}
      <Card className="p-8 space-y-4">
        <p className="text-sm text-text-muted">Final Focus Score</p>
        <p className="text-6xl font-extralight text-focus-purple">
          {sess.focusScore ?? "—"}
        </p>
        <p className="text-sm text-text-secondary">
          {actualDurationMinutes} minutes of focused deep work
        </p>
      </Card>

      {/* Session Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Session Mode",
            value: sess.mode === "deep-work" ? "Deep Work" : "Normal",
          },
          {
            label: "Target Duration",
            value: `${targetDurationMinutes}m`,
          },
          {
            label: "Actual Duration",
            value: `${actualDurationMinutes}m`,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs text-text-muted mb-1">{stat.label}</p>
            <p className="text-lg font-medium text-text-primary">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      {/* AI Insights */}
      {session.aiInsights && session.aiInsights.length > 0 && (
        <Card className="p-6 bg-focus-purple/10 border-focus-purple/30 space-y-3">
          <p className="text-sm font-medium text-text-primary">
            AI Insights
          </p>
          <ul className="space-y-2">
            {session.aiInsights.map((insight, idx) => (
              <li key={idx} className="text-sm text-text-secondary font-light flex gap-2">
                <span className="text-focus-purple">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Session Goal */}
      {sess.goal && (
        <Card className="p-6">
          <p className="text-sm font-medium text-text-primary mb-2">
            Session Goal
          </p>
          <p className="text-sm text-text-secondary font-light">
            {sess.goal}
          </p>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={() => router.push("/dashboard")}
          className="flex-1 bg-focus-purple hover:bg-focus-purple/90 text-white"
        >
          Return to Dashboard
        </Button>
        <Button
          onClick={() => router.push("/session")}
          variant="outline"
          className="flex-1 border-subtle-border"
        >
          Start Another Session
        </Button>
      </div>
    </div>
  );
}
