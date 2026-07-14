import type { ExtensionSnapshot } from "../../background/types";
import { translateExtension, type ExtensionLanguage } from "../../i18n";

interface StatusCardProps {
  state: string;
  snapshot: ExtensionSnapshot;
  language: ExtensionLanguage;
}

export function StatusCard({ state, snapshot, language }: StatusCardProps) {
  return (
    <section className="panel status-panel">
      <div>
        <span className="label">{translateExtension(language, "status")}</span>
        <strong>{state}</strong>
      </div>
      <div className="metric">
        <span>{snapshot.pendingEvents}</span>
        <small>{translateExtension(language, "queued")}</small>
      </div>
    </section>
  );
}
