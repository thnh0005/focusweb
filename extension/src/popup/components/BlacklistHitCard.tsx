import type { BlacklistWarning } from "../../background/types";
import { translateExtension, type ExtensionLanguage } from "../../i18n";

interface BlacklistHitCardProps {
  warning?: BlacklistWarning;
  language: ExtensionLanguage;
}

export function BlacklistHitCard({ warning, language }: BlacklistHitCardProps) {
  const severityLabel = warning
    ? translateExtension(
        language,
        warning.severity === "high"
          ? "severityHigh"
          : warning.severity === "medium"
            ? "severityMedium"
            : "severityLow"
      )
    : translateExtension(language, "clear");

  return (
    <section className={`panel warning-panel ${warning ? "visible" : ""}`}>
      <div className="section-heading">
        <span className="label">{translateExtension(language, "blacklist")}</span>
        <span className={`pill ${warning?.severity === "high" ? "danger" : "amber"}`}>
          {severityLabel}
        </span>
      </div>
      {warning ? (
        <>
          <h2>{warning.domain}</h2>
          <p className="muted">
            {translateExtension(language, "matched", { domain: warning.matchedDomain })}
          </p>
        </>
      ) : (
        <p className="muted">{translateExtension(language, "noBlacklistHit")}</p>
      )}
    </section>
  );
}
