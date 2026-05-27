import type { ExecutionLogEntry, ServiceView, SystemStatusResponse } from "../types";

interface OverviewPageProps {
  status: SystemStatusResponse | null;
  services: ServiceView[];
  logs: ExecutionLogEntry[];
}

export function OverviewPage({ status, services, logs }: OverviewPageProps) {
  const latest = logs.slice(0, 12);
  const runningRate = status ? status.running_rate_percent.toFixed(1) : "--";
  const stoppedRate = status ? status.stopped_rate_percent.toFixed(1) : "--";
  const totalServices = status ? status.services_total : services.length;

  return (
    <div className="content-grid two-col">
      <section className="panel">
        <header className="panel-header">
          <h2>
            <i className="fa-solid fa-shield-heart" />
            Platform Health
          </h2>
        </header>
        <div className="overview-kpis">
          <article>
            <span>Running Rate</span>
            <strong>{runningRate}%</strong>
          </article>
          <article>
            <span>Stopped Rate</span>
            <strong>{stoppedRate}%</strong>
          </article>
          <article>
            <span>Services</span>
            <strong>{totalServices}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>
            <i className="fa-solid fa-wave-square" />
            Operational Feed
          </h2>
        </header>
        <div className="timeline">
          {latest.length === 0 && <p className="empty-note">No operations yet.</p>}
          {latest.map((entry) => (
            <div className="timeline-row" key={entry.id}>
              <span className={`dot ${entry.ok ? "ok" : "ng"}`} />
              <div>
                <strong>{entry.action}</strong>
                <p>
                  {entry.unit} · {entry.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

