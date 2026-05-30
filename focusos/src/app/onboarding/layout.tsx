import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding · FocusOS",
  description: "Personalize your FocusOS experience in less than a minute.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-ambient-dark via-surface-deep to-ambient-dark">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
