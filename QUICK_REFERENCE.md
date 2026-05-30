# FocusOS Frontend — Quick Reference Guide

## 🚀 Getting Started

### Install & Run
```bash
cd focusos
pnpm install      # Install dependencies
pnpm dev          # Start development server
pnpm build        # Build for production
```

### Key Commands
```bash
pnpm lint         # Run ESLint
pnpm type-check   # TypeScript checking
pnpm format       # Format code
pnpm test         # Run tests
```

---

## 📁 Project Structure

### Root Directories
```
focusos/
├── src/              # Source code
├── public/           # Static assets
├── .next/            # Build output
└── node_modules/     # Dependencies
```

### Source Structure
```
src/
├── app/              # Next.js app router
│   ├── (public)/     # Public routes
│   ├── (app)/        # Protected routes
│   ├── layout.tsx    # Root layout
│   └── globals.css   # Global styles
├── components/       # React components
├── stores/          # Zustand state
├── services/        # API clients
├── lib/             # Utilities
├── types/           # TypeScript types
└── hooks/           # Custom hooks
```

---

## 🎨 Design System

### Colors
```css
/* Primary */
--focus-purple: #7C3AED;

/* Text */
--text-primary: #FAFAFA;
--text-secondary: #A1A1AA;
--text-muted: #71717A;

/* Backgrounds */
--surface-deep: #111827;
--subtle-border: #27272A;
```

### Typography
```css
/* Headings */
font-weight: 100;  /* extralight */

/* Body */
font-weight: 300;  /* light */

/* Min size: 14px */
line-height: 1.4-1.6;
```

### Spacing
```css
/* 8px grid */
gap-4;    /* 16px */
gap-6;    /* 24px */
gap-8;    /* 32px */
p-4;      /* padding: 16px */
p-6;      /* padding: 24px */
```

---

## 🧩 Component Usage

### UI Components
```tsx
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

// Usage
<Button className="bg-focus-purple">Click me</Button>
<Card className="p-6">Content</Card>
<Input placeholder="Type..." />
<CardSkeleton />
<LoadingState message="Loading..." />
<ErrorState title="Error occurred" />
```

### Feature Components
```tsx
import { StatsStrip } from "@/components/features/dashboard/StatsStrip";
import { DailySummary } from "@/components/features/dashboard/DailySummary";
import { FocusTimer } from "@/components/features/focus/FocusTimer";
import { SessionSummary } from "@/components/features/session/SessionSummary";
```

---

## 🔐 Authentication

### Auth Store Usage
```tsx
import { useAuthStore } from "@/stores/auth.store";

const { user, isAuthenticated, logout } = useAuthStore();
```

### Protected Routes
```tsx
// Automatic via (app) route group
// Routes in src/app/(app)/ require authentication
```

### Session Management
```tsx
// Login
const { login } = useAuthStore();
await login(email, password);

// Logout
const { logout } = useAuthStore();
logout();
```

---

## 📊 Data Fetching

### React Query Pattern
```tsx
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/services/analytics.api";

const { data, isLoading, error } = useQuery({
  queryKey: ["dashboard-stats"],
  queryFn: () => analyticsApi.getDashboardStats("7d"),
  staleTime: 30 * 1000,  // 30 seconds
});
```

### Loading & Error Handling
```tsx
if (isLoading) return <LoadingState />;
if (error) return <ErrorState title="Failed to load" />;
return <Content data={data} />;
```

---

## 🎨 Creating New Pages

### Page Template
```tsx
"use client";

import * as React from "react";

export default function MyPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extralight text-text-primary">
          Page Title
        </h1>
        <p className="text-text-secondary font-light">
          Subtitle
        </p>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Your content here */}
      </div>
    </div>
  );
}
```

---

## 🧪 Creating New Components

### Component Template
```tsx
import React from "react";

interface MyComponentProps {
  title: string;
  onClick?: () => void;
}

export function MyComponent({ title, onClick }: MyComponentProps) {
  return (
    <div className="space-y-4 p-6 rounded-lg border border-subtle-border">
      <h2 className="text-lg font-medium text-text-primary">
        {title}
      </h2>
      {onClick && (
        <button 
          onClick={onClick}
          className="px-4 py-2 rounded-lg bg-focus-purple hover:bg-focus-purple/90 text-white transition-colors"
        >
          Click
        </button>
      )}
    </div>
  );
}
```

---

## 🎯 State Management

### Using Zustand
```tsx
import { create } from "zustand";

interface UserStore {
  streak: number;
  fetchProfile: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
  streak: 0,
  fetchProfile: async () => {
    // Fetch and update state
    set({ streak: 7 });
  },
}));

// Usage
const { streak } = useUserStore();
```

---

## 🚦 Form Handling

