"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/Card";

const SETTINGS_SECTIONS = [
  {
    category: "Account",
    items: [
      { label: "Profile", href: "/settings/profile" },
      { label: "Preferences", href: "/settings/preferences" },
    ],
  },
  {
    category: "Experience",
    items: [
      { label: "Theme", href: "/settings/theme" },
      { label: "Notifications", href: "/settings/notifications" },
    ],
  },
  {
    category: "Tools",
    items: [
      { label: "Browser Extension", href: "/settings/extension" },
      { label: "Blacklist Management", href: "/settings/blacklist" },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-8 py-8">
      {/* Sidebar Navigation */}
      <aside className="w-56 flex-shrink-0">
        <div className="sticky top-8 space-y-6">
          {SETTINGS_SECTIONS.map((section) => (
            <div key={section.category} className="space-y-3">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                {section.category}
              </h3>
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-light ${
                        isActive
                          ? "bg-focus-purple/15 text-focus-purple border border-focus-purple/30"
                          : "text-text-secondary hover:text-text-primary hover:bg-surface-deep/50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
