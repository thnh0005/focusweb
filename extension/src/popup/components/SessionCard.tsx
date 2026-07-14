import type { ExtensionSnapshot } from "../../background/types";
import { translateExtension, type ExtensionLanguage } from "../../i18n";

interface SessionCardProps {
  snapshot: ExtensionSnapshot;
  language: ExtensionLanguage;
}

function formatStartedAt(value?: string) {
  if (!value) return "No active session";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SessionCard({ snapshot, language }: SessionCardProps) {
  const session = snapshot.activeSession;
  const modeLabel = session?.mode === "deep-work"
    ? translateExtension(language, "modeDeepWork")
    : translateExtension(language, "modeFocus");

  return (
    <section className="panel">
      <div className="section-heading">
        <span className="label">{translateExtension(language, "session")}</span>
        {session && <span className="pill">{modeLabel}</span>}
      </div>

      {session ? (
        <>
          <h2>{session.goal || translateExtension(language, "focusSession")}</h2>
          <dl className="details">
            <div>
              <dt>{translateExtension(language, "started")}</dt>
              <dd>{formatStartedAt(session.startedAt)}</dd>
            </div>
            <div>
              <dt>{translateExtension(language, "current")}</dt>
              <dd>{snapshot.currentDomain ?? translateExtension(language, "noTrackableTab")}</dd>
            </div>
            <div>
              <dt>{translateExtension(language, "switches")}</dt>
              <dd>{session.tabSwitchCount}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="muted">{translateExtension(language, "noActiveSession")}</p>
      )}
    </section>
  );
}
