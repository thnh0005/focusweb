# FocusOS → Flocus Style: Frontend Rebuild Spec (Agent-Ready)
> Dựa trên: FocusOS Frontend Architecture Document v1.0 (2026-05-30)
> Mục tiêu: Tái thiết kế toàn bộ giao diện + UX theo phong cách Flocus/LifeAt

---

## 0. Agent Rules (must-follow)

- Backend giữ nguyên: khong thay doi API, DB, auth flows, endpoints, hay response schema.
- Chi refactor frontend/UI/UX. Khong thay doi contract voi backend.
- Tech stack co dinh: Next.js 14 App Router + TypeScript + TailwindCSS + shadcn/ui + Zustand + TanStack Query + Framer Motion.
- Font phai dung `next/font`. Khong su dung `@import` Google Fonts trong CSS.
- Icon: dung thu vien dang co trong repo (lucide-react). Khong them icon library moi neu khong can thiet.
- Motion: su dung Framer Motion (hoac `motion/react` neu da co). Tat ca animation can `prefers-reduced-motion`.
- Layout: khong dung `h-screen`, dung `min-h-[100dvh]`.
- RSC rule: bat ky component dung Zustand, hooks, Motion, browser APIs phai la Client Component.

**Design Read:** Immersive focus environment + data home. Session surface = Flocus/LifeAt; data surfaces = Linear-like density and clarity.

---

## 1. Design System (ap dung cho toan bo app)

### 1.1 Visual Philosophy
Chuyen doi: **"dashboard co timer"** → **"focus environment co data"**. Khong gian tap trung, thong tin xuat hien khi can.

### 1.2 Color Tokens

```css
:root {
  /* Backgrounds */
  --bg-void: #07070d;
  --bg-surface: #0f0f18;
  --bg-elevated: #16161f;
  --bg-overlay: rgba(7,7,13,0.85);

  /* Gradient Mesh Blobs */
  --blob-purple: #6B4FBB;
  --blob-indigo: #3B3AB8;
  --blob-magenta: #C7437A;
  --blob-coral: #E8625A;
  --blob-orange: #F0956A;
  --blob-break-teal: #1D9E75;
  --blob-break-cyan: #0EA5E9;
  --blob-break-navy: #1e3a5f;

  /* Accent */
  --accent: #6D5CE8;
  --accent-hover: #7D6CF0;
  --accent-glow: rgba(109,92,232,0.35);

  /* Focus Score */
  --score-deep: #22c55e;
  --score-focused: #84cc16;
  --score-average: #eab308;
  --score-distracted: #f97316;
  --score-critical: #ef4444;

  /* Text */
  --text-primary: #F0EFF8;
  --text-secondary: rgba(240,239,248,0.6);
  --text-muted: rgba(240,239,248,0.35);

  /* Borders */
  --border-subtle: rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.10);
  --border-strong: rgba(255,255,255,0.18);

  /* Glass */
  --glass-bg: rgba(15,15,24,0.55);
  --glass-blur: blur(16px);
  --glass-border: rgba(255,255,255,0.08);
}
```

### 1.3 Typography

- Display: Sora (timer, headline)
- Body: DM Sans (UI, labels)

```tsx
import { Sora, DM_Sans } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});
```

```css
:root {
  --size-timer-xl: clamp(72px, 14vw, 120px);
  --size-timer-lg: clamp(48px, 8vw, 80px);
  --size-score: clamp(40px, 6vw, 64px);
  --size-h1: clamp(28px, 4vw, 40px);
  --size-h2: 22px;
  --size-h3: 16px;
  --size-body: 14px;
  --size-caption: 12px;
}
```

### 1.4 GradientMeshBackground

- Component: `components/layout/GradientMeshBackground.tsx`
- Props: `mode: "focus" | "short-break" | "long-break" | "landing" | "onboarding"`
- 5 blobs, radial gradients, blur 80px, fixed, z-index -1
- Timings: 22s / 28s / 18s / 25s / 32s, infinite alternate
- Mode change: Framer Motion color transition 1.5s
- `prefers-reduced-motion`: static

