"use client";

import * as React from "react";
import Link from "next/link";
import { Play, Upload, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

export function QuickActions() {
  const actions = [
    {
      id: "start-session",
      label: "Start Focus Session",
      description: "Launch a deep work blocks countdown timer",
      href: "/session",
      icon: Play,
      colorClass: "bg-focus-purple/10 text-focus-purple border-focus-purple/20 hover:bg-focus-purple/15",
    },
    {
      id: "upload-doc",
      label: "Upload Study Materials",
      description: "Convert textbook chapters to flashcards & summaries",
      href: "/study-tools",
      icon: Upload,
      colorClass: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/15",
    },
    {
      id: "blacklist",
      label: "Blacklist Manager",
      description: "Restrict distracting websites during active session",
      href: "/settings/blacklist",
      icon: ShieldAlert,
      colorClass: "bg-urgency-amber/10 text-urgency-amber border-urgency-amber/20 hover:bg-urgency-amber/15",
    },
  ];

  return (
    <Card 
      variant="glass-card" 
      className="border border-white/[0.04] bg-surface-deep/40 backdrop-blur-md flex flex-col h-full hover:border-white/[0.06] transition-colors"
    >
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base font-light tracking-wide text-text-primary">
          Quick Actions
        </CardTitle>
        <CardDescription className="text-text-muted text-xs font-light">
          Sanctuary controls for immediate deep work blocks
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Link
              key={act.id}
              href={act.href}
              className={cn(
                "flex items-center gap-4 p-3 rounded-2xl border bg-white/[0.01] border-white/[0.04]",
                "transition-all duration-[150ms] ease-reveal hover:scale-[1.01] hover:bg-white/[0.03] hover:border-white/[0.06]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "active:scale-[0.99] select-none"
              )}
            >
              <div className={cn("p-2.5 rounded-xl border flex items-center justify-center transition-colors", act.colorClass)}>
                <Icon className="h-4.5 w-4.5 stroke-[1.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-medium text-text-primary tracking-wide">
                  {act.label}
                </h5>
                <p className="text-[10px] text-text-muted font-light leading-relaxed truncate mt-0.5">
                  {act.description}
                </p>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
