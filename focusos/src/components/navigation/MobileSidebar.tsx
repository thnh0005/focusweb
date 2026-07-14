"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface MobileSidebarProps {
  streakCount?: number;
  userName?: string;
  avatarUrl?: string;
  onAvatarClick?: () => void;
  className?: string;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "AI Docs", href: "/study-tools", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings2 },
] as const;

export function MobileSidebar({ className }: MobileSidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "border-t border-white/[0.06] bg-bg-void",
        "backdrop-blur-[18px] backdrop-saturate-[180%]",
        className
      )}
    >
      <div className="grid h-14 grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          const baseClassName = cn(
            "flex flex-col items-center justify-center gap-0.5",
            "text-[10px] tracking-wide transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-void",
            isActive ? "text-focus-purple" : "text-text-muted"
          );

          return (
            <Link
              key={item.label}
              href={item.href}
              className={baseClassName}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
