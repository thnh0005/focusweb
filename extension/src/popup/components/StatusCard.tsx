import type { ExtensionSnapshot } from "../../background/types";

interface StatusCardProps {
  state: string;
  snapshot: ExtensionSnapshot;
}

export function StatusCard({ state, snapshot }: StatusCardProps) {
  return (
    <section className="panel status-panel">
      <div>
        <span className="label">Status</span>
        <strong>{state}</strong>
      </div>
      <div className="metric">
        <span>{snapshot.pendingEvents}</span>
        <small>queued</small>
      </div>
    </section>
  );
}
