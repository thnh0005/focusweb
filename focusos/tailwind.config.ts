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
        background: "hsl(var(--background))",
        "surface-deep": "hsl(var(--surface-deep))",
        "card-container": "hsl(var(--card-container))",
        "subtle-border": "hsl(var(--subtle-border))",
        "bg-void": "var(--bg-void)",
        "bg-ink": "var(--bg-ink)",
        "bg-surface": "var(--bg-surface)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-overlay": "var(--bg-overlay)",

        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        "text-muted": "hsl(var(--text-muted))",

        "focus-purple": "hsl(var(--focus-purple))",
        "focus-purple-muted": "hsl(var(--focus-purple-muted))",
        "focus-green": "hsl(var(--focus-green))",
        "focus-green-muted": "hsl(var(--focus-green-muted))",
        "ambient-cyan": "hsl(var(--ambient-cyan))",
        "accent-soft": "hsl(var(--accent-soft))",

        "urgency-amber": "hsl(var(--urgency-amber))",
        "urgency-coral": "hsl(var(--urgency-coral))",

        "score-deep-focus": "hsl(var(--score-deep))",
        "score-focused": "hsl(var(--score-focused))",
        "score-average": "hsl(var(--score-average))",
        "score-distracted": "hsl(var(--score-distracted))",
        "score-highly-distracted": "hsl(var(--score-critical))",

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
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        timer: ["var(--font-sans)", "system-ui", "sans-serif"],
      },

      fontSize: {
        timer: ["72px", { lineHeight: "80px", fontWeight: "300" }],
        "timer-sm": ["48px", { lineHeight: "56px", fontWeight: "300" }],
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 0.25rem)",
        "2xl": "calc(var(--radius) + 0.5rem)",
        pill: "1000px",
        "glass-card": "calc(var(--radius) + 0.25rem)",
        "glass-inner": "calc(var(--radius) - 0.25rem)",
      },

      transitionTimingFunction: {
        reveal: "cubic-bezier(0.16, 1, 0.3, 1)",
        float: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
        pulse: "cubic-bezier(0.4, 0, 0.6, 1)",
        dismiss: "cubic-bezier(0.4, 0, 1, 1)",
      },

      transitionDuration: {
        instant: "120ms",
        fast: "240ms",
        normal: "400ms",
        slow: "800ms",
        ambient: "24000ms",
      },

      spacing: {
        "sidebar-rail": "64px",
        "sidebar-expanded": "240px",
      },

      keyframes: {
        "aurora-drift": {
          "0%": { transform: "translate3d(-2%, -1%, 0) rotate(0deg) scale(1)" },
          "100%": { transform: "translate3d(4%, 3%, 0) rotate(8deg) scale(1.08)" },
        },
        "aurora-breathe": {
          "0%": { transform: "translate3d(2%, 3%, 0) rotate(-4deg) scale(1)", opacity: "0.52" },
          "100%": { transform: "translate3d(-3%, -2%, 0) rotate(6deg) scale(1.12)", opacity: "0.74" },
        },
        "orb-float": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(28px, -18px)" },
          "50%": { transform: "translate(-22px, 26px)" },
          "75%": { transform: "translate(18px, 20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.58" },
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
        "aurora-drift": "aurora-drift 28s ease-in-out infinite alternate",
        "aurora-breathe": "aurora-breathe 36s ease-in-out infinite alternate",
        "orb-float": "orb-float 24s ease-float infinite",
        "pulse-glow": "pulse-glow 3s ease-pulse infinite",
        "fade-up": "fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fade-in 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 2.1s linear infinite",
        "slide-in-right": "slide-in-right 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 400ms cubic-bezier(0.16, 1, 0.3, 1)",
      },

      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "ambient-aurora":
          "radial-gradient(circle at 18% 22%, rgb(113 143 116 / 0.55), transparent 24%), radial-gradient(circle at 74% 18%, rgb(143 88 102 / 0.28), transparent 26%), radial-gradient(circle at 48% 72%, rgb(143 176 162 / 0.24), transparent 30%)",
        "ambient-forest":
          "radial-gradient(circle at 22% 22%, rgb(68 108 84 / 0.5), transparent 26%), radial-gradient(circle at 70% 64%, rgb(164 185 138 / 0.18), transparent 28%)",
        "ambient-rain":
          "radial-gradient(circle at 26% 24%, rgb(111 155 153 / 0.38), transparent 26%), radial-gradient(circle at 76% 66%, rgb(125 136 150 / 0.22), transparent 30%)",
        "glass-highlight": "linear-gradient(135deg, rgb(255 255 255 / 0.1) 0%, rgb(255 255 255 / 0) 100%)",
      },

      boxShadow: {
        glass: "inset 0 1px 0 rgb(255 255 255 / 0.08), 0 24px 70px rgb(0 0 0 / 0.42)",
        "glass-sm": "inset 0 1px 0 rgb(255 255 255 / 0.06), 0 12px 34px rgb(0 0 0 / 0.32)",
        ambient: "0 28px 90px rgb(33 48 36 / 0.34)",
        glow: "0 0 80px rgb(124 171 145 / 0.2)",
        "focus-purple": "0 0 40px rgb(124 171 145 / 0.26)",
        "focus-green": "0 0 40px rgb(64 171 128 / 0.28)",
        "score-glow-green": "0 0 24px rgb(64 171 128 / 0.35)",
        "score-glow-amber": "0 0 24px rgb(218 165 78 / 0.34)",
        "score-glow-red": "0 0 24px rgb(224 93 97 / 0.34)",
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
