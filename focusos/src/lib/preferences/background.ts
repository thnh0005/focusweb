export const WORKSPACE_BACKGROUND_STORAGE_KEY = "focusos.workspace.backgroundImage";
export const WORKSPACE_BACKGROUND_UPDATED_EVENT = "focusos:workspace-background-updated";
export const MAX_WORKSPACE_BACKGROUND_BYTES = 2.5 * 1024 * 1024;

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
