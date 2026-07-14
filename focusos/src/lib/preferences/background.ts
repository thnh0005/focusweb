export const WORKSPACE_BACKGROUND_STORAGE_KEY = "focusos.workspace.backgroundImage";
export const WORKSPACE_THEME_APPEARANCE_STORAGE_KEY = "focusos.workspace.themeAppearance";
export const WORKSPACE_BACKGROUND_UPDATED_EVENT = "focusos:workspace-background-updated";
export const MAX_WORKSPACE_BACKGROUND_BYTES = 2.5 * 1024 * 1024;
export type WorkspaceThemeAppearance = "light" | "dark";

export function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readWorkspaceBackground() {
  if (!canUseBrowserStorage()) return "";
  return window.localStorage.getItem(WORKSPACE_BACKGROUND_STORAGE_KEY) ?? "";
}

export function saveWorkspaceBackground(dataUrl: string) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(WORKSPACE_BACKGROUND_STORAGE_KEY, dataUrl);
  window.dispatchEvent(new Event(WORKSPACE_BACKGROUND_UPDATED_EVENT));
}

export function clearWorkspaceBackground() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(WORKSPACE_BACKGROUND_STORAGE_KEY);
  window.dispatchEvent(new Event(WORKSPACE_BACKGROUND_UPDATED_EVENT));
}

export function readWorkspaceThemeAppearance(): WorkspaceThemeAppearance {
  if (!canUseBrowserStorage()) return "dark";
  const value = window.localStorage.getItem(WORKSPACE_THEME_APPEARANCE_STORAGE_KEY);
  return value === "light" ? "light" : "dark";
}

export function saveWorkspaceThemeAppearance(appearance: WorkspaceThemeAppearance) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(WORKSPACE_THEME_APPEARANCE_STORAGE_KEY, appearance);
  window.dispatchEvent(new Event(WORKSPACE_BACKGROUND_UPDATED_EVENT));
}
