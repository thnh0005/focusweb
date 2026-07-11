import type { ExtensionSnapshot } from "../../background/types";

interface ConnectionCardProps {
  snapshot: ExtensionSnapshot;
}

function formatSync(value?: string) {
  if (!value) return "Not synced yet";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function ConnectionCard({ snapshot }: ConnectionCardProps) {
  return (
    <section className="panel connection-panel">
      <div>
        <span className="label">Backend</span>
        <h2>{snapshot.lastError ? "Needs attention" : "Connected path ready"}</h2>
        <p className={snapshot.lastError ? "error-text" : "muted"}>
          {snapshot.lastError ?? `Last sync: ${formatSync(snapshot.lastSyncAt)}`}
        </p>
      </div>
    </section>
  );
}
