const ROOT_ID = "focusos-blacklist-overlay-root";
const LISTENER_FLAG = "__focusosContentScriptListenerReady";

type FocusOSContentWindow = Window & {
  [LISTENER_FLAG]?: boolean;
};

type OverlayPayload = {
  sessionId?: string;
  domain?: string;
  riskLevel?: "HIGH" | "MEDIUM" | "LOW";
  warningCount?: number;
  maxWarnings?: number;
  language?: "vi" | "en";
};

type ExtensionLanguage = "vi" | "en";
type OverlayMessageKey =
  | "deepWorkWarning"
  | "mediumTitle"
  | "stoppedTitle"
  | "dismiss"
  | "returnToFocus"
  | "highBody"
  | "stoppedBody"
  | "mediumBody"
  | "unknownSite";

const overlayMessages: Record<ExtensionLanguage, Record<OverlayMessageKey, string>> = {
  en: {
    deepWorkWarning: "Deep Work warning",
    mediumTitle: "Focus reminder",
    stoppedTitle: "Deep Work warning",
    dismiss: "Dismiss",
    returnToFocus: "Return to focus",
    highBody: "{{domain}} is blocked during Deep Work. This visit will be included in your final focus review.",
    stoppedBody: "{{domain}} stayed open after repeated warnings. This visit will be included in your final focus review.",
    mediumBody: "{{domain}} may pull you away from your current goal.",
    unknownSite: "this site",
  },
  vi: {
    deepWorkWarning: "C\u1ea3nh b\u00e1o Deep Work",
    mediumTitle: "Nh\u1eafc nh\u1edf t\u1eadp trung",
    stoppedTitle: "C\u1ea3nh b\u00e1o Deep Work",
    dismiss: "B\u1ecf qua",
    returnToFocus: "Quay l\u1ea1i t\u1eadp trung",
    highBody: "{{domain}} n\u1eb1m trong blacklist c\u1ee7a Deep Work. L\u01b0\u1ee3t truy c\u1eadp n\u00e0y s\u1ebd \u0111\u01b0\u1ee3c \u0111\u01b0a v\u00e0o \u0111\u00e1nh gi\u00e1 cu\u1ed1i phi\u00ean.",
    stoppedBody: "{{domain}} v\u1eabn m\u1edf sau nhi\u1ec1u c\u1ea3nh b\u00e1o. L\u01b0\u1ee3t truy c\u1eadp n\u00e0y s\u1ebd \u0111\u01b0\u1ee3c \u0111\u01b0a v\u00e0o \u0111\u00e1nh gi\u00e1 cu\u1ed1i phi\u00ean.",
    mediumBody: "{{domain}} c\u00f3 th\u1ec3 k\u00e9o b\u1ea1n ra kh\u1ecfi m\u1ee5c ti\u00eau hi\u1ec7n t\u1ea1i.",
    unknownSite: "trang n\u00e0y",
  },
};

function normalizeOverlayLanguage(value: unknown): ExtensionLanguage {
  return typeof value === "string" && value.toLowerCase().startsWith("en") ? "en" : "vi";
}

