"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Button } from "../ui/Button";

export function PublicNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { label: "Features", href: "/#features" },
    { label: "AI Score", href: "/#score" },
    { label: "Extension", href: "/#extension" },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 h-[72px] flex items-center transition-all duration-400 ease-reveal",
          isScrolled
            ? "glass-nav shadow-md"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-7xl w-full mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center space-x-2 select-none group focus-visible:outline-none"
            aria-label="FocusOS Home"
          >
            <div className="h-9 w-9 rounded-xl bg-focus-purple/20 border border-focus-purple/30 flex items-center justify-center text-focus-purple font-mono font-bold text-lg transition-transform duration-120 group-hover:scale-105 active:scale-[0.98]">
              ✦
            </div>
            <span className="font-sans font-light text-base tracking-tight text-text-primary">
              Focus<span className="font-normal text-focus-purple">OS</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8" aria-label="Main Navigation">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm font-light text-text-secondary hover:text-text-primary transition-colors duration-120 select-none"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/login" tabIndex={-1}>
              <Button
                variant="ghost"
                size="sm"
                className="text-text-secondary hover:text-text-primary"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/register" tabIndex={-1}>
              <Button
                variant="primary"
                size="sm"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle (Hamburger Morph) */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="md:hidden relative h-10 w-10 flex flex-col items-center justify-center rounded-full border border-white/5 hover:border-white/10 bg-white/[0.03] transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={isMobileOpen}
            aria-label="Toggle navigation menu"
          >
            <div className="w-5 flex flex-col space-y-1.5 relative">
              <motion.span
                animate={isMobileOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-0.5 bg-text-primary block origin-center"
              />
              <motion.span
                animate={isMobileOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-0.5 bg-text-primary block origin-center"
              />
            </div>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-background/95 backdrop-blur-2xl z-30 flex flex-col pt-32 px-8 pb-12 justify-between md:hidden"
          >
            {/* Links Stack */}
            <nav className="flex flex-col space-y-6" aria-label="Mobile Navigation">
              {navItems.map((item, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{
                    duration: 0.4,
                    delay: idx * 0.05,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  key={item.label}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className="text-2xl font-light text-text-secondary hover:text-text-primary transition-colors select-none"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* CTAs Stack */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col space-y-4"
            >
              <Link href="/login" onClick={() => setIsMobileOpen(false)} tabIndex={-1}>
                <Button
                  variant="secondary"
                  className="w-full h-12 text-base"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/register" onClick={() => setIsMobileOpen(false)} tabIndex={-1}>
                <Button
                  variant="primary"
                  className="w-full h-12 text-base"
                >
                  Get Started
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
