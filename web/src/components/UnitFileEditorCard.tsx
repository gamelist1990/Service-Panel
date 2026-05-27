interface UnitFileEditorCardProps {
  serviceId: string;
  unit: string;
  path: string;
  content: string;
  onChange: (next: string) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export function UnitFileEditorCard({
  serviceId,
  unit,
  path,
  content,
  onChange,
  onSave,
  onClose
}: UnitFileEditorCardProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>
          <i className="fa-solid fa-file-pen" />
          Unit File Editor
        </h2>
      </header>

      {!serviceId ? (
        <p className="empty-note">`unit file` ボタンを押すとここに編集対象が表示されます。</p>
      ) : (
        <div className="stack">
          <p className="dim">{unit}</p>
          <p className="dim">{path}</p>
          <textarea rows={18} value={content} onChange={(event) => onChange(event.target.value)} />
          <div className="row">
            <button className="btn btn-primary" onClick={onSave}>
              <i className="fa-solid fa-floppy-disk" />
              Save + daemon-reload
            </button>
            <button className="btn" onClick={onClose}>
              <i className="fa-solid fa-xmark" />
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

