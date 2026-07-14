import type { ExtensionSnapshot } from "../../background/types";
import { translateExtension, type ExtensionLanguage } from "../../i18n";

interface ConnectionCardProps {
  snapshot: ExtensionSnapshot;
  language: ExtensionLanguage;
}

function formatSync(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function ConnectionCard({ snapshot, language }: ConnectionCardProps) {
  const heartbeatAt = snapshot.lastBackendHeartbeatAt ?? snapshot.lastSyncAt;
  const syncLabel = heartbeatAt
    ? translateExtension(language, "lastSync", { time: formatSync(heartbeatAt) })
    : translateExtension(language, "notSynced");
  const backendHealthy = snapshot.backendConnected !== false && !snapshot.lastError;

  return (
    <section className="panel connection-panel">
      <div>
        <span className="label">{translateExtension(language, "backend")}</span>
        <h2>
          {!backendHealthy
            ? translateExtension(language, "needsAttention")
            : translateExtension(language, "connectedPathReady")}
        </h2>
        <p className={!backendHealthy ? "error-text" : "muted"}>
          {snapshot.lastError ?? syncLabel}
        </p>
      </div>
    </section>
  );
}
