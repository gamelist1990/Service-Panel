import type { SystemStatusResponse } from "../types";

interface StatusCardsProps {
  status: SystemStatusResponse | null;
}

export function StatusCards({ status }: StatusCardsProps) {
  const tone = !status
    ? "stable"
    : status.health_score >= 85
      ? "excellent"
      : status.health_score >= 70
        ? "stable"
        : status.health_score >= 50
          ? "warning"
          : "critical";

  return (
    <section className="status-grid">
      <article className="metric">
        <span className="metric-title">
          <i className="fa-solid fa-microchip" />
          CPU
        </span>
        <strong>{status ? `${status.cpu_usage_percent.toFixed(1)}%` : "--"}</strong>
      </article>

      <article className="metric">
        <span className="metric-title">
          <i className="fa-solid fa-memory" />
          Memory
        </span>
        <strong>{status ? `${status.memory_used_mb} / ${status.memory_total_mb} MB` : "--"}</strong>
        <small>{status ? `${status.memory_usage_percent.toFixed(1)}% used` : ""}</small>
      </article>

      <article className={`metric tone-${tone}`}>
        <span className="metric-title">
          <i className="fa-solid fa-heart-pulse" />
          Health
        </span>
        <strong>{status ? `${status.health_score.toFixed(1)} / 100` : "--"}</strong>
        <small>{status?.health_label ?? ""}</small>
      </article>

      <article className="metric">
        <span className="metric-title">
          <i className="fa-solid fa-server" />
          Services
        </span>
        <strong>{status ? `${status.services_running}/${status.services_total} running` : "--"}</strong>
        <small>
          {status ? `stopped ${status.services_stopped} (${status.stopped_rate_percent.toFixed(1)}%)` : ""}
        </small>
      </article>

      <article className="metric">
        <span className="metric-title">
          <i className="fa-solid fa-shield-halved" />
          Stability
        </span>
        <strong>{status ? `${status.recent_success_rate_percent.toFixed(1)}%` : "--"}</strong>
        <small>recent operation success rate</small>
      </article>

      <article className="metric">
        <span className="metric-title">
          <i className="fa-solid fa-clock" />
          Updated
        </span>
        <strong className="date">{status ? new Date(status.timestamp).toLocaleString() : "--"}</strong>
      </article>
    </section>
  );
}