function translateOverlay(
  language: ExtensionLanguage | undefined,
  key: OverlayMessageKey,
  values?: Record<string, string | number>
) {
  let text = overlayMessages[language ?? "vi"][key];
  if (!values) return text;
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{{${name}}}`, String(value));
  }
  return text;
}

function postToApp(message: unknown) {
  window.postMessage(message, window.location.origin);
}

function getRoot() {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.position = "fixed";
    root.style.inset = "0 auto auto 0";
    root.style.zIndex = "2147483647";
    root.style.pointerEvents = "none";
    document.documentElement.appendChild(root);
  }
  return root;
}

function clearOverlay() {
  document.getElementById(ROOT_ID)?.remove();
}

function button(label: string, variant: "primary" | "ghost") {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.style.border = "1px solid rgba(255,255,255,.18)";
  element.style.borderRadius = "999px";
  element.style.padding = "8px 12px";
  element.style.font = "600 12px system-ui, -apple-system, Segoe UI, sans-serif";
  element.style.cursor = "pointer";
  element.style.color = variant === "primary" ? "#06110d" : "#f4f4f5";
  element.style.background = variant === "primary" ? "#a7f3d0" : "rgba(255,255,255,.08)";
  return element;
}

function renderOverlay(kind: "high" | "medium" | "stopped", payload: OverlayPayload) {
  const root = getRoot();
  const language = normalizeOverlayLanguage(payload.language);
  const domain = payload.domain || translateOverlay(language, "unknownSite");
  root.replaceChildren();

  const panel = document.createElement("section");
  panel.setAttribute("role", kind === "high" ? "alertdialog" : "status");
  panel.style.pointerEvents = "auto";
  panel.style.position = "fixed";
  panel.style.top = "24px";
  panel.style.right = "24px";
  panel.style.width = "min(380px, calc(100vw - 32px))";
  panel.style.boxSizing = "border-box";
  panel.style.padding = "18px";
  panel.style.borderRadius = "18px";
  panel.style.border = "1px solid rgba(255,255,255,.16)";
  panel.style.background = "rgba(10,13,10,.94)";
  panel.style.boxShadow = "0 24px 80px rgba(0,0,0,.45)";
  panel.style.backdropFilter = "blur(18px)";
  panel.style.color = "#f4f4f5";
  panel.style.font = "14px system-ui, -apple-system, Segoe UI, sans-serif";

  const title = document.createElement("h2");
  title.textContent =
    kind === "high"
      ? translateOverlay(language, "deepWorkWarning")
      : kind === "stopped"
        ? translateOverlay(language, "stoppedTitle")
        : translateOverlay(language, "mediumTitle");
  title.style.margin = "0 32px 8px 0";
  title.style.font = "600 16px system-ui, -apple-system, Segoe UI, sans-serif";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = translateOverlay(language, "dismiss");
  close.style.position = "absolute";
  close.style.top = "12px";
  close.style.right = "12px";
  close.style.border = "0";
  close.style.background = "transparent";
  close.style.color = "#a1a1aa";
  close.style.cursor = "pointer";
  close.style.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
  close.addEventListener("click", () => {
    clearOverlay();
    chrome.runtime.sendMessage({
      type: "BLACKLIST_OVERLAY_DISMISSED",
      payload: {
        sessionId: payload.sessionId,
        domain: payload.domain,
        riskLevel: payload.riskLevel,
        warningCount: payload.warningCount,
      },
    });
  });

  const body = document.createElement("p");
  body.style.margin = "0";
  body.style.lineHeight = "1.55";
  body.style.color = "#d4d4d8";
  if (kind === "high") {
    body.textContent = translateOverlay(language, "highBody", { domain });
  } else if (kind === "stopped") {
    body.textContent = translateOverlay(language, "stoppedBody", { domain });
  } else {
    body.textContent = translateOverlay(language, "mediumBody", { domain });
  }

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.marginTop = "14px";

  const returnButton = button(translateOverlay(language, "returnToFocus"), "primary");
  returnButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "BLACKLIST_RETURN_TO_FOCUS",
      payload: { sessionId: payload.sessionId },
    });
  });
  actions.appendChild(returnButton);
  if (kind === "high") {
    actions.appendChild(close.cloneNode(true));
    actions.lastElementChild?.addEventListener("click", () => clearOverlay());
  }

  panel.append(title, close, body, actions);
  root.appendChild(panel);
}

if (!(window as FocusOSContentWindow)[LISTENER_FLAG]) {
  (window as FocusOSContentWindow)[LISTENER_FLAG] = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message.type !== "string") return;

    if (message.type === "BLACKLIST_WARNING_OVERLAY") {
      renderOverlay("high", message.payload || {});
      return;
    }
    if (message.type === "BLACKLIST_REMINDER_OVERLAY") {
      renderOverlay("medium", message.payload || {});
      return;
    }
    if (message.type === "BLACKLIST_STOPPED_OVERLAY") {
      renderOverlay("stopped", message.payload || {});
      return;
    }
    if (message.type === "BLACKLIST_CLEAR_OVERLAY") {
      clearOverlay();
      return;
    }

    postToApp(message);
  });
}
