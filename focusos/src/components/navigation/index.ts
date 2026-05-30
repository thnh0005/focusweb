/**
 * FocusOS Navigation System
 * ─────────────────────────────────────────────────────────────────
 * Phase 3 Navigation Architecture — production-ready components
 *
 * Hierarchy:
 *   Sidebar           Desktop icon rail (64px) + expanded panel (240px)
 *   MobileSidebar     Mobile hamburger + full-screen slide panel
 *   Topbar            Sticky header: breadcrumb · quote · actions
 *   Breadcrumb        Standalone breadcrumb nav (auto-derives from pathname)
 *   CommandPalette    ⌘K / Ctrl+K global fuzzy command search
 *   UserMenu          Account dropdown from avatar
 *   NotificationCenter  Bell popover with typed notifications
 *
 * Usage — wire all pieces together in AppLayout:
 * ```tsx
 * import {
 *   Sidebar, MobileSidebar, Topbar,
 *   CommandPalette, UserMenu, NotificationCenter
 * } from "@/components/navigation";
 * ```
 */

export { Sidebar } from "./Sidebar";
export type { SidebarProps, ExtensionStatus } from "./Sidebar";

export { MobileSidebar } from "./MobileSidebar";
export type { MobileSidebarProps } from "./MobileSidebar";

export { Topbar } from "./Topbar";
export type { TopbarProps } from "./Topbar";

export { Breadcrumb } from "./Breadcrumb";
export type { BreadcrumbProps, BreadcrumbSegment } from "./Breadcrumb";

export { CommandPalette } from "./CommandPalette";
export type { CommandPaletteProps, CommandItem } from "./CommandPalette";

export { UserMenu } from "./UserMenu";
export type { UserMenuProps } from "./UserMenu";

export { NotificationCenter } from "./NotificationCenter";
export type {
  NotificationCenterProps,
  Notification,
  NotificationType,
} from "./NotificationCenter";