### 1.5 GlassPanel

Reusable surface for HUD panels:

```css
backdrop-filter: blur(16px) saturate(180%);
background: rgba(15,15,24,0.55);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 16px;
```

### 1.6 Navigation Modes (structure unchanged)

- Mode A (Sidebar): rail 64px, expanded 240px, hover expand, active left border accent, extension status dot, avatar dropdown.
- Mode B (Minimal / Onboarding): no sidebar, centered layout, top progress bar.
- Mode C (Session Immersive): zero chrome, only `SessionEndPill` and `MusicPlayerHUD`.
- Mode D (Public): top navbar, glass on scroll, no sidebar.

### 1.7 Motion Rules

```tsx
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const containerVariants = { enter: { transition: { staggerChildren: 0.06 } } };
const cardVariants = { initial: { opacity: 0, y: 12 }, enter: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const sidebarSpring = { type: "spring", stiffness: 300, damping: 30 };
```

---

## 2. State Management (Zustand, khong doi structure)

### `useSessionStore`

```ts
sessionStatus: "idle" | "configuring" | "active" | "paused" | "auto-paused" | "ending" | "completed";

// active: gradient animate, timer run, score live
// paused: timer dim 0.6, gradient slow x3
// auto-paused: timer stop, warning overlay + amber tint
// completed: flash, navigate /session/summary/:id

// Extension bridge:
// Outgoing: SESSION_START, SESSION_PAUSE, SESSION_RESUME, SESSION_END
// Incoming: SCORE_UPDATE -> updateRealtimeScore(), WARNING -> triggerWarning(), PING_RESPONSE
```

### `useUserStore`

```ts
// theme update -> set CSS vars on documentElement
// cyber (default), minimal, forest
```

---

## 3. Core Component Behaviors

### Button Variants

```
primary   -> Solid accent, white text, 8px radius, hover scale 1.02 + glow
secondary -> Transparent, border default, text secondary, hover bg-elevated
ghost     -> No border, text secondary, hover bg-surface
danger    -> score-critical tint, white text
session   -> Large, animated gradient border on hover
```

### FocusScoreGauge

- SVG gauge with CSS `stroke-dashoffset` transition only
- `transition: stroke 1.5s ease, stroke-dashoffset 1.2s ease`
- Color maps to `--score-*`

### DistractionWarningOverlay

- Warning 1: top banner 60px, orange left border, fade-in from top
- Warning 2: 40% screen overlay, dim background, stronger CTA
- Warning 3: 85% overlay, urgent CTA, pulsing border
- Auto-Pause: full modal, focus trap, `role="alertdialog"`

---

## 4. Screen Specs

### 4.1 `/` Landing

**Layout:** Full-bleed dark canvas, `GradientMeshBackground mode="landing"`, top navbar glass on scroll.

**Sections:**
- Hero: Sora headline, DM Sans subhead, CTA primary + ghost, animated FocusScoreGauge demo, low-opacity ambient particles.
- ProductShowcase: 3 scroll panels (Session → Score → Insight), glass card, mockup right, copy left, `useInView` reveal.
- FeaturesGrid: 3-col (1-col mobile), glass cards, icon, 1-line description, hover lift + glow.
- CTABanner: full-width accent strip + register CTA.

**Transitions:** Scroll fade-up, navbar glass on scroll.

### 4.2 `/login` + `/register`

**Layout:** Centered AuthCard (420px) on `GradientMeshBackground mode="onboarding"`.

**Login:** email + password, focus ring accent, submit pill, error banner `score-critical`.

**Register:** adds PasswordStrengthBar (4 segments) + live confirm match.

**Interaction:** submit -> loading spinner inside button -> redirect.

### 4.3 `/onboarding` (4 steps)

**Shell:** 560px max-width glass panel, thin progress line top, "Step X of 4".

