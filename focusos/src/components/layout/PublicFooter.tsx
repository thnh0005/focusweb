import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-white/[0.06] bg-bg-void/70 py-8 text-xs text-text-muted backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row">
        <p>© {currentYear} FocusOS. Built for digital calm.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3" aria-label="Footer navigation">
          <Link href="/privacy" className="transition-colors hover:text-text-secondary">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-text-secondary">
            Terms
          </Link>
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-text-secondary"
          >
            Extension
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
