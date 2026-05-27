import type { ExecutionLogEntry } from "../types";

interface ExecutionLogsCardProps {
  logs: ExecutionLogEntry[];
}

export function ExecutionLogsCard({ logs }: ExecutionLogsCardProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>
          <i className="fa-solid fa-clock-rotate-left" />
          Execution Logs
        </h2>
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

