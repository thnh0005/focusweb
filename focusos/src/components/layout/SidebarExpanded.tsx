"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, BarChart2, Library, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "../ui/Button";

export interface SidebarExpandedProps {
  isOpen: boolean;
  onHoverEnd: () => void;
}

export function SidebarExpanded({ isOpen, onHoverEnd }: SidebarExpandedProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", icon: <Home className="h-4 w-4 stroke-[1.5]" />, href: "/dashboard" },
    { label: "Analytics", icon: <BarChart2 className="h-4 w-4 stroke-[1.5]" />, href: "/analytics" },
    { label: "Study Tools", icon: <Library className="h-4 w-4 stroke-[1.5]" />, href: "/study-tools" },
    { label: "Settings", icon: <Settings className="h-4 w-4 stroke-[1.5]" />, href: "/settings" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay for mobile to click-close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 bg-background z-20 md:hidden"
            onClick={onHoverEnd}
          />

          {/* Expanded Sidebar Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1], // --ease-reveal
            }}
            className="fixed left-16 top-0 h-full w-48 bg-surface-deep/95 backdrop-blur-2xl border-r border-white/5 z-30 flex flex-col py-24 px-4 space-y-6 shadow-glass select-none"
            onMouseLeave={onHoverEnd}
            aria-label="Expanded Navigation"
          >
            <div className="flex flex-col space-y-2">
              <span className="text-[10px] font-mono tracking-[0.2em] text-text-muted uppercase px-3">
                Sanctuary
              </span>
              <nav className="flex flex-col space-y-1" aria-label="Expanded Navigation Links">
                {navItems.map((item, idx) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.24, delay: idx * 0.03 }}
                    >
                      <Link href={item.href} onClick={onHoverEnd} tabIndex={-1}>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-xs font-light tracking-wide px-3 py-2 h-9 rounded-lg transition-colors group",
                            isActive
                              ? "bg-white/[0.04] text-text-primary border border-white/5"
                              : "text-text-secondary hover:text-text-primary hover:bg-white/[0.02]"
                          )}
                        >
                          <span className="mr-2.5 transition-transform duration-120 group-hover:scale-105">
                            {item.icon}
                          </span>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity ml-auto" />
                        </Button>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
