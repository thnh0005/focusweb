import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging Tailwind CSS classes with conflict resolution.
 * Combines clsx (conditional classes) and tailwind-merge (deduplication).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
