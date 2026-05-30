"use client";

import * as React from "react";
import { PublicNav } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col relative bg-background overflow-x-hidden">
      {/* Glow background orbs for Public/Auth pages */}
      <div className="ambient-orbs" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2 animate-pulse-glow" style={{ animationDuration: "6s" }} />
      </div>

      <PublicNav />
      <main className="flex-1 flex items-center justify-center px-4 py-24 md:py-32 relative z-10">
        <div className="w-full max-w-md animate-fade-up">
          {children}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
