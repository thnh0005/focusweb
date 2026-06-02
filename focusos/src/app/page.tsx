import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Gauge,
  Headphones,
  Leaf,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { AmbientScene, GlassPanel } from "@/components/ambient";
import { Button } from "@/components/ui/Button";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicNav } from "@/components/layout/PublicNav";

export const metadata: Metadata = {
  title: "FocusOS | Your calm space for deep work",
  description:
    "Start focused sessions, stay in flow, and understand what breaks your attention with a calm ambient focus workspace.",
};

const features = [
  {
    title: "Focus sessions",
    description:
      "Begin with a clear goal, a steady timer, and the smallest set of controls needed to stay with the work.",
    icon: Timer,
  },
  {
    title: "Deep Work mode",
    description:
      "Let FocusOS quiet the browser, watch your attention signals, and keep the session centered on the task.",
    icon: Leaf,
  },
  {
    title: "Gentle recovery",
    description:
      "When attention slips, the app gives a calm nudge instead of turning the moment into an alarm.",
    icon: ShieldCheck,
  },
  {
    title: "Session reflection",
    description:
      "End with a simple read on what helped, what broke focus, and what to adjust next time.",
    icon: Brain,
  },
];

const roomSignals = [
  { label: "Goal", value: "Read chapter 4 notes" },
  { label: "Sound", value: "Rain room, low volume" },
  { label: "Shield", value: "6 sites quieted" },
];

