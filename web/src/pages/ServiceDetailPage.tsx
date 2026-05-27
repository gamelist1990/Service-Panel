import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ServiceAction, ServiceView } from "../types";

const QUICK_ACTIONS: ServiceAction[] = ["start", "stop", "restart", "reload", "status", "enable", "disable"];

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

  return (
    <div className="content-grid service-detail-layout">
      <section className="panel">
        <header className="panel-header">
          <h2>
            <i className="fa-solid fa-server" />
            {service.name}
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

        <div className="detail-meta">
          <p>
            <span>Unit</span> {service.unit}
          </p>
          <p>
            <span>Mode</span> {service.creation_mode}
          </p>
          <p>
            <span>Command</span> {service.startup_command ?? "-"}
          </p>
          <p>
            <span>Active</span> {service.active_state}
          </p>
          <p>
            <span>Enabled</span> {service.enabled_state}
          </p>
        </div>

        <div className="chip-actions">
          {QUICK_ACTIONS.map((action) => (
            <button key={action} className="btn btn-chip" onClick={() => onServiceAction(service.id, action)}>
              <i className="fa-solid fa-play" />
              {action}
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

