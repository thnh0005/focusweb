import { STORAGE_KEYS } from "../shared/constants";
import { getStorageValue, setStorageValue } from "../shared/storage";

export type ExtensionLanguage = "vi" | "en";
export type ExtensionMessageKey =
  | "browserBridge"
  | "status"
  | "queued"
  | "checking"
  | "tracking"
  | "paused"
  | "ready"
  | "session"
  | "focusSession"
  | "noActiveSession"
  | "started"
  | "current"
  | "switches"
  | "noTrackableTab"
  | "backend"
  | "needsAttention"
  | "connectedPathReady"
  | "notSynced"
  | "lastSync"
  | "blacklist"
  | "clear"
  | "matched"
  | "noBlacklistHit"
  | "openFocusOS"
  | "deepWorkWarning"
  | "mediumTitle"
  | "stoppedTitle"
  | "dismiss"
  | "returnToFocus"
  | "highBody"
  | "stoppedBody"
  | "mediumBody"
  | "unknownSite"
  | "modeFocus"
  | "modeDeepWork"
  | "severityHigh"
  | "severityMedium"
  | "severityLow";

const messages: Record<ExtensionLanguage, Record<ExtensionMessageKey, string>> = {
  en: {
    browserBridge: "Browser bridge",
    status: "Status",
    queued: "queued",
    checking: "Checking",
    tracking: "Tracking",
    paused: "Paused",
    ready: "Ready",
    session: "Session",
    focusSession: "Focus session",
    noActiveSession: "Start a FocusOS session and this bridge will begin tracking active-tab context.",
    started: "Started",
    current: "Current",
    switches: "Switches",
    noTrackableTab: "No trackable tab",
    backend: "Backend",
    needsAttention: "Needs attention",
    connectedPathReady: "Connected path ready",
    notSynced: "Not synced yet",
    lastSync: "Last sync: {{time}}",
    blacklist: "Blacklist",
    clear: "clear",
    matched: "Matched {{domain}}",
    noBlacklistHit: "No blacklist hit in this session.",
    openFocusOS: "Open FocusOS",
    deepWorkWarning: "Deep Work warning",
    mediumTitle: "Focus reminder",
    stoppedTitle: "Deep Work paused",
    dismiss: "Dismiss",
    returnToFocus: "Return to focus",
    highBody: "{{domain}} is blocked during Deep Work. Session will stop if you continue.",
    stoppedBody: "Session stopped because {{domain}} stayed open after repeated warnings.",
    mediumBody: "{{domain}} may pull you away from your current goal.",
    unknownSite: "this site",
    modeFocus: "Focus",
    modeDeepWork: "Deep Work",
    severityHigh: "high",
    severityMedium: "medium",
    severityLow: "low"
  },
  vi: {
    browserBridge: "C\u1ea7u n\u1ed1i tr\u00ecnh duy\u1ec7t",
    status: "Tr\u1ea1ng th\u00e1i",
    queued: "\u0111ang ch\u1edd",
    checking: "\u0110ang ki\u1ec3m tra",
    tracking: "\u0110ang theo d\u00f5i",
    paused: "\u0110\u00e3 t\u1ea1m d\u1eebng",
    ready: "S\u1eb5n s\u00e0ng",
    session: "Phi\u00ean",
    focusSession: "Phi\u00ean t\u1eadp trung",
    noActiveSession: "B\u1eaft \u0111\u1ea7u m\u1ed9t phi\u00ean FocusOS v\u00e0 c\u1ea7u n\u1ed1i n\u00e0y s\u1ebd theo d\u00f5i ng\u1eef c\u1ea3nh tab \u0111ang ho\u1ea1t \u0111\u1ed9ng.",
    started: "B\u1eaft \u0111\u1ea7u",
    current: "Hi\u1ec7n t\u1ea1i",
    switches: "\u0110\u1ed5i tab",
    noTrackableTab: "Kh\u00f4ng c\u00f3 tab c\u00f3 th\u1ec3 theo d\u00f5i",
    backend: "Backend",
    needsAttention: "C\u1ea7n ch\u00fa \u00fd",
    connectedPathReady: "\u0110\u01b0\u1eddng k\u1ebft n\u1ed1i s\u1eb5n s\u00e0ng",
    notSynced: "Ch\u01b0a \u0111\u1ed3ng b\u1ed9",
    lastSync: "\u0110\u1ed3ng b\u1ed9 l\u1ea7n cu\u1ed1i: {{time}}",
    blacklist: "Blacklist",
    clear: "an to\u00e0n",
    matched: "Kh\u1edbp {{domain}}",
    noBlacklistHit: "Kh\u00f4ng c\u00f3 blacklist hit trong phi\u00ean n\u00e0y.",
    openFocusOS: "M\u1edf FocusOS",
    deepWorkWarning: "C\u1ea3nh b\u00e1o Deep Work",
    mediumTitle: "Nh\u1eafc nh\u1edf t\u1eadp trung",
    stoppedTitle: "Deep Work \u0111\u00e3 t\u1ea1m d\u1eebng",
    dismiss: "B\u1ecf qua",
    returnToFocus: "Quay l\u1ea1i t\u1eadp trung",
    highBody: "{{domain}} b\u1ecb ch\u1eb7n trong Deep Work. Phi\u00ean s\u1ebd d\u1eebng n\u1ebfu b\u1ea1n ti\u1ebfp t\u1ee5c.",
    stoppedBody: "Phi\u00ean \u0111\u00e3 d\u1eebng v\u00ec {{domain}} v\u1eabn m\u1edf sau nhi\u1ec1u c\u1ea3nh b\u00e1o.",
    mediumBody: "{{domain}} c\u00f3 th\u1ec3 k\u00e9o b\u1ea1n ra kh\u1ecfi m\u1ee5c ti\u00eau hi\u1ec7n t\u1ea1i.",
    unknownSite: "trang n\u00e0y",
    modeFocus: "T\u1eadp trung",
    modeDeepWork: "Deep Work",
    severityHigh: "cao",
    severityMedium: "trung b\u00ecnh",
    severityLow: "th\u1ea5p"
  }
};

export function normalizeExtensionLanguage(value: unknown): ExtensionLanguage {
  return typeof value === "string" && value.toLowerCase().startsWith("en") ? "en" : "vi";
}

export function translateExtension(
  language: ExtensionLanguage | undefined,
  key: ExtensionMessageKey,
  values?: Record<string, string | number>
) {
  let text = messages[language ?? "vi"][key];
  if (!values) return text;
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{{${name}}}`, String(value));
  }
  return text;
}

export async function getStoredExtensionLanguage(): Promise<ExtensionLanguage> {
  const browserLanguage = chrome.i18n?.getUILanguage?.();
  return normalizeExtensionLanguage(
    await getStorageValue<unknown>(STORAGE_KEYS.language, browserLanguage)
  );
}

export async function saveExtensionLanguage(language: ExtensionLanguage): Promise<void> {
  await setStorageValue(STORAGE_KEYS.language, language);
}