function FocusRoomPreview() {
  return (
    <GlassPanel
      variant="strong"
      className="relative overflow-hidden p-4 sm:p-5 md:p-6 shadow-ambient"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_24%_10%,rgb(124_171_145_/_0.22),transparent_34%),radial-gradient(circle_at_80%_72%,rgb(200_138_101_/_0.14),transparent_30%)]"
      />
      <div className="relative space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-text-muted">current room</p>
            <p className="text-sm font-medium text-text-primary">Deep reading</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-secondary">
            live
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-bg-void/55 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4 text-xs text-text-muted">
            <span>focus timer</span>
            <span>session 02</span>
          </div>
          <div className="mt-8 text-center">
            <p className="font-display text-[4.5rem] font-light leading-none text-text-primary sm:text-[5.5rem]">
              42:18
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              Stay with one page, one thought, one task.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {roomSignals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"
              >
                <p className="text-[11px] text-text-muted">{signal.label}</p>
                <p className="mt-1 text-sm text-text-primary">{signal.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Gauge className="h-4 w-4 text-focus-green" aria-hidden="true" />
              focus score
            </div>
            <p className="mt-3 text-3xl font-light text-text-primary">86</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[86%] rounded-full bg-focus-green" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Headphones className="h-4 w-4 text-focus-green" aria-hidden="true" />
              ambient track
            </div>
            <p className="mt-3 text-base text-text-primary">Forest rain, 18%</p>
            <div className="mt-4 flex items-end gap-1" aria-hidden="true">
              {[22, 34, 18, 42, 28, 36, 20, 30].map((height, index) => (
                <span
                  key={index}
                  className="w-full rounded-full bg-focus-green/55"
                  style={{ height }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

export default function LandingPage() {
  return (
    <AmbientScene variant="forest" intensity="medium" className="bg-bg-void">
      <PublicNav />

      <main className="relative pt-24 md:pt-28">
        <section className="px-4 pb-16 sm:px-6 md:pb-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="max-w-2xl space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs text-text-secondary backdrop-blur-xl">
                <Sparkles className="h-3.5 w-3.5 text-focus-green" aria-hidden="true" />
                A quieter way into deep work
              </div>

              <div className="space-y-5">
                <h1 className="max-w-[11ch] font-display text-5xl font-light leading-[1.02] text-text-primary sm:text-6xl md:text-7xl">
                  Your calm space for deep work
                </h1>
                <p className="max-w-[58ch] text-base leading-8 text-text-secondary sm:text-lg">
                  Start focused sessions, stay in flow, and understand what breaks your attention.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    className="h-12 w-full rounded-2xl px-6 shadow-glow sm:w-auto"
                  >
                    Start focusing
                  </Button>
                </Link>
                <Link href="/#features" className="w-full sm:w-auto">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="h-12 w-full rounded-2xl bg-white/[0.045] px-6 sm:w-auto"
                  >
                    Explore features
                  </Button>
                </Link>
              </div>

              <div className="grid max-w-xl gap-3 text-sm text-text-secondary sm:grid-cols-3">
                {["Timer first", "Gentle recovery", "Quiet analytics"].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <FocusRoomPreview />
          </div>
        </section>

        <section id="features" className="px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm text-text-muted">What FocusOS keeps simple</p>
              <h2 className="font-display text-4xl font-light leading-tight text-text-primary md:text-5xl">
                A focus ritual instead of another dashboard.
              </h2>
              <p className="text-base leading-7 text-text-secondary">
                The public surface now leads with the feeling of entering a workspace. The details stay close to the session.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <GlassPanel key={feature.title} className="p-6">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-focus-green">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-medium text-text-primary">{feature.title}</h3>
                        <p className="leading-7 text-text-secondary">{feature.description}</p>
                      </div>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
          </div>
        </section>

        <section id="score" className="px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <GlassPanel variant="subtle" className="p-6 md:p-8">
              <div className="rounded-[2rem] border border-white/10 bg-bg-void/60 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-muted">post-session reflection</p>
                    <h3 className="mt-2 text-2xl font-light text-text-primary">
                      What changed your attention today?
                    </h3>
                  </div>
                  <Gauge className="h-6 w-6 text-focus-green" aria-hidden="true" />
                </div>
                <div className="mt-8 space-y-4">
                  {[
                    ["Best stretch", "22 minutes without context switching"],
                    ["Recovered once", "Social feed opened, session continued"],
                    ["Next session", "Move reading block before messages"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <p className="text-xs text-text-muted">{label}</p>
                      <p className="mt-1 text-sm text-text-primary">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </GlassPanel>

            <div className="space-y-5">
              <p className="text-sm text-text-muted">Less analytics, more awareness</p>
              <h2 className="font-display text-4xl font-light leading-tight text-text-primary md:text-5xl">
                Understand the break in attention, then return calmly.
              </h2>
              <p className="text-base leading-7 text-text-secondary">
                FocusOS still measures focus quality, but the introduction keeps analytics in service of the session, not above it.
              </p>
              <Link href="/register" className="inline-flex">
                <Button variant="secondary" size="lg" className="rounded-2xl bg-white/[0.045]">
                  Create your space
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section id="extension" className="px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-5xl">
            <GlassPanel variant="strong" className="overflow-hidden p-6 md:p-10">
              <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-bg-void/60 text-focus-green">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">Focus tracking enabled</p>
                      <p className="text-xs text-text-muted">Quiet browser support during sessions</p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-3 text-sm text-text-secondary">
                    <div className="flex items-center justify-between">
                      <span>Distracting tabs</span>
                      <span className="text-text-primary">quieted</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Goal relevance</span>
                      <span className="text-text-primary">watched</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Sensitive fields</span>
                      <span className="text-text-primary">ignored</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <p className="text-sm text-text-muted">Browser companion</p>
                  <h2 className="font-display text-4xl font-light leading-tight text-text-primary md:text-5xl">
                    A quiet layer that helps protect the session.
                  </h2>
                  <p className="text-base leading-7 text-text-secondary">
                    The extension supports focus tracking while you work. It is framed as part of your workspace, not a permission wall.
                  </p>
                  <Link href="/register" className="inline-flex">
                    <Button variant="primary" size="lg" className="rounded-2xl">
                      Start focusing
                    </Button>
                  </Link>
                </div>
              </div>
            </GlassPanel>
          </div>
        </section>
      </main>

      <PublicFooter />
    </AmbientScene>
  );
}