**Step 1:** Profession chips (Student/Developer/Designer/Freelancer/Researcher/Other).

**Step 2:** Domain chips (Frontend/Backend/AI-ML/Design/Language/Other).

**Step 3:** Duration cards (25/50/90) + custom input. Selected = accent border + tint.

**Step 4:** Extension install. Detect browser, show Chrome CTA, heartbeat polling (10s), auto-advance on success, Skip always visible.

**Nav:** Back/Continue pills. Continue disabled until selection. Skip -> POST partial -> `/dashboard`.

**Transitions:** Slide-left on advance, slide-right on back with `AnimatePresence`.

### 4.4 `/dashboard`

**Layout:** AppLayout. Content `max-w-screen-xl px-8 py-6`. Solid `--bg-void`.

**Greeting:** Sora h1, name in accent, date subtitle, streak badge inline.

**StatsStrip:** 4 MetricCard, 2x2 on tablet, 1-col on mobile, shimmer skeleton when loading.

**Main Grid (lg+):**
- Left 60%: RecentContextCard + SessionHistoryList (SessionCard + SessionDetailDrawer 480px).
- Right 40%: StartSessionButton (accent, gradient border hover), WeeklySnapshotCard (collapsible), FocusScoreMiniChart (sparkline), ExtensionInstallBanner (dismissible).

**Empty State:** geometric illustration, "Your focus journey starts here", single CTA.

**SessionConfigDrawer:** bottom sheet on mobile, right drawer on desktop. ModeToggle + GoalInput + GoalTemplateLibrary + DurationSelector + TagSelector + SmartPresetBanner. Footer Cancel + Start.

### 4.5 `/session` (pre-config page)

Same content as SessionConfigDrawer, centered glass panel on `GradientMeshBackground mode="focus"`. No sidebar.

### 4.6 `/session/active` (core)

**Layout:** SessionLayout, zero chrome. Live GradientMeshBackground.

**Center stack:** goal text -> FocusTimer -> FocusScoreGauge + FocusStateLabel -> Pause/Resume + End Session.

**FocusTimer states:** active pulse, paused dim 0.6 + label, auto-paused amber glow.

**RealtimeFocusScore:** CSS-only gauge, score updates via `window.postMessage` every 30-60s.

**SessionNotepad:** toggle with `N`, floating glass panel, autosave, full-screen on mobile.

**MusicPlayerHUD:** bottom-center, collapsed vs expanded, height animation.

**TabCounter:** top-right glass badge, hidden until count > 0.

**Distraction warnings:** 3-tier overlays + auto-pause modal (focus trapped).

**Keyboard:** Space pause/resume, Esc end confirm, N notepad, M music.

**Timer end:** scale-up 00:00 -> 1s pause -> `/session/summary/:id`.

### 4.7 `/session/summary/:id`

**Layout:** AppLayout, max-w 720px.

**SummaryHero:** 200px gauge, Sora xl score, spring fill 1.2s.

**Breakdown:** RadialBarChart or custom SVG, 4 components.

**Metadata:** glass card with mode, goal, tags, duration, date.

**AIInsightPanel:** glass card, loading skeleton, error state with retry.

**SessionNoteSummary:** show if note exists.

**DistractionEventLog:** warning count + top domains.

**ActionRow:** Start Another Session (accent), View Analytics (secondary), Back to Dashboard (ghost).

### 4.8 `/study-tools`

**Header:** title, search input right, Upload button.

**DropZone:** dashed border, drag-over accent, supports PDF/DOCX/TXT <= 10MB, progress bar.

**DocumentGrid:** 4->3->2->1 cols. Card with file type icon, name, date, page count, hover actions, delete confirm.

**Empty:** large drop zone + centered text + icon.

### 4.9 `/study-tools/:id`

**Header:** back chevron + filename + upload date.

**Tabs:** Summary | Flashcards (pill, active accent).

