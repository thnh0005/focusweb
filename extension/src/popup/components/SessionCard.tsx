import type { ExtensionSnapshot } from "../../background/types";

interface SessionCardProps {
  snapshot: ExtensionSnapshot;
}

function formatStartedAt(value?: string) {
  if (!value) return "No active session";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SessionCard({ snapshot }: SessionCardProps) {
  const session = snapshot.activeSession;

  return (
    <section className="panel">
      <div className="section-heading">
        <span className="label">Session</span>
        {session && <span className="pill">{session.mode}</span>}
      </div>

      {session ? (
        <>
          <h2>{session.goal || "Focus session"}</h2>
          <dl className="details">
            <div>
              <dt>Started</dt>
              <dd>{formatStartedAt(session.startedAt)}</dd>
            </div>
            <div>
              <dt>Current</dt>
              <dd>{snapshot.currentDomain ?? "No trackable tab"}</dd>
            </div>
            <div>
              <dt>Switches</dt>
              <dd>{session.tabSwitchCount}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="muted">Start a FocusOS session and this bridge will begin tracking active-tab context.</p>
      )}
    </section>
  );
}
