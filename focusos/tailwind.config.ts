import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      xs: "375px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        // ── Neutrals & Backgrounds ──────────────────────────────────
        background: "hsl(var(--background))",
        "surface-deep": "hsl(var(--surface-deep))",
        "card-container": "hsl(var(--card-container))",
        "subtle-border": "hsl(var(--subtle-border))",

        // ── Text ────────────────────────────────────────────────────
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        "text-muted": "hsl(var(--text-muted))",

        // ── Brand / Accent ───────────────────────────────────────────
        "focus-purple": "hsl(var(--focus-purple))",
        "focus-purple-muted": "hsl(var(--focus-purple-muted))",
        "focus-green": "hsl(var(--focus-green))",
        "focus-green-muted": "hsl(var(--focus-green-muted))",
        "ambient-cyan": "hsl(var(--ambient-cyan))",

        // ── Urgency Hierarchy ────────────────────────────────────────
        "urgency-amber": "hsl(var(--urgency-amber))",
        "urgency-coral": "hsl(var(--urgency-coral))",

        // ── Focus Score States ───────────────────────────────────────
        "score-deep-focus": "#22c55e",
        "score-focused": "#84cc16",
        "score-average": "#eab308",
        "score-distracted": "#f97316",
        "score-highly-distracted": "#ef4444",

        // ── Shadcn compatibility ─────────────────────────────────────
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },

      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
        timer: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },

      fontSize: {
        timer: ["72px", { lineHeight: "80px", fontWeight: "300" }],
        "timer-sm": ["48px", { lineHeight: "56px", fontWeight: "300" }],
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        pill: "1000px",
        "glass-card": "1.5rem",
        "glass-inner": "calc(1.5rem - 3px)",
      },

      // ── Custom easing curves (design1.md spec) ───────────────────
      transitionTimingFunction: {
        reveal: "cubic-bezier(0.16, 1, 0.3, 1)",
        float: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
        pulse: "cubic-bezier(0.4, 0, 0.6, 1)",
        dismiss: "cubic-bezier(0.4, 0, 1, 1)",
      },

      // ── Duration tokens ──────────────────────────────────────────
      transitionDuration: {
        instant: "120ms",
        fast: "240ms",
        normal: "400ms",
        slow: "800ms",
        ambient: "20000ms",
      },

      // ── Spacing ──────────────────────────────────────────────────
      spacing: {
        "sidebar-rail": "64px",
        "sidebar-expanded": "240px",
      },

      // ── Animations ───────────────────────────────────────────────
      keyframes: {
        "orb-float": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(30px, -20px)" },
          "50%": { transform: "translate(-20px, 30px)" },
          "75%": { transform: "translate(20px, 20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(-100%) translateX(-50%)", opacity: "0" },
          to: { transform: "translateY(0) translateX(-50%)", opacity: "1" },
        },
      },
      animation: {
        "orb-float": "orb-float 20s ease-float infinite",
        "pulse-glow": "pulse-glow 3s ease-pulse infinite",
        "fade-up": "fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fade-in 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 2s linear infinite",
        "slide-in-right": "slide-in-right 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 400ms cubic-bezier(0.16, 1, 0.3, 1)",
      },

      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "glass-highlight": "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)",
      },

      boxShadow: {
        glass: "inset 0 1px 0 rgba(255,255,255,0.10), 0 8px 32px rgba(0,0,0,0.48)",
        "glass-sm": "inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.32)",
        "focus-purple": "0 0 40px rgba(124, 58, 237, 0.3)",
        "focus-green": "0 0 40px rgba(20, 184, 166, 0.3)",
        "score-glow-green": "0 0 24px rgba(34, 197, 94, 0.4)",
        "score-glow-amber": "0 0 24px rgba(234, 179, 8, 0.4)",
        "score-glow-red": "0 0 24px rgba(239, 68, 68, 0.4)",
      },

      backdropBlur: {
        glass: "24px",
        "glass-sm": "12px",
      },
    },
  },
  plugins: [],
};

export default config;
