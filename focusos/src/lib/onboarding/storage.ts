import type { OnboardingData } from "@/types/user.types";

const ONBOARDING_DRAFT_KEY = "focusos.onboarding.draft";

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readOnboardingDraft(): OnboardingData {
  if (!canUseLocalStorage()) return {};

  const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as OnboardingData;
  } catch {
    return {};
  }
}

export function saveOnboardingDraft(data: OnboardingData) {
  if (!canUseLocalStorage()) return;

  window.localStorage.setItem(
    ONBOARDING_DRAFT_KEY,
    JSON.stringify({
      ...readOnboardingDraft(),
      ...data,
    })
  );
}

export function clearOnboardingDraft() {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}
