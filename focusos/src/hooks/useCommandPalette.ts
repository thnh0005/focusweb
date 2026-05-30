"use client";

import * as React from "react";

export interface CommandItem {
  id: string;
  category: "Navigation" | "Focus Session" | "Settings" | "Audio";
  title: string;
  subtitle?: string;
  shortcut?: string[]; // e.g. ["G", "D"]
  action: () => void;
}

export function useCommandPalette(initialItems: CommandItem[]) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const toggle = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const open = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
  }, []);

  // Filter items based on title and category fuzzy matching
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return initialItems;

    const query = searchQuery.toLowerCase().trim();
    return initialItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.subtitle?.toLowerCase().includes(query)
    );
  }, [initialItems, searchQuery]);

  return {
    isOpen,
    searchQuery,
    filteredItems,
    setSearchQuery,
    toggle,
    open,
    close,
  };
}
