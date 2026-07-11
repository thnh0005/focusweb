"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Briefcase, Code2, GraduationCap, Palette, Search, Sparkles } from "lucide-react";
import {
  clearOnboardingDraft,
  readOnboardingDraft,
  saveOnboardingDraft,
} from "@/lib/onboarding/storage";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";
import type { UserProfession } from "@/types/user.types";

const fields: Array<{
  id: UserProfession;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  { id: "student", label: "Student", description: "Study blocks, review, exams", icon: GraduationCap },
  { id: "developer", label: "Developer", description: "Code, debug, ship", icon: Code2 },
  { id: "designer", label: "Designer", description: "Explore, refine, present", icon: Palette },
  { id: "freelancer", label: "Freelancer", description: "Client work and admin", icon: Briefcase },
  { id: "researcher", label: "Researcher", description: "Read, collect, write", icon: Search },
  { id: "other", label: "Other", description: "Shape your own rhythm", icon: Sparkles },
];

export default function OnboardingDomainPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);
  const [selected, setSelected] = React.useState<UserProfession | "">(
    () => readOnboardingDraft().profession ?? ""
  );
  const [isSkipping, setIsSkipping] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleContinue = () => {
    if (selected) {
      saveOnboardingDraft({
        profession: selected,
        learningDomain: [selected],
      });
      router.push("/onboarding/duration");
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    setError("");
    try {
      await completeOnboarding({ skipped: true });
      clearOnboardingDraft();
      router.replace("/dashboard");
    } catch (skipError) {
      setError(getErrorMessage(skipError, "Failed to skip onboarding"));
    } finally {
      setIsSkipping(false);
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
          <span>Step 1 of 3</span>
          <span>Workspace context</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 rounded-full bg-focus-green transition-all duration-300" />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="font-display text-3xl font-light leading-tight text-text-primary sm:text-4xl">
          What kind of work should this space support?
        </h1>
        <p className="max-w-[54ch] text-sm leading-6 text-text-secondary sm:text-base">
          FocusOS uses this to tune session suggestions around the work you actually do.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const Icon = field.icon;
          const isSelected = selected === field.id;
          return (
            <button
              key={field.id}
              type="button"
              onClick={() => setSelected(field.id)}
              aria-pressed={isSelected}
              className={`min-h-24 rounded-2xl border p-4 text-left transition-all duration-150 focus-ring-soft ${
                isSelected
                  ? "border-focus-green bg-focus-green/[0.12] shadow-glow"
                  : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-bg-void/40 text-focus-green">
                  <Icon className="h-5 w-5" aria-hidden={true} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-text-primary">{field.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-text-muted">
                    {field.description}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="h-12 rounded-2xl"
          onClick={handleSkip}
          disabled={isSkipping}
        >
          {isSkipping ? "Saving..." : "Skip setup"}
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selected || isSkipping}
          className="h-12 rounded-2xl"
        >
          Continue
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
