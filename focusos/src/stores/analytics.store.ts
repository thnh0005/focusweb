import { create } from "zustand";
import type { DateRange } from "@/types/analytics.types";

export interface AnalyticsState {
  dateRange: DateRange;
  selectedTags: string[];

  // Actions
  setDateRange: (range: DateRange) => void;
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  dateRange: "7d",
  selectedTags: [],

  setDateRange: (range) => {
    set({ dateRange: range });
  },

  setSelectedTags: (tags) => {
    set({ selectedTags: tags });
  },

  toggleTag: (tag) => {
    set((state) => {
      const isSelected = state.selectedTags.includes(tag);
      return {
        selectedTags: isSelected
          ? state.selectedTags.filter((t) => t !== tag)
          : [...state.selectedTags, tag],
      };
    });
  },

  clearFilters: () => {
    set({ dateRange: "7d", selectedTags: [] });
  },
}));
