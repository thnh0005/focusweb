"use client";

import * as React from "react";
import { GripHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDraggablePopup } from "@/hooks";
import { cn } from "@/lib/utils/cn";

export interface DashboardControlPopoverProps {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DashboardControlPopover({
  id,
  title,
  description,
  icon,
  children,
  onClose,
  className,
}: DashboardControlPopoverProps) {
  const { t } = useTranslation("dashboard");
  const { popupRef: panelRef, dragHandleProps, dragStyle, isDragging } =
    useDraggablePopup<HTMLElement>();
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    }, 40);

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-dashboard-floating-layer]")
      ) {
        return;
      }
      if (target instanceof Node && !panelRef.current?.contains(target)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [onClose, panelRef]);

  return (
    <aside
      ref={panelRef}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className={cn(
        "fixed inset-x-3 bottom-24 z-30 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.72)] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:bottom-28 md:left-auto md:right-6 md:w-[min(92vw,380px)]",
        isDragging && "cursor-grabbing",
        className
      )}
      style={dragStyle}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          {...dragHandleProps}
          className="flex min-w-0 flex-1 touch-none cursor-grab items-center gap-3 active:cursor-grabbing"
          title={t("focusHome.popover.drag")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            <p id={`${id}-title`} className="text-sm font-medium text-text-primary">
              {title}
            </p>
            <p id={`${id}-description`} className="text-xs text-text-muted">
              {description}
            </p>
          </div>
          <GripHorizontal
            className="ml-auto hidden h-4 w-4 shrink-0 text-text-muted sm:block"
            aria-hidden="true"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("focusHome.popover.close", { title })}
        >
          <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
        </button>
      </div>
      {children}
    </aside>
  );
}
