import type { BlacklistWarning } from "../../background/types";

interface BlacklistHitCardProps {
  warning?: BlacklistWarning;
}

export function BlacklistHitCard({ warning }: BlacklistHitCardProps) {
  return (
    <section className={`panel warning-panel ${warning ? "visible" : ""}`}>
      <div className="section-heading">
        <span className="label">Blacklist</span>
        <span className={`pill ${warning?.severity === "high" ? "danger" : "amber"}`}>
          {warning ? warning.severity : "clear"}
        </span>
      </div>
      {warning ? (
        <>
          <h2>{warning.domain}</h2>
          <p className="muted">Matched {warning.matchedDomain}</p>
        </>
      ) : (
        <p className="muted">No blacklist hit in this session.</p>
      )}
    </section>
  );
}
