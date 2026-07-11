export async function requestFocusFullscreen() {
  if (typeof document === "undefined") return;
  if (document.fullscreenElement) return;

  try {
    await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn("[FocusOS] Fullscreen request was blocked:", error);
  }
}
