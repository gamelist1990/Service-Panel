import { ExecutionLogsCard } from "../components/ExecutionLogsCard";
import { JournalCard } from "../components/JournalCard";
import { UnitFileEditorCard } from "../components/UnitFileEditorCard";
import type { ExecutionLogEntry } from "../types";

interface EditorPageProps {
  selectedServiceId: string;
  journal: string;
  logs: ExecutionLogEntry[];
  unitEditor: {
    serviceId: string;
    unit: string;
    path: string;
    content: string;
  };
  onUnitEditorChange: (next: string) => void;
  onSaveUnitEditor: () => Promise<void>;
  onCloseUnitEditor: () => void;
  onClearLogs: () => Promise<void>;
}

export function EditorPage({
  selectedServiceId,
  journal,
  logs,
  unitEditor,
  onUnitEditorChange,
  onSaveUnitEditor,
  onCloseUnitEditor,
  onClearLogs
}: EditorPageProps) {
  return (
    <div className="content-grid split-editor">
      <div className="stack">
        <UnitFileEditorCard
          serviceId={unitEditor.serviceId}
          unit={unitEditor.unit}
          path={unitEditor.path}
          content={unitEditor.content}
          onChange={onUnitEditorChange}
          onSave={onSaveUnitEditor}
          onClose={onCloseUnitEditor}
        />
      </div>
      <div className="stack">
        <JournalCard selectedServiceId={selectedServiceId} journal={journal} />
        <ExecutionLogsCard logs={logs} onClear={onClearLogs} />
      </div>
    </div>
  );
}
