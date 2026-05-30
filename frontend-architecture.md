# FocusOS — Frontend Architecture Document

**Version:** 1.0
**Tech Stack:** Next.js 14 App Router · TypeScript · TailwindCSS · Shadcn UI · Zustand · TanStack Query · Framer Motion
**Design Inspiration:** Flocus · LifeAt · Linear · Arc Browser · Notion Calendar
**Last Updated:** 2026-05-30

---

## Table of Contents

1. [Product Structure](#1-product-structure)
2. [Information Architecture](#2-information-architecture)
3. [Navigation Architecture](#3-navigation-architecture)
4. [Route Tree](#4-route-tree)
5. [Layout System](#5-layout-system)
6. [Page Architecture](#6-page-architecture)
7. [Component Architecture](#7-component-architecture)
8. [State Management](#8-state-management)
9. [Data Flow](#9-data-flow)
10. [Frontend Folder Structure](#10-frontend-folder-structure)
11. [Responsive Strategy](#11-responsive-strategy)
12. [Accessibility Strategy](#12-accessibility-strategy)
13. [Performance Strategy](#13-performance-strategy)
14. [Future Scalability](#14-future-scalability)

---

## 1. Product Structure

FocusOS is organized into five distinct product surfaces, each with a dedicated visual language and interaction model:

**Surface 1 — Public/Marketing** (`/`)
Entry point for unauthenticated users. Communicates value proposition, drives registration. Calm, immersive aesthetic inspired by LifeAt and Flocus.

**Surface 2 — Onboarding** (`/onboarding`)
Single-use personalization flow shown once post-registration. Multi-step wizard with progress. Data collected seeds AI behavior from day one.

**Surface 3 — Dashboard** (`/dashboard`)
The home base for authenticated users. Metric overview, session history, weekly snapshot, quick-start CTA. Linear-inspired information density with clear hierarchy.

**Surface 4 — Focus Session** (`/session`)
The core interaction surface. Full-screen, distraction-free timer with real-time focus score. Inspired by Arc Browser's spatial design and LifeAt's ambient atmosphere. This surface intentionally breaks from the standard dashboard chrome.

**Surface 5 — Study Tools** (`/study-tools`)
Document upload, AI summary, flashcard generation, and flashcard review. Notion Calendar-influenced layout with clean panels.

**Surface 6 — Analytics** (`/analytics`)
Deep-dive into behavioral patterns, distraction sources, time heatmaps, and weekly trends. Linear-style data visualization with dense, readable charts.

**Surface 7 — Settings** (`/settings`)
Account, preferences, blacklist manager, notification configuration, extension status, and theme selection.

---

## 2. Information Architecture

```
FocusOS
├── Public
│   ├── Landing Page
│   ├── Login
│   └── Register
│
├── Onboarding (post-registration, one-time)
│   ├── Step 1: Field / Profession
│   ├── Step 2: Learning Domain
│   ├── Step 3: Preferred Session Length
│   └── Step 4: Extension Install Prompt
│
├── Dashboard (authenticated root)
│   ├── Today Overview
│   │   ├── Streak Counter
│   │   ├── Quick Stats (time, sessions, score)
│   │   ├── Session Start CTA
│   │   └── Recent Sessions
│   ├── Weekly Snapshot
│   │   ├── Delta Cards (hours, score, deep work count)
│   │   └── AI Recommendation Banner
│   └── Session History
│       ├── Filters (date range, mode, tag)
│       └── Session Detail Drawer
│
├── Session
│   ├── Pre-Session Config
│   │   ├── Mode Select (Normal / Deep Work)
│   │   ├── Goal Entry + Template Library
│   │   ├── Duration Picker
│   │   └── Tag Selector
│   ├── Active Session
│   │   ├── Timer (countdown)
│   │   ├── Realtime Focus Score
│   │   ├── Focus State Indicator
│   │   ├── Session Note Pad
│   │   └── Music Player (ambient)
│   ├── Distraction Warning Overlay
│   │   ├── Warning 1, 2, 3
│   │   └── Auto-Pause Modal
│   └── Session Summary
│       ├── Final Focus Score
│       ├── Component Breakdown
│       ├── AI Session Insight
│       └── Session Tags / Note Review
│
├── Study Tools
│   ├── Document Library
│   │   ├── Upload Zone
│   │   └── Document List
│   ├── Document Viewer
│   │   ├── Summary Tab (Key Points / Detailed)
│   │   └── Flashcards Tab
│   └── Flashcard Review
│       ├── Card Display (Q → Reveal → A)
│       └── Review Progress
│
├── Analytics
│   ├── Overview (metrics strip)
│   ├── Focus Trend Chart
│   ├── Distraction Analytics
│   │   ├── Top Distraction Sources
│   │   └── Warning Frequency Chart
│   ├── Time-of-Day Heatmap
│   └── Weekly Progress Snapshot
│
└── Settings
    ├── Profile & Account
    ├── Session Preferences
    ├── Blacklist Manager
    ├── Notifications
    ├── Theme Customization
    ├── Ambient Effects
    └── Browser Extension Status
```

---

## 3. Navigation Architecture

### Navigation Paradigm

FocusOS adopts a **contextual navigation** model inspired by Arc Browser — the navigation chrome collapses and transforms based on the user's current surface. The session surface eliminates all navigation to preserve focus.

### Navigation Modes

**Mode A — Sidebar Navigation (Dashboard, Study Tools, Analytics, Settings)**
A 64px-wide icon rail on the left expands to a 240px labeled sidebar on hover/focus. Inspired by Linear's compact left nav. Shows: Dashboard, Analytics, Study Tools, Settings. User avatar and streak counter always visible.

**Mode B — Minimal Top Bar (Onboarding)**
Clean centered layout with step progress indicator. No sidebar. Back/Next controls only.

**Mode C — Session Immersive (Active Focus Session)**
Zero navigation chrome. Full-screen takeover. Only a discreet `⏸ End Session` pill visible in the bottom-right corner. Session Note opens as a floating panel. Music controls appear as a translucent HUD at bottom center.

**Mode D — Public (Landing, Login, Register)**
Standard top navbar with Logo, Login/Register CTAs. No sidebar.

### Primary Navigation Items (Authenticated)

```
Icon Rail
├── 🏠  Dashboard        → /dashboard
├── 📊  Analytics        → /analytics
├── 📚  Study Tools      → /study-tools
├── ⚙️   Settings         → /settings
│
└── (Bottom)
    ├── 🔥  Streak Badge
    └── 👤  Avatar → Profile Dropdown
```

### Extension Status Indicator

A persistent green/yellow/red dot on the sidebar rail indicates Browser Extension connectivity. Clicking opens an inline tooltip: "Extension Active — tracking paused until session starts."

---

## 4. Route Tree

```
app/
│
├── (public)/
│   ├── page.tsx                          # / — Landing Page
│   ├── login/
│   │   └── page.tsx                      # /login
│   └── register/
│       └── page.tsx                      # /register
│
├── onboarding/
│   ├── layout.tsx                        # Onboarding layout (no sidebar)
│   ├── page.tsx                          # /onboarding — Step 1 (redirect guard)
│   ├── domain/
│   │   └── page.tsx                      # /onboarding/domain — Step 2
│   ├── duration/
│   │   └── page.tsx                      # /onboarding/duration — Step 3
│   └── extension/
│       └── page.tsx                      # /onboarding/extension — Step 4
│
├── (app)/
│   ├── layout.tsx                        # Root app layout (sidebar + auth guard)
│   │
│   ├── dashboard/
│   │   ├── page.tsx                      # /dashboard
│   │   └── sessions/
│   │       └── [sessionId]/
│   │           └── page.tsx              # /dashboard/sessions/:id — Session Detail Drawer
│   │
│   ├── session/
│   │   ├── layout.tsx                    # Session layout (full-screen, no sidebar)
│   │   ├── page.tsx                      # /session — Pre-session config
│   │   ├── active/
│   │   │   └── page.tsx                  # /session/active — Active focus timer
│   │   └── summary/
│   │       └── [sessionId]/
│   │           └── page.tsx              # /session/summary/:id — Post-session summary
│   │
│   ├── study-tools/
│   │   ├── page.tsx                      # /study-tools — Document Library
│   │   ├── [documentId]/
│   │   │   ├── page.tsx                  # /study-tools/:id — Summary + Flashcard tabs
│   │   │   └── review/
│   │   │       └── page.tsx              # /study-tools/:id/review — Flashcard review
│   │   └── upload/
│   │       └── page.tsx                  # /study-tools/upload — Upload flow
│   │
│   ├── analytics/
│   │   └── page.tsx                      # /analytics — Full analytics view
│   │
│   └── settings/
│       ├── page.tsx                      # /settings → redirect to /settings/profile
│       ├── profile/
│       │   └── page.tsx                  # /settings/profile
│       ├── preferences/
│       │   └── page.tsx                  # /settings/preferences
│       ├── blacklist/
│       │   └── page.tsx                  # /settings/blacklist
│       ├── notifications/
│       │   └── page.tsx                  # /settings/notifications
│       ├── theme/
│       │   └── page.tsx                  # /settings/theme
│       └── extension/
│           └── page.tsx                  # /settings/extension
│
├── api/
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts                  # Auth API handler
│
├── layout.tsx                            # Root HTML layout
├── not-found.tsx                         # 404 page
└── error.tsx                             # Global error boundary
```

### Route Guards

All routes under `(app)/` are protected by a middleware-level auth check (`middleware.ts`). Unauthenticated requests are redirected to `/login`. Users who haven't completed onboarding are redirected to `/onboarding`. Active session state is persisted in Zustand; navigating away from `/session/active` triggers a "Session in progress" confirmation modal.

---

## 5. Layout System

### Public Layout

**File:** `app/(public)/layout.tsx`

**Purpose:** Wraps all unauthenticated pages (Landing, Login, Register). Provides the marketing top navbar and footer.

**Structure:**
```
<PublicLayout>
  <PublicNav />           ← Logo + Login/Register CTAs
  <main>{children}</main>
  <PublicFooter />        ← Privacy, Terms, Extension link
</PublicLayout>
```

**Visual Language:** Full-bleed dark background (`#0a0a0f`). Sparse, atmospheric. Top nav is transparent and transitions to a frosted-glass backdrop on scroll.

**Behavior:**
- Nav links: Logo (→ `/`), Login (→ `/login`), Get Started (→ `/register`)
- No sidebar, no user chrome
- Mobile: hamburger collapses to a full-screen overlay menu

---

### Dashboard Layout

**File:** `app/(app)/layout.tsx`

**Purpose:** Root authenticated layout wrapping Dashboard, Analytics, Study Tools, and Settings. Renders the collapsible sidebar rail + app shell.

**Structure:**
```
<AppLayout>
  <SidebarRail />           ← Icon rail (64px) — always visible
  <SidebarExpanded />       ← Full sidebar (240px) — hover/keyboard toggle
  <main>
    <TopBar />              ← Page title, breadcrumb, user actions
    {children}
  </main>
  <NotificationToast />     ← Global toast layer
  <CommandPalette />        ← ⌘K global command search
</AppLayout>
```

**Visual Language:** Very dark grey surface (`#0f0f14`) with a subtle sidebar border. Typography-forward. Content area uses a `max-w-screen-xl` container with generous padding.

**Behavior:**
- Sidebar rail shows icons + tooltips
- Sidebar expanded shows icons + labels + nested items
- Expansion triggered by hover (desktop) or click (mobile)
- Sidebar state persisted to `localStorage` preference
- Extension status dot always visible at bottom of rail
- User avatar opens a dropdown: Profile, Settings, Logout

---

### Focus Session Layout

**File:** `app/(app)/session/layout.tsx`

**Purpose:** Full-screen session shell. Completely removes sidebar and top bar to create an immersive, distraction-free environment.

**Structure:**
```
<SessionLayout>
  <SessionAmbientBackground />  ← Animated ambient (optional: rain, stars, etc.)
  <main>{children}</main>
  <SessionMusicHUD />           ← Floating music controls at bottom center
  <SessionEndPill />            ← Discreet "End Session" button bottom-right
  <DistractionWarningLayer />   ← Full-screen warning overlays (z-index: max)
</SessionLayout>
```

**Visual Language:** Near-black canvas. Centered timer as the dominant element. Soft gradient ambient light pulses with the Focus Score (green → amber → red). The overall feel is of a private, sacred workspace — borrowed from LifeAt's "scene" model but with more data-driven interactivity.

**Behavior:**
- `beforeunload` event + Zustand session guard prevents accidental exits
- Navigation to any other route during active session → confirmation modal
- `document.documentElement.requestFullscreen()` offered as optional immersion mode
- All keyboard shortcuts active: `Space` = pause/resume, `Esc` = exit prompt, `N` = note pad

---

### Analytics Layout

**File:** No dedicated layout — uses `(app)/layout.tsx`.

Analytics is a full-page within the standard AppLayout. Its content region uses a custom internal layout:

```
<AnalyticsPage>
  <AnalyticsHeader />           ← Title + date range filter + export button
  <MetricsStrip />              ← 4 summary KPI cards
  <AnalyticsGrid>               ← CSS Grid: 12-column responsive
    <FocusTrendChart />         ← Spans 8 cols
    <DistractionSummary />      ← Spans 4 cols
    <TimeHeatmap />             ← Spans 6 cols
    <SessionBreakdown />        ← Spans 6 cols
    <WeeklyProgressCard />      ← Spans 12 cols (full width)
  </AnalyticsGrid>
</AnalyticsPage>
```

---

### Settings Layout

**File:** No dedicated layout — uses `(app)/layout.tsx` with an internal two-column panel.

```
<SettingsPage>
  <SettingsSidebar />           ← Vertical sub-nav: Profile, Preferences, Blacklist...
  <SettingsContent>             ← Right panel renders child routes
    {children}                  ← Each settings sub-page
  </SettingsContent>
</SettingsPage>
```

---

## 6. Page Architecture

---

### `/` — Landing Page

**Purpose:** Convert visitors into registered users. Communicate the FocusOS value proposition with immersive, atmospheric UI.

**Components:**
- `HeroSection` — Headline, sub-headline, animated focus score demo, CTA pair (Get Started / Watch Demo)
- `ProductShowcaseSection` — Scrollytelling walkthrough of core features (Session → Score → Insight)
- `SocialProofSection` — Metric highlights (e.g., "Average Focus Score improved 23% in 30 days")
- `FeatureGrid` — 6-card grid: Timer, Deep Work Mode, AI Insight, Distraction Analytics, Study Tools, Focus Music
- `ExtensionCTA` — Prominent Chrome extension install prompt
- `PublicFooter` — Links, Privacy Policy, Terms of Service

**Actions:**
- Click "Get Started" → `/register`
- Click "Login" → `/login`
- Click "Install Extension" → Chrome Web Store (external, `target="_blank"`)

**Empty States:** N/A (no user data on this page)

**Error States:** N/A

---

### `/login` — Login Page

**Purpose:** Authenticate returning users and restore session state.

**Components:**
- `AuthCard` — Centered card container with logo, form, footer links
- `EmailInput` — Input with label, validation state
- `PasswordInput` — Input with show/hide toggle
- `SubmitButton` — Loading state on submit
- `AuthError` — Inline error banner: "Invalid email or password"
- `AuthFooter` — Links: "Don't have an account? Register" · "Forgot password?"

**Actions:**
- Submit form → POST `/api/auth/login` → redirect `/dashboard` on success
- Click Register link → `/register`

**Empty States:** N/A

**Error States:**
- Invalid credentials → `AuthError` banner below form (generic message, no field-level detail per F01-2)
- Network error → Toast: "Something went wrong. Please try again."
- Rate limiting → `AuthError`: "Too many attempts. Please wait a moment."

---

### `/register` — Register Page

**Purpose:** Allow new users to create an account.

**Components:**
- `AuthCard`
- `EmailInput` — with real-time format validation
- `PasswordInput` — with strength indicator bar
- `PasswordConfirmInput` — live match validation
- `SubmitButton`
- `AuthError` — Field-level inline errors (per F01-1)
- `AuthFooter` — "Already have an account? Login"

**Actions:**
- Submit → POST `/api/auth/register` → redirect `/onboarding` on success

**Empty States:** N/A

**Error States:**
- Email already exists → Inline field error: "This email is already in use"
- Password too short → Inline: "Password must be at least 8 characters"
- Passwords don't match → Inline: "Passwords do not match"
- Server error → Toast error

---

### `/onboarding` — Onboarding Survey (Multi-step)

**Purpose:** Collect user preferences to seed AI personalization. Completable in < 60 seconds.

**Components:**
- `OnboardingShell` — Full-screen centered layout with step progress bar
- `OnboardingStepIndicator` — "Step 1 of 4" with animated progress fill
- `FieldSelector` — Step 1: chip grid of profession options (Student, Developer, Designer, Freelancer, Researcher, Other)
- `DomainSelector` — Step 2: chip grid of learning domains (Frontend, Backend, AI/ML, Design, Language, Other)
- `DurationPicker` — Step 3: three preset cards (25 min / 50 min / 90 min) + custom input
- `ExtensionInstallStep` — Step 4: browser detection + install CTA + skip option
- `SkipButton` — Always visible at each step; skips remaining survey
- `ContinueButton` — Advances to next step; disabled until minimum selection made

**Actions:**
- Complete all steps → Save preferences → redirect `/dashboard`
- Skip at any step → Save partial data → redirect `/dashboard`
- Install Extension → opens Chrome Web Store in new tab; step auto-advances once extension heartbeat detected

**Empty States:** Each step has pre-selected defaults so users can click through without choosing.

**Error States:**
- Save failure → Toast: "Couldn't save preferences. You can update them in Settings."

---

### `/dashboard` — Main Dashboard

**Purpose:** Central hub. Surfaces today's performance, streaks, recent sessions, and weekly snapshot. Primary CTA is to start a session.

**Components:**
- `DashboardHeader` — Greeting ("Good evening, Minh"), today's date, streak badge
- `StartSessionButton` — Primary CTA, large, prominent. Opens `SessionConfigDrawer`
- `RecentContextCard` — Shows last session's goal (U07). One-click to reuse as next session goal.
- `StatsStrip` — Today's: Total Focus Time · Sessions · Average Score · Deep Work Count
- `DateRangeFilter` — Today / 7 Days / 30 Days / All Time (persisted to URL `?range=7d`)
- `WeeklySnapshotCard` — Delta values vs. last week + AI recommendation (collapsible)
- `FocusScoreMiniChart` — 7-day sparkline of Focus Score trend
- `StreakCounter` — Animated flame icon + consecutive day count; milestone celebration on 7/14/30 days
- `SessionHistoryList` — Paginated list of past sessions; each row: date, mode, goal, score, duration
- `SessionDetailDrawer` — Slide-in drawer with full session breakdown + AI insight
- `ExtensionInstallBanner` — Shown if extension not detected; dismissible

**Actions:**
- Click "Start Session" → opens `SessionConfigDrawer` (sheet/modal)
- Confirm config → navigate to `/session/active`
- Click session row → opens `SessionDetailDrawer`
- Click "Continue Last Goal" → pre-fills goal on `SessionConfigDrawer`
- Change date range filter → re-fetches stats
- Dismiss extension banner → marks dismissed in user preferences

**Empty States:**
- Zero sessions: Full-page empty state with illustration, headline "Your focus journey starts here", single CTA "Start Your First Session". Removes the stats strip.
- Zero sessions this week: Stats strip shows `—` values with ghost placeholders.

**Error States:**
- Data fetch failure → `ErrorCard` component per section with retry button
- Extension not found (checked via heartbeat API) → `ExtensionInstallBanner`

---

### `/session` — Pre-Session Configuration

**Purpose:** Configure a focus session before starting. Should be completable in ≤ 30 seconds (per G4).

**Components:**
- `SessionConfigShell` — Centered modal-style form on a darkened canvas. Also usable as a drawer from Dashboard.
- `ModeToggle` — Two large card buttons: "Normal Mode" and "Deep Work Mode" with descriptions
- `GoalInput` — Text area. Shown only in Deep Work Mode. Auto-focuses on mode selection.
- `GoalTemplateLibrary` — Horizontal scroll of one-click template chips: "Code Project", "Read Docs", "Complete Assignment", "Write Report", "Revision/Review" + user customs (U01). Most recent shown first.
- `DurationSelector` — Three preset cards (25 / 50 / 90 min) + custom time input
- `SmartPresetBanner` — Shown after 5+ sessions. AI-recommended config with explanation tooltip (U03).
- `TagSelector` — Multi-select chip input, max 3 tags (U02). Shown in both modes.
- `StartSessionButton` — Primary action. Disabled in Deep Work if no goal entered.

**Actions:**
- Select mode → shows/hides GoalInput
- Click template → fills GoalInput (editable)
- Click "Use Smart Preset" → fills mode + duration; user can still override
- Click "Start Session" → POST to create session → navigate to `/session/active`

**Empty States:**
- No template history: Template library shows only built-in presets
- No smart preset (< 5 sessions): SmartPresetBanner is hidden

**Error States:**
- Session creation failure → Toast: "Failed to start session. Please try again."
- Extension disconnected (Deep Work) → Warning: "Extension not detected. Deep Work AI features will be limited."

---

### `/session/active` — Active Focus Session

**Purpose:** The core interaction surface. Full-screen, immersive timer with real-time focus intelligence.

**Components:**
- `SessionAmbientCanvas` — Animated background (optional; subtle particle/geometry or ambient scene). Respects `prefers-reduced-motion`.
- `SessionGoalDisplay` — Displays the session goal (if set) in soft typography above the timer
- `FocusTimer` — Large countdown clock. Central dominant element.
  - States: Active, Paused, Auto-Paused (by distraction engine)
  - Controls: Pause/Resume (Space), End Session
- `RealtimeFocusScore` — Circular gauge or numeric display. Updates every 30–60s. Color shifts: green (focused) → amber (average) → red (distracted).
- `FocusStateLabel` — Text label: "Deep Focus" / "Focused" / "Average" / "Distracted" / "Highly Distracted"
- `SessionNotepad` — Floating panel. Toggle with `N` key. Simple text input. Saves on close.
- `MusicPlayerHUD` — Translucent bottom-center panel: ambient track selector + volume slider (U05)
- `TabCounter` — Subtle indicator of tab switches during session (for user awareness)
- `DistractionWarningOverlay` — Progressive warning layer (Warning 1, 2, 3). Full-viewport takeover.
- `AutoPauseModal` — Modal shown when timer auto-pauses after Warning 3. "Resume Session" CTA.
- `SessionEndConfirmDialog` — Confirmation before early termination: "End early?" with actual duration stats.

**Actions:**
- Press Space / Click → Pause / Resume
- Toggle Notepad → open/close floating note panel
- Select ambient track → play/pause background audio
- Adjust volume → update MusicPlayerHUD volume
- Distraction warning appears → user can dismiss (return to focus) or ignore (next warning)
- Auto-pause occurs → click "Resume Session" → timer restarts
- Click "End Session" → confirmation dialog → navigate to `/session/summary/:id`
- Timer reaches zero → auto-navigate to `/session/summary/:id`

**Empty States:** N/A (always has timer state)

**Error States:**
- Extension disconnects mid-session → Soft inline alert (does not interrupt session): "Extension disconnected — data may be incomplete"
- Score update fails → Score display shows last known value with a subtle stale indicator
- Session state sync failure → Auto-retry with exponential backoff; if persistent, toast warning

---

### `/session/summary/:id` — Session Summary

**Purpose:** Deliver a clear post-session performance report with AI observations. Drives reflection and habit loop.

**Components:**
- `SummaryHero` — Large Focus Score display with state label ("Focused — 78/100"), animation on mount
- `ScoreBreakdownChart` — Radial or bar chart showing 4 score components: Content Relevance, Focus Continuity, Tab Stability, Distraction Penalty
- `SessionMetadata` — Duration (target vs actual), mode, goal, tags
- `AIInsightPanel` — 2–4 AI-generated observations in plain language. Non-judgmental tone. Loading skeleton while insight generates.
- `SessionNoteSummary` — Shows user's session note (if written)
- `DistractionEventLog` — Count of warnings triggered, top domains visited during distraction events
- `ActionRow` — CTA buttons: "Start Another Session" (→ `/session`), "View Analytics" (→ `/analytics`), "Back to Dashboard" (→ `/dashboard`)
- `RecommendationCard` — If pattern data available: AI recommendation based on this session's behavior

**Actions:**
- Click "Start Another Session" → `/session`
- Click "View Analytics" → `/analytics`
- Click "Back to Dashboard" → `/dashboard`
- Share/Export (Post-MVP) → generate PDF summary

**Empty States:** N/A (always has session data)

**Error States:**
- AI insight generation timeout → Fallback text: "Insight is still being generated. Check back shortly." + retry button
- Summary data missing → Error card: "We couldn't load your session summary. Your data has been saved."

---

### `/study-tools` — Document Library

**Purpose:** Entry point for AI-powered study assistance. Upload and manage learning documents.

**Components:**
- `StudyToolsHeader` — Title, upload button, search input
- `DropZone` — Drag-and-drop upload area. Accepts PDF, DOCX, TXT up to 10MB.
- `UploadProgressToast` — Toast with filename + progress bar during upload
- `DocumentGrid` — Card grid of uploaded documents: filename, type, upload date, page count, available actions
- `DocumentCard` — Individual document card with: thumbnail/icon, name, quick-action buttons (Summary, Flashcards, Delete)
- `EmptyDocumentState` — Illustrated empty state with upload prompt

**Actions:**
- Drag/click upload → file validation → upload → appear in grid
- Click "Summary" on card → navigate to `/study-tools/:id` (Summary tab active)
- Click "Flashcards" on card → navigate to `/study-tools/:id` (Flashcard tab active)
- Click "Delete" → confirmation popover → delete document

**Empty States:**
- No documents: Large drop zone fills content area. Headline: "Upload a document to get started." Icon illustration.

**Error States:**
- Unsupported file type → Toast: "Only PDF, DOCX, and TXT files are supported"
- File too large → Toast: "File exceeds 10MB limit"
- Upload failure → Toast with retry option

---

### `/study-tools/:id` — Document Detail (Summary + Flashcards)

**Purpose:** View AI-generated summary or manage/generate flashcards for a specific document.

**Components:**
- `DocumentDetailHeader` — Filename, upload date, back navigation
- `DocumentTabBar` — Tabs: "Summary" | "Flashcards"
- `SummaryPanel` (Summary tab):
  - `SummaryModeToggle` — "Key Points" / "Detailed Summary"
  - `SummaryContent` — Rendered summary text (streaming-style reveal animation)
  - `RegenerateSummaryButton` — Re-generate with different mode
- `FlashcardPanel` (Flashcards tab):
  - `FlashcardGenerationConfig` — Page range selector, quantity (5/10/20/custom), difficulty (Easy/Medium/Hard)
  - `GenerateButton`
  - `FlashcardDeck` — Grid/list of generated cards with Q preview
  - `StartReviewButton` — Navigate to review mode

**Actions:**
- Switch summary mode → re-fetch summary with new mode
- Adjust flashcard config → validate → click Generate → POST request → poll for completion
- Click "Start Review" → navigate to `/study-tools/:id/review`

**Empty States:**
- No summary generated yet: Summary tab shows config + "Generate Summary" CTA
- No flashcards generated: Flashcard tab shows generation form

**Error States:**
- Summary generation failure → Error state in `SummaryPanel` with retry
- Flashcard generation timeout → Inline retry with status message

---

### `/study-tools/:id/review` — Flashcard Review

**Purpose:** Active recall practice. Sequential card review.

**Components:**
- `ReviewProgressBar` — "Card 4 of 20" with visual fill
- `FlashcardDisplay` — Large card with flip animation (Framer Motion). Front: Question. Back: Answer.
- `RevealButton` — "Tap to reveal" / keyboard: Space
- `NavigationControls` — Previous / Next card
- `ReviewCompleteCard` — Shown after last card: "X of Y cards reviewed. Well done!"
- `ExitReviewButton` — Returns to document detail

**Actions:**
- Press Space / Click card → flip to reveal answer
- Click Next → advance card (with slide animation)
- Click Previous → go back one card
- Complete deck → show `ReviewCompleteCard`
- Click Exit → navigate back to `/study-tools/:id`

**Empty States:** N/A (review only reachable if cards exist)

**Error States:**
- Card load failure → Error card with "Reload" option

---

### `/analytics` — Analytics Dashboard

**Purpose:** Deep behavioral visibility. Surface patterns, distraction sources, time-of-day insights, and weekly progress.

**Components:**
- `AnalyticsHeader` — Title, date range selector (7d / 30d / 90d / Custom), Export button
- `KPIStrip` — 4 cards: Total Focus Hours · Avg Focus Score · Total Sessions · Deep Work %
- `FocusTrendChart` — Recharts `LineChart` of daily Focus Score. Hover: exact value tooltip. Toggle: by day / by week.
- `TrendBadge` — ↑ / ↓ / → indicator next to score with percentage delta
- `DistractionSourcesTable` — Ranked table: Domain | Warnings | % of Sessions | Severity
- `DistractionFrequencyChart` — Bar chart of warning count per session over time
- `TimeHeatmap` — Hour × Day-of-week grid, color-coded by avg Focus Score. Highlights peak window.
- `SessionBreakdownPieChart` — Normal vs Deep Work mode split
- `WeeklyProgressSnapshot` — Collapsible card: this week vs last week delta + AI commentary

**Actions:**
- Change date range → re-fetch all analytics data
- Hover chart elements → detailed tooltips
- Click distraction domain → opens pre-filtered blacklist settings (link)
- Click "Export" → trigger PDF/CSV export (Post-MVP placeholder)

**Empty States:**
- < 5 sessions: Soft-lock state with progress indicator ("Complete 5 sessions to unlock full analytics")
- Time heatmap with no data: Shows greyed grid with "No data yet" overlay

**Error States:**
- Chart data fetch failure → Per-chart `ErrorCard` with retry
- Partial data (some charts loaded, some not) → Each section handles independently

---

### `/settings/profile` — Profile & Account

**Components:** `ProfileForm` (display name, email, avatar upload), `PasswordChangeForm`, `DangerZone` (delete account, export data)

**Actions:** Save changes, upload avatar, change password, request data export, delete account (two-step confirmation)

---

### `/settings/preferences` — Session Preferences

**Components:** `DefaultDurationPicker`, `DefaultModeToggle`, `GoalTemplateManager` (add/remove/reorder custom templates), `OnboardingSurveyRedo` link

**Actions:** Save preferences (debounced auto-save)

---

### `/settings/blacklist` — Blacklist Manager

**Purpose:** Define domains that trigger distraction warnings.

**Components:**
- `BlacklistSearch` — Search existing entries
- `AddDomainForm` — Domain input + severity selector (High / Medium) + Add button
- `BlacklistTable` — Domain | Severity | Added Date | Remove action
- `DefaultDomainsToggle` — Show/hide pre-populated defaults (social media, video, entertainment)
- `SyncStatusBadge` — "Synced with extension" / "Syncing..." / "Sync failed"

**Actions:**
- Add domain → validate format → POST → update table → trigger extension sync
- Remove domain → optimistic remove → DELETE request
- Change severity → inline toggle → PATCH request

**Empty States:** No custom domains: empty table with "Add your first distraction site" placeholder

**Error States:**
- Extension sync failure → `SyncStatusBadge` shows red warning + retry

---

### `/settings/notifications` — Notification Settings

**Components:** `SessionReminderToggle` + time picker, `WeeklySummaryToggle`, `DeepWorkSuggestionToggle`, `BrowserNotificationPermission` button

**Actions:** Toggle each notification type (auto-save), request browser notification permission, set reminder time

---

### `/settings/theme` — Theme Customization

**Components:** `ThemePreviewGrid` — 3 theme cards (Cyber, Minimal, Forest) with live preview, `ApplyThemeButton`, `AmbientEffectsPanel` (Rain/Snow/Stars/Leaves toggles + opacity slider)

**Actions:** Preview theme (applies temporarily), Apply theme (persists), toggle ambient effects, adjust effect opacity

---

### `/settings/extension` — Extension Status

**Components:** `ExtensionStatusCard` (connected/disconnected with last heartbeat), `InstallInstructionsAccordion`, `ReconnectButton`, `ExtensionPermissionsInfo`

**Actions:** Click Reconnect → ping extension, Click Install → Chrome Web Store

---

## 7. Component Architecture

---

### Core Components

These are foundational primitives that wrap Shadcn UI and establish the FocusOS design language.

---

#### `Button`

**Responsibility:** Unified button with FocusOS visual variants, loading state, and icon support.

**Props:**
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'session';
  size: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
  fullWidth?: boolean;
}
```

**States:** Default, Hover, Active, Disabled, Loading (spinner replaces content)

**Variants:**
- `primary` — Indigo/violet accent background, white text
- `secondary` — Transparent with border, muted text
- `ghost` — No border, muted text, hover fill
- `danger` — Red destructive actions
- `session` — Special large CTA for Start Session; animated gradient border on hover

---

#### `FocusScoreGauge`

**Responsibility:** Renders a circular animated gauge showing the Focus Score (0–100) with color coding and state label.

**Props:**
```typescript
interface FocusScoreGaugeProps {
  score: number;
  state: 'deep-focus' | 'focused' | 'average' | 'distracted' | 'highly-distracted';
  size: 'sm' | 'md' | 'lg' | 'hero';
  animated?: boolean;
  showLabel?: boolean;
  showScore?: boolean;
}
```

**States:**
- Idle (pre-session) — neutral grey ring
- Live (active session) — pulsing ring, color-coded
- Final (summary) — fills on mount with Framer Motion spring animation

**Color mapping:**
- 90–100 `deep-focus` → `#22c55e` (green)
- 75–89 `focused` → `#84cc16` (lime)
- 60–74 `average` → `#eab308` (amber)
- 40–59 `distracted` → `#f97316` (orange)
- 0–39 `highly-distracted` → `#ef4444` (red)

---

#### `FocusTimer`

**Responsibility:** Core countdown timer display with pause/resume controls.

**Props:**
```typescript
interface FocusTimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  state: 'idle' | 'active' | 'paused' | 'auto-paused';
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}
```

**States:**
- Active — digits pulse softly, progress ring fills
- Paused — digits freeze, ring dims, "Paused" label appears
- Auto-Paused — ring turns amber, pulsing warning glow

---

#### `SessionCard`

**Responsibility:** Renders a single session in the history list with key metrics.

**Props:**
```typescript
interface SessionCardProps {
  session: Session;
  onClick?: (sessionId: string) => void;
  variant: 'compact' | 'expanded';
}
```

**States:** Default, Hover, Selected (when drawer is open for this session)

**Variants:**
- `compact` — Used in dashboard list: date, goal excerpt, mode badge, score chip
- `expanded` — Used in analytics: all metadata visible

---

#### `MetricCard`

**Responsibility:** KPI card for dashboard stats strip and analytics overview.

**Props:**
```typescript
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}
```

**States:** Default, Loading (shimmer skeleton), Error (shows `—`)

---

#### `TagChip`

**Responsibility:** Renders a session tag with optional remove action.

**Props:**
```typescript
interface TagChipProps {
  label: string;
  color?: string;
  removable?: boolean;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}
```

---

#### `AuthCard`

**Responsibility:** Consistent container for all auth forms (Login, Register).

**Props:**
```typescript
interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}
```

---

### Shared Components

Reusable across multiple features and pages.

---

#### `CommandPalette`

**Responsibility:** Global `⌘K` search/command interface. Quick navigation, recent sessions, quick-start session.

**Props:** None (global, rendered once in AppLayout)

**States:** Closed, Open (full-screen overlay with input + results)

**Variants:** Navigation commands, Session actions, Shortcut hints

---

#### `ExtensionStatusIndicator`

**Responsibility:** Compact dot + tooltip showing Browser Extension connection state.

**Props:**
```typescript
interface ExtensionStatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'tracking' | 'syncing';
  lastHeartbeat?: Date;
}
```

**States:** Connected (green), Disconnected (red), Tracking (green pulsing), Syncing (yellow spinning)

---

#### `DistractionWarningOverlay`

**Responsibility:** Full-viewport distraction warning layer. Renders Warning 1, 2, 3, and Auto-Pause Modal progressively.

**Props:**
```typescript
interface DistractionWarningOverlayProps {
  warningLevel: 1 | 2 | 3 | null;
  autoPaused: boolean;
  domain?: string;
  onResume: () => void;
  onDismiss: () => void;
}
```

**States:**
- `warningLevel: 1` — Subtle banner at top. Orange border. "You've drifted from your goal."
- `warningLevel: 2` — Larger overlay, dimmed background. More prominent CTA to return.
- `warningLevel: 3` — Near-full-screen. Urgent. "Return to your work now."
- `autoPaused: true` — Full modal: "Session paused — you were away for a while." + Resume button.

---

#### `AIInsightPanel`

**Responsibility:** Renders AI-generated session insight observations with loading state.

**Props:**
```typescript
interface AIInsightPanelProps {
  insights: string[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
}
```

**States:** Loading (skeleton lines), Populated (text with subtle enter animation), Error (fallback message)

---

#### `GoalTemplateLibrary`

**Responsibility:** Horizontal scrollable chip row of goal templates for quick session start.

**Props:**
```typescript
interface GoalTemplateLibraryProps {
  templates: GoalTemplate[];
  onSelect: (template: GoalTemplate) => void;
  onAddCustom?: () => void;
  recentFirst?: boolean;
}
```

**States:** Default, Selected (chip highlights), Empty (shows "Add your first template")

---

#### `DropZone`

**Responsibility:** File upload drag-and-drop area with format validation.

**Props:**
```typescript
interface DropZoneProps {
  accept: string[];
  maxSizeMB: number;
  onUpload: (file: File) => void;
  uploading?: boolean;
  progress?: number;
}
```

**States:** Idle, Dragover (dashed border brightens, scale up), Uploading (progress bar), Error, Success

---

#### `StreakCounter`

**Responsibility:** Displays consecutive focus day streak with milestone celebration.

**Props:**
```typescript
interface StreakCounterProps {
  count: number;
  isMilestone?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

**States:** Normal (flame icon + count), Milestone (animated burst on 7/14/30 days), Broken (grey flame, count resets to 0)

---

#### `DateRangeFilter`

**Responsibility:** Period selector for filtering dashboard and analytics data.

**Props:**
```typescript
interface DateRangeFilterProps {
  value: 'today' | '7d' | '30d' | 'all';
  onChange: (value: string) => void;
}
```

---

#### `ErrorCard`

**Responsibility:** Consistent error state container used across all pages when a section fails to load.

**Props:**
```typescript
interface ErrorCardProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}
```

---

### Feature Components

Tightly coupled to specific features.

---

#### `SessionConfigDrawer`

**Responsibility:** Full session configuration UI. Used as a bottom sheet on mobile, side drawer on desktop. Contains `ModeToggle`, `GoalInput`, `GoalTemplateLibrary`, `DurationSelector`, `TagSelector`, `SmartPresetBanner`.

**Props:**
```typescript
interface SessionConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  onStart: (config: SessionConfig) => void;
  prefillGoal?: string;
  extensionConnected: boolean;
}
```

**States:** Closed, Open (Normal mode), Open (Deep Work mode), Starting (loading on submit)

---

#### `MusicPlayerHUD`

**Responsibility:** Ambient music controls during active session. Translucent floating panel.

**Props:**
```typescript
interface MusicPlayerHUDProps {
  currentTrack: AmbientTrack | null;
  tracks: AmbientTrack[];
  playing: boolean;
  volume: number;
  onTrackChange: (track: AmbientTrack) => void;
  onPlayPause: () => void;
  onVolumeChange: (volume: number) => void;
}
```

**Variants:** Collapsed (just album art + play button), Expanded (full track list + volume)

---

#### `FlashcardDisplay`

**Responsibility:** Single flashcard with flip animation.

**Props:**
```typescript
interface FlashcardDisplayProps {
  question: string;
  answer: string;
  revealed: boolean;
  onReveal: () => void;
}
```

**States:** Question face (concealed), Answer face (revealed via Framer Motion `rotateY` flip)

---

#### `BlacklistManager`

**Responsibility:** Full CRUD interface for user's domain blacklist.

**Props:**
```typescript
interface BlacklistManagerProps {
  entries: BlacklistEntry[];
  onAdd: (domain: string, severity: 'high' | 'medium') => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onChangeSeverity: (id: string, severity: 'high' | 'medium') => Promise<void>;
  syncStatus: 'synced' | 'syncing' | 'error';
}
```

---

#### `WeeklySnapshotCard`

**Responsibility:** Week-over-week comparison card for Dashboard and Analytics.

**Props:**
```typescript
interface WeeklySnapshotCardProps {
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  aiRecommendation?: string;
  loading?: boolean;
  collapsible?: boolean;
}
```

---

#### `TimeHeatmap`

**Responsibility:** Hour × Day grid showing Focus Score density.

**Props:**
```typescript
interface TimeHeatmapProps {
  data: HeatmapDataPoint[];  // { hour: number; day: number; score: number }[]
  loading?: boolean;
  highlightPeak?: boolean;
}
```

**States:** Loading (skeleton grid), Populated (color-coded cells), Insufficient data (greyed with unlock prompt)

---

### Layout Components

---

#### `SidebarRail`

**Responsibility:** The persistent 64px icon navigation rail. Always visible on desktop.

**Props:** None (reads from `useAuthStore` and `useExtensionStore`)

**States:** Default, Hovered (tooltip on each icon), Expanded (triggers `SidebarExpanded` to show)

---

#### `SidebarExpanded`

**Responsibility:** 240px labeled sidebar that slides in on rail hover. Contains labels, nested items, and user context.

**Props:**
```typescript
interface SidebarExpandedProps {
  open: boolean;
}
```

---

#### `TopBar`

**Responsibility:** Page-level header. Renders page title, optional breadcrumb, and right-aligned user actions (notifications bell, command palette trigger).

**Props:**
```typescript
interface TopBarProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
}
```

---

#### `OnboardingShell`

**Responsibility:** Full-screen centered layout with progress indicator for the onboarding flow.

**Props:**
```typescript
interface OnboardingShellProps {
  currentStep: number;
  totalSteps: number;
  onSkip: () => void;
  children: React.ReactNode;
}
```

---

#### `SessionLayout`

**Responsibility:** Full-screen immersive layout for active sessions. Hides all standard navigation chrome.

**Props:** None (wraps children, renders ambient + HUD layers)

---

## 8. State Management

FocusOS uses Zustand for all global client state. TanStack Query handles server state (API data, caching, background refresh). The two layers are deliberately separated.

---

### Auth State

**Store:** `useAuthStore`
**File:** `stores/auth.store.ts`

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingComplete: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setOnboardingComplete: () => void;
}
```

**Persistence:** Hydrated from server session on app load. No `localStorage` persistence (session-cookie based auth). `isAuthenticated` is the source of truth for route guards.

---

### User State

**Store:** `useUserStore`
**File:** `stores/user.store.ts`

```typescript
interface UserState {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  streak: number;
  streakUpdatedAt: Date | null;

  // Actions
  setProfile: (profile: UserProfile) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  incrementStreak: () => void;
}

interface UserPreferences {
  defaultMode: 'normal' | 'deep-work';
  defaultDuration: number;
  theme: 'cyber' | 'minimal' | 'forest';
  ambientEffect: AmbientEffect | null;
  notificationsEnabled: boolean;
  sessionReminderTime: string | null;
  goalTemplates: GoalTemplate[];
}
```

---

### Session State

**Store:** `useSessionStore`
**File:** `stores/session.store.ts`

This is the most critical store. It bridges the web app and the browser extension.

```typescript
interface SessionState {
  // Current session
  activeSession: ActiveSession | null;
  sessionConfig: SessionConfig | null;

  // Realtime data
  realtimeFocusScore: number | null;
  focusState: FocusStateLabel | null;
  warningLevel: 1 | 2 | 3 | null;
  isAutoPaused: boolean;
  tabSwitchCount: number;

  // Session lifecycle
  sessionStatus: 'idle' | 'configuring' | 'active' | 'paused' | 'auto-paused' | 'ending' | 'completed';

  // Note
  sessionNote: string;

  // Actions
  startSession: (config: SessionConfig) => Promise<ActiveSession>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  endSession: () => Promise<CompletedSession>;
  cancelSession: () => Promise<void>;
  updateRealtimeScore: (score: number, state: FocusStateLabel) => void;
  triggerWarning: (level: 1 | 2 | 3) => void;
  clearWarning: () => void;
  triggerAutoPause: () => void;
  setSessionNote: (note: string) => void;
}
```

**Session ↔ Extension Bridge:** When `startSession` is called, the store dispatches a `chrome.runtime.sendMessage` call to the installed extension with: `{ type: 'SESSION_START', sessionId, goal, mode, blacklist }`. Extension responds via `window.postMessage` events that update `realtimeFocusScore`, `warningLevel`, and `tabSwitchCount`.

---

### Analytics State

**Store:** `useAnalyticsStore`
**File:** `stores/analytics.store.ts`

Minimal — primarily driven by TanStack Query. Store holds filter state.

```typescript
interface AnalyticsState {
  dateRange: 'today' | '7d' | '30d' | '90d' | 'all';
  selectedTags: string[];

  // Actions
  setDateRange: (range: string) => void;
  setSelectedTags: (tags: string[]) => void;
}
```

All chart data is fetched via TanStack Query keys that include `dateRange` and `selectedTags`. Changing filter state invalidates and re-fetches relevant queries.

---

### Extension State

**Store:** `useExtensionStore`
**File:** `stores/extension.store.ts`

```typescript
interface ExtensionState {
  installed: boolean;
  connected: boolean;
  version: string | null;
  lastHeartbeat: Date | null;
  syncStatus: 'synced' | 'syncing' | 'error' | 'idle';

  // Actions
  checkHeartbeat: () => Promise<void>;
  setInstalled: (installed: boolean) => void;
  setSyncStatus: (status: ExtensionState['syncStatus']) => void;
}
```

**Heartbeat check:** Runs on app mount and every 30 seconds via a `useEffect` + `setInterval` in the root layout. Sends `chrome.runtime.sendMessage({ type: 'PING' })` and awaits response.

---

### Notification State

**Store:** `useNotificationStore`
**File:** `stores/notification.store.ts`

```typescript
interface NotificationState {
  toasts: Toast[];
  permission: NotificationPermission | null;

  // Actions
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  requestPermission: () => Promise<void>;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: ToastAction;
}
```

---

### Music State

**Store:** `useMusicStore`
**File:** `stores/music.store.ts`

```typescript
interface MusicState {
  currentTrack: AmbientTrack | null;
  playing: boolean;
  volume: number;
  customPlaylistUrl: string | null;

  // Actions
  selectTrack: (track: AmbientTrack) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setCustomPlaylist: (url: string) => void;
  stop: () => void;
}
```

Music state persists across session. Audio managed via a singleton `AudioManager` class using the Web Audio API. `stop()` is called when session ends.

---

## 9. Data Flow

### Authentication Flow

```
User submits login form
  → useAuthStore.login()
  → POST /api/auth/login
  → Django sets HttpOnly session cookie
  → Response: { user: User }
  → useAuthStore: set user, isAuthenticated = true
  → Next.js router.push('/dashboard')
  → AppLayout: reads isAuthenticated, shows sidebar
```

### Session Lifecycle Data Flow

```
User clicks "Start Session"
  → useSessionStore.startSession(config)
  → POST /api/sessions/ → { sessionId, ... }
  → Store: activeSession set, status = 'active'
  → Extension bridge: chrome.runtime.sendMessage(SESSION_START)
  → Extension begins event collection

During session (every 30–60s):
  Extension → window.postMessage({ type: 'SCORE_UPDATE', score, state })
  → useSessionStore.updateRealtimeScore()
  → FocusScoreGauge re-renders with new value

Distraction detected:
  Extension → window.postMessage({ type: 'WARNING', level: 1 })
  → useSessionStore.triggerWarning(1)
  → DistractionWarningOverlay renders Warning 1
  → (5s no response) → WARNING level 2, 3
  → (After Warning 3) → triggerAutoPause()
  → PATCH /api/sessions/:id/ { status: 'paused' }
  → Extension pauses tracking

User resumes:
  → useSessionStore.resumeSession()
  → PATCH /api/sessions/:id/ { status: 'active' }
  → Extension resumes tracking

Session ends:
  → useSessionStore.endSession()
  → POST /api/sessions/:id/end/
  → Extension: SESSION_END message
  → Store: status = 'completed'
  → AI insight generation queued (backend async)
  → Navigate to /session/summary/:id
  → TanStack Query fetches summary + polls for AI insight
```

### TanStack Query Usage

```typescript
// Dashboard stats
useQuery({
  queryKey: ['dashboard-stats', dateRange],
  queryFn: () => fetchDashboardStats(dateRange),
  staleTime: 60_000,
})

// Session history
useInfiniteQuery({
  queryKey: ['sessions', filters],
  queryFn: ({ pageParam = 1 }) => fetchSessions({ page: pageParam, ...filters }),
  getNextPageParam: (lastPage) => lastPage.nextPage,
})

// Analytics
useQuery({
  queryKey: ['analytics', 'focus-trend', dateRange],
  queryFn: () => fetchFocusTrend(dateRange),
  staleTime: 5 * 60_000,
})

// Session summary (with polling for AI insight)
useQuery({
  queryKey: ['session-summary', sessionId],
  queryFn: () => fetchSessionSummary(sessionId),
  refetchInterval: (data) => data?.aiInsight ? false : 5000, // poll until insight ready
})

// Blacklist (optimistic updates)
useMutation({
  mutationFn: addBlacklistEntry,
  onMutate: async (newEntry) => {
    await queryClient.cancelQueries({ queryKey: ['blacklist'] })
    const prev = queryClient.getQueryData(['blacklist'])
    queryClient.setQueryData(['blacklist'], (old) => [...old, { ...newEntry, id: 'temp' }])
    return { prev }
  },
  onError: (_, __, ctx) => queryClient.setQueryData(['blacklist'], ctx.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['blacklist'] }),
})
```

---

## 10. Frontend Folder Structure

```
focusos-frontend/
│
├── app/                                      # Next.js App Router
│   ├── (public)/                             # Unauthenticated routes
│   │   ├── layout.tsx
│   │   ├── page.tsx                          # Landing
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   │
│   ├── onboarding/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── domain/page.tsx
│   │   ├── duration/page.tsx
│   │   └── extension/page.tsx
│   │
│   ├── (app)/                                # Authenticated routes
│   │   ├── layout.tsx                        # AppLayout with sidebar
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   └── sessions/[sessionId]/page.tsx
│   │   ├── session/
│   │   │   ├── layout.tsx                    # Immersive session layout
│   │   │   ├── page.tsx
│   │   │   ├── active/page.tsx
│   │   │   └── summary/[sessionId]/page.tsx
│   │   ├── study-tools/
│   │   │   ├── page.tsx
│   │   │   ├── upload/page.tsx
│   │   │   └── [documentId]/
│   │   │       ├── page.tsx
│   │   │       └── review/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── settings/
│   │       ├── page.tsx                      # Redirect to /profile
│   │       ├── layout.tsx                    # Settings two-panel layout
│   │       ├── profile/page.tsx
│   │       ├── preferences/page.tsx
│   │       ├── blacklist/page.tsx
│   │       ├── notifications/page.tsx
│   │       ├── theme/page.tsx
│   │       └── extension/page.tsx
│   │
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts
│   │
│   ├── layout.tsx                            # Root HTML + providers
│   ├── not-found.tsx
│   ├── error.tsx
│   └── globals.css
│
├── components/
│   ├── core/                                 # Design system primitives
│   │   ├── button/
│   │   │   ├── Button.tsx
│   │   │   └── Button.stories.tsx
│   │   ├── focus-score-gauge/
│   │   │   └── FocusScoreGauge.tsx
│   │   ├── metric-card/
│   │   │   └── MetricCard.tsx
│   │   ├── tag-chip/
│   │   │   └── TagChip.tsx
│   │   ├── auth-card/
│   │   │   └── AuthCard.tsx
│   │   └── index.ts
│   │
│   ├── shared/                               # Cross-feature shared components
│   │   ├── command-palette/
│   │   │   └── CommandPalette.tsx
│   │   ├── extension-status/
│   │   │   └── ExtensionStatusIndicator.tsx
│   │   ├── distraction-warning/
│   │   │   └── DistractionWarningOverlay.tsx
│   │   ├── ai-insight/
│   │   │   └── AIInsightPanel.tsx
│   │   ├── goal-templates/
│   │   │   └── GoalTemplateLibrary.tsx
│   │   ├── drop-zone/
│   │   │   └── DropZone.tsx
│   │   ├── streak-counter/
│   │   │   └── StreakCounter.tsx
│   │   ├── date-range-filter/
│   │   │   └── DateRangeFilter.tsx
│   │   ├── error-card/
│   │   │   └── ErrorCard.tsx
│   │   ├── session-card/
│   │   │   └── SessionCard.tsx
│   │   └── index.ts
│   │
│   ├── features/                             # Domain-specific feature components
│   │   ├── session/
│   │   │   ├── SessionConfigDrawer.tsx
│   │   │   ├── FocusTimer.tsx
│   │   │   ├── ModeToggle.tsx
│   │   │   ├── DurationSelector.tsx
│   │   │   ├── GoalInput.tsx
│   │   │   ├── SmartPresetBanner.tsx
│   │   │   ├── TagSelector.tsx
│   │   │   ├── SessionNotepad.tsx
│   │   │   ├── SessionEndConfirmDialog.tsx
│   │   │   └── AutoPauseModal.tsx
│   │   │
│   │   ├── analytics/
│   │   │   ├── FocusTrendChart.tsx
│   │   │   ├── DistractionSourcesTable.tsx
│   │   │   ├── DistractionFrequencyChart.tsx
│   │   │   ├── TimeHeatmap.tsx
│   │   │   ├── SessionBreakdownChart.tsx
│   │   │   └── WeeklySnapshotCard.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StatsStrip.tsx
│   │   │   ├── RecentContextCard.tsx
│   │   │   ├── SessionHistoryList.tsx
│   │   │   ├── SessionDetailDrawer.tsx
│   │   │   ├── FocusScoreMiniChart.tsx
│   │   │   └── ExtensionInstallBanner.tsx
│   │   │
│   │   ├── study-tools/
│   │   │   ├── DocumentGrid.tsx
│   │   │   ├── DocumentCard.tsx
│   │   │   ├── SummaryPanel.tsx
│   │   │   ├── FlashcardGenerationConfig.tsx
│   │   │   ├── FlashcardDeck.tsx
│   │   │   ├── FlashcardDisplay.tsx
│   │   │   └── ReviewProgressBar.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── BlacklistManager.tsx
│   │   │   ├── GoalTemplateManager.tsx
│   │   │   ├── ThemePreviewGrid.tsx
│   │   │   └── AmbientEffectsPanel.tsx
│   │   │
│   │   └── music/
│   │       └── MusicPlayerHUD.tsx
│   │
│   └── layout/                               # Layout shells
│       ├── SidebarRail.tsx
│       ├── SidebarExpanded.tsx
│       ├── TopBar.tsx
│       ├── OnboardingShell.tsx
│       ├── SessionAmbientCanvas.tsx
│       ├── PublicNav.tsx
│       └── PublicFooter.tsx
│
├── stores/                                   # Zustand stores
│   ├── auth.store.ts
│   ├── user.store.ts
│   ├── session.store.ts
│   ├── analytics.store.ts
│   ├── extension.store.ts
│   ├── notification.store.ts
│   ├── music.store.ts
│   └── index.ts
│
├── hooks/                                    # Custom React hooks
│   ├── useSession.ts                         # Session lifecycle hook
│   ├── useExtensionBridge.ts                 # Chrome extension messaging
│   ├── useHeartbeat.ts                       # Extension heartbeat polling
│   ├── useFocusScore.ts                      # Realtime score subscription
│   ├── useAudioManager.ts                    # Web Audio API wrapper
│   ├── useCommandPalette.ts                  # ⌘K shortcut handler
│   ├── useKeyboardShortcuts.ts               # Global keyboard shortcuts
│   └── usePageLeaveGuard.ts                  # Prevent accidental navigation during session
│
├── lib/
│   ├── api/                                  # API client layer
│   │   ├── client.ts                         # Fetch wrapper with auth + error handling
│   │   ├── auth.api.ts
│   │   ├── sessions.api.ts
│   │   ├── analytics.api.ts
│   │   ├── documents.api.ts
│   │   ├── blacklist.api.ts
│   │   └── user.api.ts
│   │
│   ├── extension/
│   │   ├── bridge.ts                         # Extension messaging abstraction
│   │   └── types.ts                          # Shared message types
│   │
│   ├── audio/
│   │   └── AudioManager.ts                   # Singleton Web Audio API manager
│   │
│   ├── focus-score/
│   │   └── calculator.ts                     # Client-side score formula
│   │
│   └── utils/
│       ├── date.ts
│       ├── format.ts
│       └── cn.ts                             # clsx + tailwind-merge
│
├── types/                                    # Shared TypeScript types
│   ├── session.types.ts
│   ├── user.types.ts
│   ├── analytics.types.ts
│   ├── document.types.ts
│   └── extension.types.ts
│
├── constants/
│   ├── focus-score.ts                        # Score thresholds, state labels
│   ├── session.ts                            # Default durations, modes
│   ├── goal-templates.ts                     # Built-in template presets
│   └── ambient-tracks.ts                     # Built-in ambient audio list
│
├── middleware.ts                             # Auth route protection
│
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── package.json
```

---

## 11. Responsive Strategy

### Breakpoints (Tailwind defaults, extended)

```typescript
// tailwind.config.ts
screens: {
  'xs':   '375px',   // Minimum supported viewport (per NFR 7.6)
  'sm':   '640px',
  'md':   '768px',
  'lg':   '1024px',
  'xl':   '1280px',
  '2xl':  '1536px',
}
```

### Viewport Behavior by Surface

**Landing Page:** Fully responsive. Hero collapses to single-column. Feature grid: 3-col → 2-col → 1-col.

**Dashboard (≥ lg):** Sidebar rail visible. Stats strip: 4-col → 2-col → 1-col. Session history: table → card stack.

**Dashboard (< lg / tablet):** Sidebar replaced by a bottom navigation bar (icon-only). Session history becomes vertical card list.

**Dashboard (< md / mobile):** Full responsive layout. All interactive features available in view-only mode per NFR 7.6. Session start opens as a full-screen modal.

**Session (active):** Full-screen on all viewport sizes. Timer scales to fill available space with `clamp()` font sizing. HUD controls stack vertically on mobile. Note pad becomes a full-screen overlay on mobile.

**Analytics:** Charts use Recharts `ResponsiveContainer`. TimeHeatmap collapses to a scrollable horizontal view on mobile. Full analytics in view-only mode on < md.

**Settings:** Two-panel (sidebar + content) on ≥ md. On mobile: settings sidebar becomes a top-level list; each category navigates to a full-screen content view.

### Mobile-First Tailwind Classes

All components are built mobile-first: base styles target smallest viewport, responsive prefixes add complexity at larger breakpoints:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <MetricCard ... />
</div>
```

---

## 12. Accessibility Strategy

### Compliance Target

WCAG 2.1 AA — required per NFR 7.7.

### Keyboard Navigation

All interactive elements are reachable via Tab/Shift-Tab. Logical tab order enforced with DOM ordering and `tabIndex` where necessary.

**Session keyboard shortcuts:**
- `Space` — Pause / Resume timer
- `Escape` — Trigger session end confirmation
- `N` — Toggle session notepad
- `M` — Toggle music player
- `⌘K` / `Ctrl+K` — Command palette (all surfaces)

Focus trap is active in: `SessionEndConfirmDialog`, `AutoPauseModal`, `CommandPalette`, `BlacklistManager` delete confirmation.

### ARIA Implementation

- All Shadcn UI components include correct ARIA roles by default.
- `FocusTimer`: `role="timer"` with `aria-live="polite"` for screen readers.
- `DistractionWarningOverlay`: `role="alertdialog"`, `aria-modal="true"`, focus trapped.
- `FocusScoreGauge`: `aria-label="Focus Score: {score} out of 100, state: {stateLabel}"`. Color is **never** the sole indicator — always paired with text label.
- `TimeHeatmap`: Each cell has `aria-label="Tuesday 10pm: 82 focus score"`.
- All charts include `aria-label` descriptions and a `<caption>` in the underlying table representation.

### Color & Contrast

- All text meets 4.5:1 contrast ratio against backgrounds (WCAG AA).
- Focus Score states use both color AND text labels (never color alone).
- Theme system enforces contrast requirements at all three themes.

### Motion

All Framer Motion animations respect `prefers-reduced-motion`:

```typescript
// hooks/useReducedMotion.ts
const prefersReduced = useReducedMotion(); // Framer Motion built-in
const variants = prefersReduced ? staticVariants : animatedVariants;
```

Ambient visual effects (rain, snow, stars) are disabled by default and respect OS `prefers-reduced-motion` setting per U11.

### Screen Reader Support

- Page titles updated on navigation via Next.js `<title>` metadata API.
- Route changes announced via `aria-live` region in root layout.
- Session summary AI insight loaded state: `aria-live="polite"` so screen reader announces when content appears.

### Focus Management

- After `SessionConfigDrawer` opens → focus moves to first input.
- After distraction warning overlay dismisses → focus returns to timer.
- After session summary loads → focus moves to the score headline.

---

## 13. Performance Strategy

### Core Web Vitals Targets

Per NFR 7.1: Dashboard and analytics load within 2 seconds. Focus Score updates within 60 seconds.

- LCP (Largest Contentful Paint) < 2.5s
- FID (First Input Delay) / INP < 200ms
- CLS (Cumulative Layout Shift) < 0.1

### Code Splitting

Next.js App Router provides automatic route-level code splitting. Additional component-level splitting for heavy features:

```typescript
// Lazy-load analytics charts (large Recharts bundle)
const FocusTrendChart = dynamic(() => import('@/components/features/analytics/FocusTrendChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
})

// Lazy-load flashcard review (only loaded on demand)
const FlashcardDisplay = dynamic(() => import('@/components/features/study-tools/FlashcardDisplay'))
```

### Image Optimization

All images use `next/image` with explicit `width` / `height` to prevent CLS. Theme preview images are served as WebP with blur placeholder.

### TanStack Query Caching Strategy

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 min default stale time
      gcTime: 5 * 60_000,         // 5 min garbage collection
      retry: 2,
      refetchOnWindowFocus: false, // prevent refetch during focus session
    },
  },
})
```

Key query stale times:
- Dashboard stats: `staleTime: 60_000` (1 min)
- Session history: `staleTime: 30_000` (30 sec)
- Analytics charts: `staleTime: 5 * 60_000` (5 min)
- Blacklist: `staleTime: Infinity` (changes only on user action)
- User profile: `staleTime: Infinity`

Prefetching: Dashboard stats are prefetched server-side in the layout.tsx server component using `dehydrate`.

### Font Loading

System font stack for body text to eliminate FOUT. Display font (for timer, score headline) loaded with `next/font/google` using `display: 'swap'` and subset optimization.

### Animation Performance

All Framer Motion animations use `transform` and `opacity` only (GPU-composited, no layout recalculation). The `FocusScoreGauge` SVG animation uses CSS `stroke-dashoffset` transitions, not JavaScript-driven repaints.

The `SessionAmbientCanvas` for particle effects uses an offscreen `OffscreenCanvas` + Web Worker to keep the main thread free during active sessions.

### Bundle Size

Monitor with `@next/bundle-analyzer`. Recharts imported per-component (tree-shakeable). Framer Motion: use `LazyMotion + domAnimation` features subset to reduce initial bundle:

```typescript
import { LazyMotion, domAnimation, m } from 'framer-motion'

// In root layout:
<LazyMotion features={domAnimation}>
  {children}
</LazyMotion>
```

### Server Components

All data-heavy pages (Dashboard, Analytics) render the shell as React Server Components. Client interactivity (charts, filters, Zustand) is isolated to `'use client'` leaf components. This minimizes JS sent to the browser for initial render.

---

## 14. Future Scalability

### Phase 2 — Intelligent Coaching (Month 2–3)

**Pattern Detection (F06-2):**
New `PatternInsightCard` component on Dashboard and Analytics. New TanStack Query hook `usePatternInsights()`. Zustand adds `patternInsights` slice to `useAnalyticsStore`. No routing changes needed.

**Recommendation Engine (F06-3):**
`AIRecommendationBanner` added to `WeeklySnapshotCard` and `SessionSummary`. Back-end driven; frontend just renders.

**Weekly Report (F06-4):**
`WeeklyReportModal` component. PDF generation handled server-side; download link returned from API.

**Advanced Analytics (F08-2 to F08-5):**
`/analytics` page already has the grid structure to receive new chart components (`FocusTrendChart`, `TimeHeatmap`, `WeeklySnapshotCard`) — just need to wire up new API endpoints.

**Notifications (F09):**
`useNotificationStore` is already built. Add `NotificationSettings` sub-page in Settings. Browser Notification API calls added to `lib/notifications.ts`. Session reminder scheduling managed server-side.

---

### Phase 3 — Study Tools & Retention (Month 3–5)

**Study Tools (F07):**
Already fully scaffolded in routing and component architecture. Backend upload + AI endpoints need to be live.

**Focus Music (U05):**
`useMusicStore` and `MusicPlayerHUD` already exist. Add audio files/stream URLs to `constants/ambient-tracks.ts`. Web Audio API singleton in `lib/audio/AudioManager.ts` handles playback.

**Focus Streak (U08):**
`StreakCounter` component exists. Backend endpoint for streak calculation. Milestone animations via Framer Motion in `StreakCounter`.

---

### Phase 4 — Personalization & Delight (Month 5+)

**Theme Customization (U10):**
CSS variable system in `globals.css` already supports theme switching. Add 1 new theme = add 1 new CSS class block. `ThemePreviewGrid` component scales to N themes without code changes.

**Ambient Visual Effects (U11):**
`SessionAmbientCanvas` component already has a slot for effect type. Add new effect = add new canvas drawing function. `prefers-reduced-motion` guard already in place.

**Custom Playlist (U06):**
Extend `MusicPlayerHUD` with a "Custom URL" input. Embed external playlist iframe or audio element.

**Export Study Report (U09):**
New `ExportReportButton` in Analytics header. Calls API endpoint that generates PDF server-side (using existing session data). Downloads to browser.

---

### Mobile App (Deferred)

Frontend is built with React Native compatibility in mind at the component logic layer. Zustand stores, TanStack Query hooks, and API client have zero DOM/browser dependency — they are portable to React Native + Expo with UI layer replacement only.

---

### Multi-Tenancy / Teams (Deferred)

Zustand stores are per-user and scoped to session. Adding a `teamId` to API calls and creating a `useTeamStore` would be the primary work. Routing: add `(app)/team/` route group.

---

### Public API / Webhooks (Deferred)

All API calls are already abstracted behind `lib/api/*.api.ts`. Adding a developer-facing API key management page in Settings is a single new settings sub-route.

---

*Document prepared by: Frontend Architecture Review*
*Based on: FocusOS PRD v1.0 (2026-05-30)*
*Next review: After Phase 1 implementation kickoff*
