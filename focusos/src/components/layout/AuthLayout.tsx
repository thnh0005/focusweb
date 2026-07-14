"use client";

import * as React from "react";
import { Headphones, Leaf, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AmbientScene, GlassPanel } from "@/components/ambient";
import { PublicFooter } from "./PublicFooter";
import { PublicNav } from "./PublicNav";

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation("auth");

  return (
    <AmbientScene variant="rain" intensity="medium" className="min-h-[100dvh]">
      <div className="flex min-h-[100dvh] flex-col">
        <PublicNav />
        <main className="flex flex-1 items-center px-4 pb-12 pt-24 sm:px-6 md:pt-28">
          <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
            <aside className="hidden lg:block">
              <div className="max-w-xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs text-text-secondary">
                  <Leaf className="h-3.5 w-3.5 text-focus-green" aria-hidden="true" />
                  {t("public.badge")}
                </div>
                <div className="space-y-4">
                  <h1 className="font-display text-5xl font-light leading-tight text-text-primary">
                    {t("public.headline")}
                  </h1>
                  <p className="max-w-[52ch] text-base leading-7 text-text-secondary">
                    {t("public.description")}
                  </p>
                </div>

                <GlassPanel variant="subtle" className="max-w-md p-5">
                  <div className="rounded-[1.75rem] border border-white/10 bg-bg-void/55 p-5">
                    <div className="flex items-center justify-between text-sm text-text-secondary">
                      <span>{t("public.nextSession")}</span>
                      <span>50 min</span>
                    </div>
                    <p className="mt-8 font-display text-6xl font-light leading-none text-text-primary">
                      08:00
                    </p>
                    <p className="mt-3 text-sm text-text-secondary">
                      {t("public.morningBlock")}
                    </p>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                        <Timer className="h-4 w-4 text-focus-green" aria-hidden="true" />
                        <p className="mt-2 text-xs text-text-muted">{t("public.timerReady")}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                        <Headphones className="h-4 w-4 text-focus-green" aria-hidden="true" />
                        <p className="mt-2 text-xs text-text-muted">{t("public.rainRoom")}</p>
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              </div>
            </aside>

            <div className="mx-auto w-full max-w-md">{children}</div>
          </div>
        </main>
        <PublicFooter />
      </div>
    </AmbientScene>
  );
}
