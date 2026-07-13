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
      <article className="metric tone-stable">
        <span className="metric-title">
          <i className="fa-solid fa-microchip" />
          CPU
        </span>
        <strong>{status ? `${status.cpu_usage_percent.toFixed(1)}%` : "--"}</strong>
        <small>{status ? "utilization" : ""}</small>
      </article>

      <article className="metric tone-stable">
        <span className="metric-title">
          <i className="fa-solid fa-memory" />
          Memory
        </span>
        <strong>{status ? `${status.memory_usage_percent.toFixed(1)}%` : "--"}</strong>
        <small>{status ? `${status.memory_used_mb} / ${status.memory_total_mb} MB` : ""}</small>
      </article>

      <article className={`metric tone-${tone}`}>
        <span className="metric-title">
          <i className="fa-solid fa-heart-pulse" />
          Health
        </span>
        <strong>{status ? `${status.health_score.toFixed(1)} / 100` : "--"}</strong>
        <small>{status?.health_label ?? ""}</small>
      </article>

      <article className="metric tone-stable">
        <span className="metric-title">
          <i className="fa-solid fa-server" />
          Services
        </span>
        <strong>{status ? `${status.services_running}/${status.services_total}` : "--"}</strong>
        <small>
          {status ? `stopped ${status.services_stopped}` : "running / total"}
        </small>
      </article>

      <article className="metric tone-stable">
        <span className="metric-title">
          <i className="fa-solid fa-shield-halved" />
          Stability
        </span>
        <strong>{status ? `${status.recent_success_rate_percent.toFixed(1)}%` : "--"}</strong>
        <small>recent success rate</small>
      </article>

      <article className="metric tone-stable">
        <span className="metric-title">
          <i className="fa-solid fa-clock" />
          Updated
        </span>
        <strong className="date" style={{ fontSize: "var(--fs-sm)", whiteSpace: "normal" }}>
          {status ? new Date(status.timestamp).toLocaleTimeString() : "--"}
        </strong>
        <small>{status ? new Date(status.timestamp).toLocaleDateString() : ""}</small>
      </article>
    </section>
  );
}

