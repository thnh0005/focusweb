"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Spinner } from "@/components/ui/Spinner";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  const { isAuthenticated, isLoading, refreshUser } = useAuthStore();
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = React.useState(false);

  // Client-side authentication protected route check
  React.useEffect(() => {
    async function verifyAuth() {
      if (!isAuthenticated) {
        try {
          await refreshUser();
        } catch {
          // Redirect to login if user cookie session is missing or invalid
          router.push("/login");
        }
      }
      setHasAttemptedRefresh(true);
    }

    verifyAuth();
  }, [isAuthenticated, refreshUser, router]);

  // If loading user info or checking cookie validity, show high-end Sanctuary Loader
  if (isLoading || (!isAuthenticated && !hasAttemptedRefresh)) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="min-h-[100dvh] flex flex-col items-center justify-center relative bg-background text-text-primary overflow-hidden"
      >
        {/* Sanctuary loader glow background orbs */}
        <div className="ambient-orbs" aria-hidden="true">
          <div className="ambient-orb ambient-orb-1 opacity-40 animate-pulse-glow" style={{ animationDuration: "4s" }} />
          <div className="ambient-orb ambient-orb-2 opacity-30 animate-pulse-glow" style={{ animationDuration: "7s" }} />
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-6 text-center animate-fade-in px-4">
          <div className="flex items-center justify-center p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06] shadow-[0_0_50px_rgba(124,58,237,0.15)] backdrop-blur-md">
            <Spinner className="h-8 w-8 text-focus-purple" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-light tracking-wide text-text-primary">
              Entering Sanctuary
            </h2>
            <p className="text-xs text-text-muted font-light max-w-[240px] mx-auto leading-relaxed">
              Aligning focus tools and preparing your customized dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If check completed and still not authenticated, double check block render during route redirects
  if (!isAuthenticated) {
    return null;
  }

  // Session, dashboard, settings, and AI documents are immersive routes that own their full viewport.
  const isSessionRoute = pathname.startsWith("/session");
  const isDashboardRoute = pathname === "/dashboard";
  const isSettingsRoute = pathname.startsWith("/settings");
  const isStudyToolsRoute = pathname.startsWith("/study-tools");

  if (isSessionRoute || isDashboardRoute || isSettingsRoute || isStudyToolsRoute) {
    return <>{children}</>;
  }

  return (
    <AppLayout>
      <DashboardLayout>{children}</DashboardLayout>
    </AppLayout>
  );
}
