import { useEffect, useMemo, useState } from "react";
import type { ExtensionSnapshot } from "../background/types";
import { ConnectionCard } from "./components/ConnectionCard";
import { BlacklistHitCard } from "./components/BlacklistHitCard";
import { SessionCard } from "./components/SessionCard";
import { StatusCard } from "./components/StatusCard";

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextSnapshot = await requestSnapshot();
        if (!cancelled && nextSnapshot) {
          setSnapshot(nextSnapshot);
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
    if (loading) return "Checking";
    if (snapshot.activeSession?.status === "active") return "Tracking";
    if (snapshot.activeSession?.status === "paused") return "Paused";
    return "Ready";
  }, [loading, snapshot.activeSession?.status]);

  function openFocusOS() {
    void chrome.tabs.create({ url: snapshot.activeSession?.appUrl ?? "http://localhost:3000" });
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <p className="eyebrow">FocusOS</p>
          <h1>Browser bridge</h1>
        </div>
        <span className={`status-dot ${snapshot.activeSession ? "active" : ""}`} />
      </header>

      <StatusCard state={connectionState} snapshot={snapshot} />
      <SessionCard snapshot={snapshot} />
      <BlacklistHitCard warning={snapshot.lastWarning} />
      <ConnectionCard snapshot={snapshot} />

      <footer className="popup-footer">
        <span>v{snapshot.version}</span>
        <button type="button" onClick={openFocusOS}>
          Open FocusOS
        </button>
      </footer>
    </main>
  );
}
