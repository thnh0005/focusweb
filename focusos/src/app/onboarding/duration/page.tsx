"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function OnboardingDurationPage() {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string>("50");

  const durations = [
    { id: "25", label: "25 min", description: "Pomodoro" },
    { id: "50", label: "50 min", description: "Standard" },
    { id: "90", label: "90 min", description: "Deep Dive" },
  ];

  const handleContinue = () => {
    router.push("/onboarding/extension");
  };

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="space-y-2">
        <p className="text-xs text-text-muted font-light">Step 2 of 3</p>
        <div className="h-1 bg-surface-deep rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-focus-purple transition-all duration-300" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extralight text-text-primary mb-2">
            What&apos;s your ideal session length?
          </h1>
          <p className="text-sm text-text-secondary font-light">
            We&apos;ll use this as your default, but you can customize it later.
          </p>
        </div>

        {/* Duration Selection */}
        <div className="space-y-3">
          {durations.map((duration) => (
            <button
              key={duration.id}
              onClick={() => setSelected(duration.id)}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left flex justify-between items-center ${
                selected === duration.id
                  ? "border-focus-purple bg-focus-purple/10"
                  : "border-subtle-border hover:border-text-muted/50"
              }`}
            >
              <div>
                <p className="font-medium text-text-primary">
                  {duration.label}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {duration.description}
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selected === duration.id
                    ? "border-focus-purple bg-focus-purple"
                    : "border-text-muted"
                }`}
              >
                {selected === duration.id && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          className="flex-1 border-subtle-border"
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Button
          onClick={handleContinue}
          className="flex-1 bg-focus-purple hover:bg-focus-purple/90 text-white"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
