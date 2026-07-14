"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils/cn";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  /** The current pathname from usePathname() */
  pathname: string;
  /** Custom segment overrides — by default segments are derived from pathname */
  segments?: BreadcrumbSegment[];
  className?: string;
}

// ─── Pathname → Readable Label map ───────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "nav.dashboard",
  analytics: "nav.analytics",
  "study-tools": "nav.aiDocs",
  settings: "nav.settings",
  profile: "nav.profile",
  preferences: "nav.preferences",
  blacklist: "nav.blacklist",
  notifications: "nav.notifications",
  theme: "nav.theme",
  extension: "nav.extension",
  session: "nav.focus",
  active: "states.ready",
  summary: "nav.summary",
  review: "nav.review",
  upload: "nav.upload",
};

// ─── Derive segments from pathname ───────────────────────────────────────────

function deriveSegments(pathname: string, t: (key: string) => string): BreadcrumbSegment[] {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) {
    return [{ label: t("nav.dashboard"), href: "/dashboard" }];
  }

  return parts.map((part, idx) => {
    const href = "/" + parts.slice(0, idx + 1).join("/");
    // If segment looks like a UUID/dynamic id, label as "Detail"
    const isId = /^[0-9a-f-]{8,}$/i.test(part) || /^\d+$/.test(part);
    const label = isId
      ? t("nav.detail")
      : ROUTE_LABELS[part]
        ? t(ROUTE_LABELS[part])
        : capitalize(part.replace(/-/g, " "));
    return { label, href: idx < parts.length - 1 ? href : undefined };
  });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Breadcrumb({ pathname, segments, className }: BreadcrumbProps) {
  const { t } = useTranslation("common");
  const items = segments ?? deriveSegments(pathname, t);

  return (
    <nav
      aria-label={t("nav.home")}
      className={cn("flex items-center gap-1.5 min-w-0", className)}
    >
      {/* FocusOS root crumb */}
      <Link
        href="/dashboard"
        aria-label={t("nav.home")}
        className={cn(
          "flex items-center gap-1.5 text-text-muted hover:text-text-secondary",
          "transition-colors duration-[120ms]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        )}
      >
        <Home aria-hidden="true" className="h-3.5 w-3.5 shrink-0 stroke-[1.5]" />
        <span className="hidden sm:inline text-xs font-light tracking-[0.02em]">FocusOS</span>
      </Link>

      {items.map((seg, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${seg.label}-${idx}`}>
            {/* Separator */}
            <ChevronRight
              aria-hidden="true"
              className="h-3 w-3 shrink-0 text-text-muted/50 stroke-[1.5]"
            />

            {/* Segment */}
            {isLast || !seg.href ? (
              <span
                aria-current={isLast ? "page" : undefined}
                className={cn(
                  "text-xs font-light truncate max-w-[140px]",
                  isLast ? "text-text-primary" : "text-text-secondary"
                )}
              >
                {seg.label}
              </span>
            ) : (
              <Link
                href={seg.href}
                className={cn(
                  "text-xs font-light text-text-secondary hover:text-text-primary",
                  "transition-colors duration-[120ms] truncate max-w-[120px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                )}
              >
                {seg.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