**Summary:** ModeToggle, streaming reveal text, Regenerate ghost button.

**Flashcards:** Page range, quantity chips, difficulty chips, Generate CTA, skeleton grid, deck preview, Start Review CTA.

### 4.10 `/study-tools/:id/review`

**Layout:** centered, max-w 600px.

**Progress:** "Card X of Y" + thin progress line.

**FlashcardDisplay:** 480x320 glass, rotateY flip 0.5s.

**Controls:** Prev/Next pills, slide-left/right transitions.

**Complete:** confetti burst + score + CTA back.

### 4.11 `/analytics`

**Layout:** AppLayout, 12-col grid.

**Header:** title, date range pills, export ghost button.

**KPIStrip:** 4 MetricCard.

**Charts:**
- FocusTrendChart (8 cols) with gradient fill + tooltip + day/week toggle.
- DistractionSummary (4 cols) ranked list + severity badges.
- TimeHeatmap (6 cols) 24x7 grid with aria labels, peak cell accent ring.
- SessionBreakdown (6 cols) pie chart.
- WeeklyProgressSnapshot (12 cols) collapsible glass card.

**Empty (<5 sessions):** soft lock message + grey placeholders.

### 4.12 `/settings/*`

**Layout:** AppLayout, left sidebar (200px) + content. Mobile -> stacked navigation.

**Profile:** avatar upload, display name, email, save. Password change. Danger zone: delete + export.

**Preferences:** default duration, default mode, goal templates drag reorder, auto-save (800ms).

**Blacklist:** add domain + severity, table with optimistic updates, sync badge, toggle defaults.

**Notifications:** toggles + time pickers + request permission button.

**Theme:** 3 theme cards (Cyber/Minimal/Forest), 1s preview transition, Apply to confirm; ambient effects + opacity slider.

**Extension:** status card, reconnect button, install instructions accordion.

---

## 5. Accessibility (WCAG 2.1 AA)

- FocusTimer: `role="timer"` + `aria-live="polite"` (announce minutes only)
- FocusScoreGauge: `aria-label="Focus Score: {score} out of 100, state: {stateLabel}"`
- Warning overlays: `role="alertdialog"`, `aria-modal="true"`, focus trap
- Heatmap: each cell `aria-label="Tuesday 10pm: 82 focus score"`
- Charts: aria descriptions + hidden tabular summary
- Keyboard shortcuts documented in CommandPalette
- Reduced motion respected
- Contrast 4.5:1

---

## 6. Responsive Breakpoints

```
xs 375
sm 640
md 768
lg 1024
xl 1280
2xl 1536
```

**Behaviors:** sidebar hidden below lg (bottom nav icon-only), timer scales with clamp, StatsStrip 4->2->1, heatmap scroll on <md, notepad full-screen on mobile, settings stacked.

---

## 7. Performance

- Recharts: `dynamic(..., { ssr: false, loading: <ChartSkeleton /> })`
- FlashcardDisplay lazy loaded
- Framer Motion: `LazyMotion + domAnimation`
- TanStack Query staleTime: dashboard 60s, sessions 30s, analytics 5min, blacklist Infinity
- `refetchOnWindowFocus: false` (session critical)
- Ambient particles: OffscreenCanvas + Worker
- Images: `next/image` with explicit sizes

---

## 8. Delivery Order

1. Design system (globals, CSS vars, fonts)
2. GradientMeshBackground
3. GlassPanel
4. Layouts (SidebarRail, SidebarExpanded, SessionLayout)
5. Core components (Button, FocusScoreGauge, FocusTimer, MetricCard)
6. Zustand stores (verbatim structure)
7. Pages: Landing -> Auth -> Onboarding -> Dashboard -> Session -> Summary -> Study Tools -> Analytics -> Settings

**Acceptance:** tat ca component/states/interactions/motion/ARIA/keyboard shortcuts duoc implement day du. Session surface giong Flocus; data surfaces giong Linear; chung 1 design system.

