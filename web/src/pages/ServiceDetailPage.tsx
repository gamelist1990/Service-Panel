import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ServiceAction, ServiceView } from "../types";

const QUICK_ACTIONS: Array<{ action: ServiceAction; icon: string; tone: "normal" | "danger" | "primary" }> = [
  { action: "start", icon: "fa-play", tone: "primary" },
  { action: "stop", icon: "fa-stop", tone: "danger" },
  { action: "restart", icon: "fa-rotate-right", tone: "normal" },
  { action: "reload", icon: "fa-rotate", tone: "normal" },
  { action: "status", icon: "fa-circle-info", tone: "normal" },
  { action: "enable", icon: "fa-toggle-on", tone: "normal" },
  { action: "disable", icon: "fa-toggle-off", tone: "normal" }
];

interface ServiceDetailPageProps {
  services: ServiceView[];
  onServiceAction: (serviceId: string, action: ServiceAction) => Promise<void>;
  onOpenUnitEditor: (serviceId: string) => Promise<void>;
  fetchServiceJournal: (serviceId: string, lines?: number) => Promise<string>;
}

export function ServiceDetailPage({
  services,
  onServiceAction,
  onOpenUnitEditor,
  fetchServiceJournal
}: ServiceDetailPageProps) {
  const { serviceId = "" } = useParams();
  const navigate = useNavigate();
  const [journalText, setJournalText] = useState("Loading...");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [runningAction, setRunningAction] = useState<ServiceAction | null>(null);

  const service = useMemo(() => services.find((item) => item.id === serviceId) ?? null, [services, serviceId]);

  async function loadJournal() {
    if (!serviceId) {
      return;
    }
    setRefreshing(true);
    try {
      const output = await fetchServiceJournal(serviceId, 300);
      setJournalText(output);
      setUpdatedAt(new Date().toLocaleString());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!serviceId) {
      return;
    }
    void loadJournal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId || !autoRefresh) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadJournal();
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, autoRefresh]);

  if (!service) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>
            <i className="fa-solid fa-circle-exclamation" />
            Service not found
          </h2>
        </header>
        <p className="empty-note">選択されたサービスが見つかりません。</p>
        <Link to="/services" className="btn">
          <i className="fa-solid fa-arrow-left" />
          Back to Services
        </Link>
      </section>
    );
  }

  const activeOk = service.active_state.trim().toLowerCase() === "active";
  const enabledOk = service.enabled_state.trim().toLowerCase() === "enabled";

  return (
    <div className="content-grid service-detail-layout">
      <section className="panel">
        <header className="panel-header">
          <h2>
            <i className="fa-solid fa-server" />
            Service Detail: {service.name}
          </h2>
          <div className="row">
            <Link to="/services" className="btn">
              <i className="fa-solid fa-arrow-left" />
              Back
            </Link>
            <button
              className="btn"
              onClick={async () => {
                await onOpenUnitEditor(service.id);
                navigate("/editor");
              }}
            >
              <i className="fa-solid fa-pen-to-square" />
              Open Unit Editor
            </button>
          </div>
        </header>

        <div className="detail-grid">
          <article className="detail-item">
            <label>
              <i className="fa-solid fa-file-code" />
              Unit
            </label>
            <strong>{service.unit}</strong>
          </article>
          <article className="detail-item">
            <label>
              <i className="fa-solid fa-gears" />
              Mode
            </label>
            <strong>{service.creation_mode}</strong>
          </article>
          <article className="detail-item detail-item-wide">
            <label>
              <i className="fa-solid fa-terminal" />
              Command
            </label>
            <strong className="mono">{service.startup_command ?? "-"}</strong>
          </article>
          <article className="detail-item">
            <label>
              <i className="fa-solid fa-heart-pulse" />
              Active
            </label>
            <strong className={`status-pill ${activeOk ? "ok" : "ng"}`}>{service.active_state}</strong>
          </article>
          <article className="detail-item">
            <label>
              <i className="fa-solid fa-power-off" />
              Enabled
            </label>
            <strong className={`status-pill ${enabledOk ? "ok" : "ng"}`}>{service.enabled_state}</strong>
          </article>
        </div>

        <div className="action-group-title">Quick Actions</div>
        <div className="action-toolbar">
          {QUICK_ACTIONS.map((entry) => (
            <button
              key={entry.action}
              className={`btn btn-chip btn-action ${entry.tone === "danger" ? "btn-danger" : ""} ${
                entry.tone === "primary" ? "btn-primary" : ""
              }`}
              onClick={async () => {
                setRunningAction(entry.action);
                try {
                  await onServiceAction(service.id, entry.action);
                } finally {
                  setRunningAction(null);
                }
              }}
              disabled={runningAction !== null}
            >
              <i className={`fa-solid ${runningAction === entry.action ? "fa-spinner fa-spin" : entry.icon}`} />
              {entry.action}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>
            <i className="fa-solid fa-wave-square" />
            Real-time Journal
          </h2>
          <div className="row">
            <label className="switch">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              Auto refresh (2s)
            </label>
            <button className="btn" onClick={() => void loadJournal()} disabled={refreshing}>
              <i className={`fa-solid ${refreshing ? "fa-spinner fa-spin" : "fa-rotate"}`} />
              Refresh now
            </button>
          </div>
        </header>
        <p className="dim">Last updated: {updatedAt || "-"}</p>
        <pre className="journal-live">{journalText || "(no logs)"}</pre>
      </section>
    </div>
  );
}
