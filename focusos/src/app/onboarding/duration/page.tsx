"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";

const durations = [
  {
    id: "25",
    label: "25 min",
    description: "A short reset for starting, reviewing, or warming up.",
  },
  {
    id: "50",
    label: "50 min",
    description: "A steady default for reading, coding, or deep study.",
  },
  {
    id: "90",
    label: "90 min",
    description: "A longer block for work that needs full immersion.",
  },
];

export default function OnboardingDurationPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = React.useState<string>("50");

  const handleContinue = () => {
    router.push("/onboarding/extension");
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
          <span>Step 2 of 3</span>
          <span>Session rhythm</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-focus-green transition-all duration-300" />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="font-display text-3xl font-light leading-tight text-text-primary sm:text-4xl">
          How long should your default focus room stay open?
        </h1>
        <p className="max-w-[54ch] text-sm leading-6 text-text-secondary sm:text-base">
          This becomes the first timer suggestion. You can still adjust every session later.
        </p>
      </div>

      <div className="space-y-3">
        {durations.map((duration) => {
          const isSelected = selected === duration.id;
          return (
            <button
              key={duration.id}
              type="button"
              onClick={() => setSelected(duration.id)}
              aria-pressed={isSelected}
              className={`flex min-h-24 w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all duration-150 focus-ring-soft ${
                isSelected
                  ? "border-focus-green bg-focus-green/[0.12] shadow-glow"
                  : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <span>
                <span className="block font-display text-2xl font-light text-text-primary">
                  {duration.label}
                </span>
                <span className="mt-1 block max-w-[38ch] text-sm leading-6 text-text-secondary">
                  {duration.description}
                </span>
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  isSelected ? "border-focus-green bg-focus-green" : "border-white/20"
                }`}
                aria-hidden="true"
              >
                {isSelected && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="h-12 rounded-2xl"
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Button onClick={handleContinue} className="h-12 rounded-2xl">
          Next
        </Button>
      </div>
    </motion.div>
  );
}
