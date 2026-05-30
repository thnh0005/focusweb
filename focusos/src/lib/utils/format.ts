// ═══════════════════════════════════════════════════════════════
// Format Utilities — FocusOS
// ═══════════════════════════════════════════════════════════════

/**
 * Format seconds into MM:SS countdown display
 * e.g. 3661 → "61:01"
 */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format seconds into human-readable duration
 * e.g. 3661 → "1h 1m"
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Format minutes into concise label
 * e.g. 90 → "1h 30m", 50 → "50m"
 */
export function formatMinutes(minutes: number): string {
  return formatDuration(minutes * 60);
}

/**
 * Format a focus score to display string
 * e.g. 78.5 → "79"
 */
export function formatScore(score: number): string {
  return Math.round(score).toString();
}

/**
 * Format a percentage
 * e.g. 0.856 → "86%"
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format bytes to human-readable
 * e.g. 1048576 → "1.0 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a domain for display (remove www. prefix)
 */
export function formatDomain(domain: string): string {
  return domain.replace(/^www\./, "");
}

/**
 * Format a focus score trend delta
 * e.g. +5.2 → "+5.2 pts", -3 → "-3 pts"
 */
export function formatScoreDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${Math.round(delta)} pts`;
}

/**
 * Truncate a string to maxLength, adding ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format a number with thousands separator
 * e.g. 1234567 → "1,234,567"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Format total focus hours for analytics
 * e.g. 127 minutes → "2h 7m"
 */
export function formatFocusTime(totalMinutes: number): string {
  return formatMinutes(totalMinutes);
}

/**
 * Parse a domain from a URL
 * e.g. "https://www.youtube.com/watch?v=xyz" → "youtube.com"
 */
export function parseDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
