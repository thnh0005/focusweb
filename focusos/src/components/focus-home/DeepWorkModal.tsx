"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { sessionsApi } from "@/services/sessions.api";

export interface DeepWorkModalProps {
  open: boolean;
  durationMinutes: number;
  lastGoal?: string | null;
  isSubmitting: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (goal: string) => Promise<void>;
}

export function DeepWorkModal({
  open,
  durationMinutes,
  lastGoal,
  isSubmitting,
  error,
  onOpenChange,
  onConfirm,
}: DeepWorkModalProps) {
  const { t } = useTranslation("dashboard");
  const [goal, setGoal] = React.useState("");
  const trimmedGoal = goal.trim();
  const isValid = trimmedGoal.length > 0;

  const {
    data: templates,
    isError: templatesFailed,
    isFetched: templatesFetched,
  } = useQuery({
    queryKey: ["goal-templates"],
    queryFn: sessionsApi.getGoalTemplates,
    retry: false,
    enabled: open,
  });

  const fallbackTemplates = t("focusHome.deepWork.fallbackTemplates", {
    returnObjects: true,
  }) as string[];
  const templateLabels = templates?.length
    ? templates.map((template) => template.text)
    : fallbackTemplates;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (isSubmitting) return;
      onOpenChange(nextOpen);
    },
    [isSubmitting, onOpenChange]
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isValid || isSubmitting) return;
      await onConfirm(trimmedGoal);
    },
    [isSubmitting, isValid, onConfirm, trimmedGoal]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-primary/15 text-primary sm:mx-0">
            <Brain className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
          </div>
          <DialogTitle>{t("focusHome.deepWork.title")}</DialogTitle>
          <DialogDescription>
            {t("focusHome.deepWork.description", { count: durationMinutes })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            label={t("focusHome.deepWork.goalLabel")}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder={t("focusHome.deepWork.goalPlaceholder")}
            disabled={isSubmitting}
            error={!isValid && goal.length > 0 ? t("focusHome.deepWork.goalRequired") : undefined}
            className="min-h-28 rounded-2xl bg-white/[0.04] text-base font-light leading-relaxed"
            rows={4}
            autoFocus
          />

          <div className="flex flex-wrap gap-2">
            {lastGoal && !trimmedGoal && (
              <button
                type="button"
                onClick={() => setGoal(lastGoal)}
                disabled={isSubmitting}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-text-secondary transition-all duration-fast hover:bg-white/[0.1] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("focusHome.deepWork.continue", { goal: lastGoal })}
              </button>
            )}
            {templateLabels.slice(0, 5).map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setGoal(template)}
                disabled={isSubmitting}
                className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {template}
              </button>
            ))}
          </div>

          {!templates?.length && (
            <p className="text-xs font-light text-text-muted">
              {templatesFailed
                ? t("focusHome.deepWork.templatesLoadFailed")
                : templatesFetched
                  ? t("focusHome.deepWork.templatesEmpty")
                  : t("focusHome.deepWork.templatesLoading")}
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-2xl border border-urgency-coral/20 bg-urgency-coral/10 p-3 text-sm text-urgency-coral">
              {error}
            </p>
          )}

          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="h-11 rounded-full px-5"
            >
              {t("focusHome.deepWork.cancel")}
            </Button>
            <Button
              type="submit"
              variant="session"
              disabled={!isValid || isSubmitting}
              aria-busy={isSubmitting}
              className="h-11 rounded-full px-6"
            >
              {isSubmitting ? t("focusHome.deepWork.starting") : t("focusHome.deepWork.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
