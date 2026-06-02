import type { Metadata } from "next";
import { AmbientScene, GlassPanel } from "@/components/ambient";

export const metadata: Metadata = {
  title: "Set up your focus workspace | FocusOS",
  description: "Personalize your FocusOS workspace in less than a minute.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AmbientScene variant="forest" intensity="medium" className="min-h-[100dvh]">
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6">
        <GlassPanel variant="strong" className="w-full max-w-[640px] overflow-hidden p-5 sm:p-7 md:p-8">
          {children}
        </GlassPanel>
      </div>
    </AmbientScene>
  );
}
