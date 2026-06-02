"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, EyeOff, ShieldCheck, Waves } from "lucide-react";
import { Button } from "@/components/ui/Button";

const extensionNotes = [
  {
    title: "Notices drift early",
    description: "Detects when browsing moves away from your session goal.",
    icon: Bell,
  },
  {
    title: "Protects sensitive fields",
    description: "Focus tracking is designed around attention signals, not private text.",
    icon: EyeOff,
  },
  {
    title: "Keeps recovery gentle",
    description: "Warnings are calm and timed to help you return without stress.",
    icon: Waves,
  },
];

export default function OnboardingExtensionPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const handleContinue = () => {
    router.push("/dashboard");
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
          <span>Step 3 of 3</span>
          <span>Focus tracking</span>
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
          Enable the browser layer for calmer sessions.
        </h1>
        <p className="max-w-[56ch] text-sm leading-6 text-text-secondary sm:text-base">
          The extension helps FocusOS understand when attention drifts so it can support recovery during a session.
        </p>
      </div>

      <div className="grid gap-3">
        {extensionNotes.map((note) => {
          const Icon = note.icon;
          return (
            <div
              key={note.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-bg-void/40 text-focus-green">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-text-primary">{note.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-text-secondary">
                    {note.description}
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
          Install from Chrome Web Store
        </Button>
      </a>

      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="h-12 rounded-2xl"
          onClick={handleContinue}
        >
          Set up later
        </Button>
        <Button onClick={handleContinue} className="h-12 rounded-2xl">
          Enter dashboard
        </Button>
      </div>
    </motion.div>
  );
}