### Form Pattern
```tsx
const [input, setInput] = React.useState("");
const [errors, setErrors] = React.useState<Record<string, string>>({});
const [isSaving, setIsSaving] = React.useState(false);

const handleSave = async () => {
  // Validate
  const newErrors = validate(input);
  setErrors(newErrors);
  if (Object.keys(newErrors).length > 0) return;

  // Save
  setIsSaving(true);
  try {
    await api.save(input);
  } finally {
    setIsSaving(false);
  }
};

return (
  <div>
    <input 
      value={input}
      onChange={(e) => setInput(e.target.value)}
    />
    {errors.input && <p className="text-red-400">{errors.input}</p>}
    <button onClick={handleSave} disabled={isSaving}>
      {isSaving ? "Saving..." : "Save"}
    </button>
  </div>
);
```

---

## 🎨 Styling Patterns

### Dark Theme (Default)
```tsx
<div className="bg-ambient-background text-text-primary">
  {/* Content */}
</div>
```

### Cards
```tsx
<div className="p-6 rounded-lg border border-subtle-border bg-card-container">
  {/* Content */}
</div>
```

### Buttons
```tsx
<button className="px-4 py-2 rounded-lg bg-focus-purple hover:bg-focus-purple/90 text-white transition-colors">
  Button
</button>
```

### Text Hierarchy
```tsx
<h1 className="text-3xl font-extralight text-text-primary">Heading</h1>
<p className="text-base text-text-secondary font-light">Body</p>
<span className="text-sm text-text-muted">Muted</span>
```

---

## ⌨️ Keyboard Shortcuts

### Development
```
Ctrl+Shift+P  → Open command palette
F12           → DevTools
Ctrl+K Ctrl+C → Quick comment
Ctrl+/        → Toggle comment
```

### Navigation
```
Tab           → Next element
Shift+Tab     → Previous element
Enter         → Activate button
Space         → Activate button/checkbox
Escape        → Close dialog/menu
```

---

## 🐛 Debugging

### Console Logging
```tsx
console.log("[v0] Debug message:", variable);
console.warn("[v0] Warning:", error);
console.error("[v0] Error:", exception);
```

### React DevTools
```
Install React DevTools extension
Ctrl+Shift+J → Open DevTools
Components tab → Inspect components
Profiler tab → Check performance
```

### Network Debugging
```
F12 → Network tab
See all API calls
Check request/response
Monitor performance
```

---

## 📱 Responsive Design

### Breakpoints
```
Mobile:  320px - 639px
Tablet:  640px - 1023px
Desktop: 1024px+
```

### Media Queries
```tsx
<div className="hidden md:block">
  {/* Desktop only */}
</div>

<div className="md:hidden">
  {/* Mobile only */}
</div>
```

---

## ♿ Accessibility

### ARIA Labels
```tsx
<button aria-label="Close menu">×</button>
<div role="status" aria-live="polite">Loading...</div>
```

### Form Labels
```tsx
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

### Screen Reader Text
```tsx
<span className="sr-only">Loading</span>
```

---

## 🚀 Deployment

### Build for Production
```bash
pnpm build     # Creates .next build
pnpm start     # Run production server
```

### Environment Variables
```
Create .env.local file
Required: NEXT_PUBLIC_API_URL
Optional: Various integration keys
```

### Vercel Deployment
```
1. Push to GitHub
2. Connect GitHub to Vercel
3. Deploy automatically on push
4. Set environment variables in Vercel dashboard
```

---

## 📚 Documentation

### Key Documents
- `PHASE_11_IMPLEMENTATION.md` — Settings module
- `PHASE_12_POLISH_OPTIMIZATION.md` — Quality improvements
- `PROJECT_STATUS_FINAL.md` — Complete overview
- `ACCOMPLISHMENTS.md` — What was built
- `QUICK_REFERENCE.md` — This file

---

## 🆘 Common Issues

### Build Fails
```bash
# Clear cache and rebuild
rm -rf .next node_modules
pnpm install
pnpm build
```

### Type Errors
```bash
# Run type checking
pnpm type-check

# Fix TypeScript errors
# Check error message and update types
```

### Module Not Found
```bash
# Check import paths
# Use @ alias for src/
import { Button } from "@/components/ui/Button";
```

---

## 📞 Getting Help

### Resources
- Next.js Docs: https://nextjs.org/docs
- React Docs: https://react.dev
- Tailwind CSS: https://tailwindcss.com
- TypeScript: https://www.typescriptlang.org

### Common Questions
- **How do I add a new page?** Create file in `src/app/(app)/your-page/page.tsx`
- **How do I add a new component?** Create in `src/components/` with proper structure
- **How do I fetch data?** Use React Query with API clients in `services/`
- **How do I style things?** Use Tailwind classes with design tokens

---

**Last Updated:** May 30, 2026  
**Status:** Complete ✅  
**For Questions:** See documentation files
