import { useEffect, useMemo, useState } from "react";
import type { ExtensionSnapshot } from "../background/types";
import { ConnectionCard } from "./components/ConnectionCard";
import { BlacklistHitCard } from "./components/BlacklistHitCard";
import { SessionCard } from "./components/SessionCard";
import { StatusCard } from "./components/StatusCard";
import {
  getStoredExtensionLanguage,
  translateExtension,
  type ExtensionLanguage,
} from "../i18n";

const EMPTY_SNAPSHOT: ExtensionSnapshot = {
  installed: true,
  connected: false,
  version: "0.1.0",
  activeSession: null,
  pendingEvents: 0,
};

async function requestSnapshot(): Promise<ExtensionSnapshot> {
  return chrome.runtime.sendMessage({ type: "GET_STATUS" });
}

export function Popup() {
  const [snapshot, setSnapshot] = useState<ExtensionSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<ExtensionLanguage>("vi");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextSnapshot = await requestSnapshot();
        if (!cancelled && nextSnapshot) {
          setSnapshot(nextSnapshot);
          setLanguage(nextSnapshot.activeSession?.language ?? (await getStoredExtensionLanguage()));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = window.setInterval(load, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const connectionState = useMemo(() => {
    if (loading) return translateExtension(language, "checking");
    if (snapshot.activeSession?.status === "active") return translateExtension(language, "tracking");
    if (snapshot.activeSession?.status === "paused") return translateExtension(language, "paused");
    return translateExtension(language, "ready");
  }, [language, loading, snapshot.activeSession?.status]);

  function openFocusOS() {
    void chrome.tabs.create({ url: snapshot.activeSession?.appUrl ?? "http://localhost:3000" });
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <p className="eyebrow">FocusOS</p>
          <h1>{translateExtension(language, "browserBridge")}</h1>
        </div>
        <span className={`status-dot ${snapshot.activeSession ? "active" : ""}`} />
      </header>

      <StatusCard state={connectionState} snapshot={snapshot} language={language} />
      <SessionCard snapshot={snapshot} language={language} />
      <BlacklistHitCard warning={snapshot.lastWarning} language={language} />
      <ConnectionCard snapshot={snapshot} language={language} />

      <footer className="popup-footer">
        <span>v{snapshot.version}</span>
        <button type="button" onClick={openFocusOS}>
          {translateExtension(language, "openFocusOS")}
        </button>
      </footer>
    </main>
  );
}
