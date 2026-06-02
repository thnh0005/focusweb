"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "../ui/Button";

const navItems = [
  { label: "Features", href: "/#features" },
  { label: "Focus score", href: "/#score" },
  { label: "Extension", href: "/#extension" },
];

export function PublicNav() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed left-0 right-0 top-0 z-40 flex h-[72px] items-center transition-all duration-300",
          isScrolled ? "glass-nav shadow-glass-sm" : "border-b border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-2xl focus-ring-soft"
            aria-label="FocusOS home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-focus-green transition-transform duration-150 group-hover:scale-[1.03]">
              <Leaf className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-base font-medium text-text-primary">
              Focus<span className="text-focus-green">OS</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg text-sm text-text-secondary transition-colors duration-150 hover:text-text-primary focus-ring-soft"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" tabIndex={-1}>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-text-secondary hover:text-text-primary"
              >
                Sign in
              </Button>
            </Link>
            <Link href="/register" tabIndex={-1}>
              <Button variant="primary" size="sm" className="rounded-xl shadow-glow">
                Start focusing
              </Button>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-text-primary transition-colors hover:bg-white/[0.075] focus-ring-soft md:hidden"
            aria-expanded={isMobileOpen}
            aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {isMobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-30 flex flex-col justify-between bg-bg-void/95 px-6 pb-10 pt-28 backdrop-blur-2xl md:hidden"
          >
            <nav className="flex flex-col gap-5" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-2xl font-light text-text-primary focus-ring-soft"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="grid gap-3">
              <Link href="/login" onClick={() => setIsMobileOpen(false)} tabIndex={-1}>
                <Button variant="secondary" className="h-12 w-full rounded-2xl text-base">
                  Sign in
                </Button>
              </Link>
              <Link href="/register" onClick={() => setIsMobileOpen(false)} tabIndex={-1}>
                <Button variant="primary" className="h-12 w-full rounded-2xl text-base">
                  Start focusing
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
