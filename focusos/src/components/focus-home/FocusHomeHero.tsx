"use client";

import * as React from "react";

export interface FocusHomeHeroProps {
  displayName: string;
  className?: string;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate() {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export function FocusHomeHero({ displayName, className }: FocusHomeHeroProps) {
  const greeting = React.useMemo(() => getGreeting(), []);
  const formattedDate = React.useMemo(() => getFormattedDate(), []);

  return (
    <header className={className}>
      <p className="text-sm text-text-muted">{formattedDate}</p>
      <div className="mt-3 space-y-3">
        <h1 className="font-display text-4xl font-light leading-tight text-text-primary sm:text-5xl md:text-6xl">
          {greeting}, {displayName}
        </h1>
        <p className="max-w-[44ch] text-base leading-7 text-text-secondary sm:text-lg">
          What will you focus on today?
        </p>
      </div>
    </header>
  );
}
