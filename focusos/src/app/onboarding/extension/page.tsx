"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, EyeOff, ShieldCheck, Waves } from "lucide-react";
import { useTranslation } from "react-i18next";
import { clearOnboardingDraft, readOnboardingDraft } from "@/lib/onboarding/storage";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";

const extensionNotes = [
  {
    id: "drift",
    icon: Bell,
  },
  {
    id: "privacy",
    icon: EyeOff,
  },
  {
    id: "recovery",
    icon: Waves,
  },
];

export default function OnboardingExtensionPage() {
  const { t } = useTranslation("onboarding");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleComplete = async (extensionInstalled: boolean) => {
    setIsSaving(true);
    setError("");
    try {
      await completeOnboarding({
        ...readOnboardingDraft(),
        extensionInstalled,
      });
      clearOnboardingDraft();
      router.replace("/dashboard");
    } catch (completeError) {
      setError(getErrorMessage(completeError, t("extension.errors.save")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-xs text-text-muted">
          <span>{t("progress", { current: 3, total: 3 })}</span>
          <span>{t("extension.context")}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full rounded-full bg-focus-green transition-all duration-300" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-focus-green">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="font-display text-3xl font-light leading-tight text-text-primary sm:text-4xl">
          {t("extension.title")}
        </h1>
        <p className="max-w-[56ch] text-sm leading-6 text-text-secondary sm:text-base">
          {t("extension.description")}
        </p>
      </div>

      <div className="grid gap-3">
        {extensionNotes.map((note) => {
          const Icon = note.icon;
          return (
            <div
              key={note.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-bg-void/40 text-focus-green">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-text-primary">
                    {t(`extension.notes.${note.id}.title`)}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-text-secondary">
                    {t(`extension.notes.${note.id}.description`)}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <a
        href="https://chromewebstore.google.com/detail/focusos-browser-extension"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Button className="h-12 w-full rounded-2xl">
          {t("actions.installExtension")}
        </Button>
      </a>

      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="h-12 rounded-2xl"
          onClick={() => handleComplete(false)}
          disabled={isSaving}
        >
          {isSaving ? t("actions.saving") : t("actions.setUpLater")}
        </Button>
        <Button onClick={() => handleComplete(true)} disabled={isSaving} className="h-12 rounded-2xl">
          {isSaving ? t("actions.saving") : t("actions.enterDashboard")}
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3 text-sm text-urgency-coral">
          {error}
        </div>
      )}
    </motion.div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
