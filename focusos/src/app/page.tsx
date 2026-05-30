import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "FocusOS — Transform Your Deep Work & Focus",
  description:
    "AI-powered platform that detects distraction, measures focus quality, and helps you maintain deep work sessions. Join students and professionals achieving measurable focus improvements.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 sm:py-32 relative overflow-hidden">
        {/* Subtle background orb - enhanced depth */}
        <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none">
          <div className="w-96 h-96 bg-focus-purple rounded-full blur-3xl opacity-40" />
          <div className="absolute w-72 h-72 bg-ambient-cyan rounded-full blur-3xl opacity-20" style={{ top: '20%', right: '10%' }} />
        </div>

        <div className="relative z-10 max-w-4xl text-center space-y-10">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-focus-purple/10 border border-focus-purple/20">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-focus-purple"></span>
            <span className="text-xs font-medium text-focus-purple tracking-wide">AI-Powered Deep Work</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-6xl sm:text-7xl font-extralight tracking-tight text-text-primary text-balance leading-tight">
              Reclaim Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-focus-purple to-ambient-cyan font-light">Focus & Flow</span>
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary font-light max-w-3xl mx-auto leading-relaxed">
              Real-time distraction detection powered by AI. Measure focus quality, identify patterns, and build deeper work habits that compound into measurable improvements.
            </p>
          </div>

          {/* CTA Buttons - improved styling */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Link href="/register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full bg-focus-purple hover:bg-focus-purple/90 text-white font-medium shadow-lg shadow-focus-purple/20 transition-all"
              >
                Start Free
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full border border-subtle-border text-text-primary hover:bg-surface-deep/40 hover:border-focus-purple/40 transition-all"
              >
                Sign In
              </Button>
            </Link>
          </div>

          {/* Trust Indicators - improved visual weight */}
          <div className="pt-16 space-y-8 border-t border-subtle-border">
            <p className="text-xs text-text-muted font-medium tracking-widest uppercase">Trusted by 2,400+ professionals</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <p className="text-4xl font-light text-focus-purple">2,400+</p>
                <p className="text-xs text-text-muted font-light">Active Users</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-light text-focus-purple">23%</p>
                <p className="text-xs text-text-muted font-light">Avg Focus Gain</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-light text-focus-purple">89K+</p>
                <p className="text-xs text-text-muted font-light">Sessions Tracked</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="px-4 py-20 sm:py-32 border-t border-subtle-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-5xl sm:text-5xl font-extralight text-text-primary text-balance leading-tight">
              Complete deep work toolkit
            </h2>
            <p className="text-text-secondary font-light max-w-2xl mx-auto">
              Everything you need built in. Focused product. No distractions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "⏱",
                title: "Smart Timer",
                description: "Flexible session durations with preset (25/50/90m) and custom options for your workflow.",
              },
              {
                icon: "🧠",
                title: "AI Detection",
                description: "Real-time distraction detection with progressive warnings to keep you on track.",
              },
              {
                icon: "📊",
                title: "Focus Score",
                description: "Quantifiable metric that evolves with your behavior to measure focus quality.",
              },
              {
                icon: "📈",
                title: "Analytics",
                description: "Identify distraction sources, optimal focus windows, and behavioral patterns.",
              },
              {
                icon: "🎵",
                title: "Ambient Music",
                description: "Curated soundscapes engineered to support deep work without cognitive load.",
              },
              {
                icon: "📚",
                title: "Study Tools",
                description: "Document analysis, AI summaries, and intelligent flashcard generation.",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group p-6 rounded-2xl bg-surface-deep/40 border border-subtle-border hover:border-focus-purple/40 transition-all duration-300 hover:bg-surface-deep/60"
              >
                <p className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">{feature.icon}</p>
                <h3 className="text-base font-medium text-text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-secondary font-light leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 sm:py-28 border-t border-subtle-border bg-gradient-to-b from-transparent to-surface-deep/20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-5xl sm:text-5xl font-extralight text-text-primary text-balance leading-tight">
            Ready to transform your deep work?
          </h2>
          <p className="text-lg text-text-secondary font-light max-w-2xl mx-auto leading-relaxed">
            Join thousands of students and professionals who are measuring and improving their focus quality every single day.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-focus-purple hover:bg-focus-purple/90 text-white font-medium shadow-lg shadow-focus-purple/30 transition-all"
            >
              Start Your Journey Free
            </Button>
          </Link>
          <p className="text-xs text-text-muted font-light">
            No credit card required • 7-day full access • Cancel anytime
          </p>
        </div>
      </section>
    </div>
  );
}
