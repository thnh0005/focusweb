import * as React from "react";
import Link from "next/link";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 bg-background py-8 text-center text-xs font-light text-text-muted select-none">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span>&copy; {currentYear} FocusOS. Engineered for digital calm.</span>
        </div>
        <nav className="flex items-center space-x-6" aria-label="Footer Navigation">
          <Link
            href="/privacy"
            className="hover:text-text-secondary transition-colors duration-120"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-text-secondary transition-colors duration-120"
          >
            Terms
          </Link>
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-secondary transition-colors duration-120 flex items-center space-x-1"
          >
            <span>Extension</span>
            <span className="text-[10px] opacity-75">↗</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
