import type { ExecutionLogEntry } from "../types";

interface ExecutionLogsCardProps {
  logs: ExecutionLogEntry[];
  onClear: () => Promise<void>;
}

export function ExecutionLogsCard({ logs, onClear }: ExecutionLogsCardProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>
          <i className="fa-solid fa-clock-rotate-left" />
          Execution Logs
        </h2>
        <button className="btn btn-danger" onClick={onClear} disabled={logs.length === 0}>
          <i className="fa-solid fa-trash" />
          Clear Logs
        </button>
      </header>

      <div className="log-list">
        {logs.map((log) => (
          <details key={log.id} className="log-item">
            <summary>
              [{log.ok ? "OK" : "NG"}] {log.timestamp} {log.action} {log.unit}
            </summary>
            <pre>{log.output || "(no output)"}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}
