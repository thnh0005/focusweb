"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function OnboardingDomainPage() {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string>("");

  const fields = [
    { id: "student", label: "Student", icon: "🎓" },
    { id: "developer", label: "Developer", icon: "👨‍💻" },
    { id: "designer", label: "Designer", icon: "🎨" },
    { id: "freelancer", label: "Freelancer", icon: "💼" },
    { id: "researcher", label: "Researcher", icon: "🔬" },
    { id: "other", label: "Other", icon: "✨" },
  ];

  const handleContinue = () => {
    if (selected) {
      router.push("/onboarding/duration");
    }
  };

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="space-y-2">
        <p className="text-xs text-text-muted font-light">Step 1 of 3</p>
        <div className="h-1 bg-surface-deep rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-focus-purple transition-all duration-300" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extralight text-text-primary mb-2">
            What&apos;s your field?
          </h1>
          <p className="text-sm text-text-secondary font-light">
            This helps us personalize recommendations for your work style.
          </p>
        </div>

        {/* Field Selection Grid */}
        <div className="grid grid-cols-2 gap-3">
          {fields.map((field) => (
            <button
              key={field.id}
              onClick={() => setSelected(field.id)}
              className={`p-4 rounded-lg border-2 transition-all text-center space-y-2 ${
                selected === field.id
                  ? "border-focus-purple bg-focus-purple/10"
                  : "border-subtle-border hover:border-text-muted/50"
              }`}
            >
              <p className="text-3xl">{field.icon}</p>
              <p className="text-sm font-medium text-text-primary">
                {field.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          className="flex-1 border-subtle-border"
          onClick={() => router.push("/dashboard")}
        >
          Skip
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selected}
          className="flex-1 bg-focus-purple hover:bg-focus-purple/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
