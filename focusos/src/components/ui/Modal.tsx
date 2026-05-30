"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnOutsideClick?: boolean;
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-full m-4 h-[calc(100vh-2rem)]",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = "md",
  closeOnOutsideClick = true,
}: ModalProps) {
  const isMounted = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => true,
    () => false
  );

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isMounted) return null;

  const modalRoot = document.body;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            onClick={closeOnOutsideClick ? onClose : undefined}
            className="absolute inset-0 bg-background/85 backdrop-blur-md"
            style={{ zIndex: -1 }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1], // --ease-reveal
            }}
            className={cn(
              "w-full glass-widget rounded-3xl overflow-hidden shadow-glass flex flex-col relative",
              sizeClasses[size],
              className
            )}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              {title ? (
                <div className="text-lg font-light tracking-tight text-text-primary">
                  {title}
                </div>
              ) : (
                <div />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full border border-transparent hover:border-white/10 hover:bg-white/5 text-text-secondary hover:text-text-primary"
                onClick={onClose}
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    modalRoot
  );
}
