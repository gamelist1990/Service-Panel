import { useMemo, useState, type FormEvent } from "react";
import type { CreationMode, Group, ServiceCreatePayload } from "../types";
import { Modal } from "./Modal";

interface AddServiceModalProps {
  open: boolean;
  groups: Group[];
  onClose: () => void;
  onSubmit: (payload: ServiceCreatePayload) => Promise<void>;
}

export function AddServiceModal({ open, groups, onClose, onSubmit }: AddServiceModalProps) {
  const [mode, setMode] = useState<CreationMode>("startup_command");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [groupId, setGroupId] = useState("");
  const [description, setDescription] = useState("");
  const [startupCommand, setStartupCommand] = useState("");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [runAsUser, setRunAsUser] = useState("");
  const [unitContent, setUnitContent] = useState("");
  const [autoEnable, setAutoEnable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const unitPlaceholder = useMemo(
    () =>
      mode === "startup_command"
        ? "Optional: app-name or app-name.service"
        : "Required: nginx.service (or nginx)",
    [mode]
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      const payload: ServiceCreatePayload = {
        name: name.trim(),
        unit: unit.trim(),
        group_id: groupId || null,
        description: description.trim() || null,
        mode,
        auto_enable: autoEnable
      };

      if (mode === "startup_command") {
        payload.startup_command = startupCommand.trim();
        payload.working_directory = workingDirectory.trim() || null;
        payload.run_as_user = runAsUser.trim() || null;
      } else {
        payload.unit_content = unitContent;
      }

      await onSubmit(payload);
      setName("");
      setUnit("");
      setGroupId("");
      setDescription("");
      setStartupCommand("");
      setWorkingDirectory("");
      setRunAsUser("");
      setUnitContent("");
      setAutoEnable(true);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Add Service" onClose={onClose}>
      <form className="stack" onSubmit={handleSubmit}>
        <div className="mode-grid">
          <label className={`mode-tile ${mode === "startup_command" ? "active" : ""}`}>
            <input
              type="radio"
              checked={mode === "startup_command"}
              onChange={() => setMode("startup_command")}
            />
            Startup Command Auto Create
          </label>
          <label className={`mode-tile ${mode === "unit_file" ? "active" : ""}`}>
            <input type="radio" checked={mode === "unit_file"} onChange={() => setMode("unit_file")} />
            Systemctl File Edit
          </label>
        </div>

        <label className="field">
          <span>Display Name</span>
          <input placeholder="api-gateway" value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="field">
          <span>Unit Name</span>
          <input placeholder={unitPlaceholder} value={unit} onChange={(event) => setUnit(event.target.value)} />
        </label>

        <label className="field">
          <span>Description</span>
          <input
            placeholder="Edge API service"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Group</span>
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">Ungrouped</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        {mode === "startup_command" && (
          <>
            <label className="field">
              <span>ExecStart Command</span>
              <input
                placeholder="/usr/bin/node /opt/app/server.js"
                value={startupCommand}
                onChange={(event) => setStartupCommand(event.target.value)}
              />
            </label>
            <label className="field">
              <span>WorkingDirectory</span>
              <input
                placeholder="/opt/app"
                value={workingDirectory}
                onChange={(event) => setWorkingDirectory(event.target.value)}
              />
            </label>
            <label className="field">
              <span>User</span>
              <input
                placeholder="ubuntu (not sudo)"
                value={runAsUser}
                onChange={(event) => setRunAsUser(event.target.value)}
              />
            </label>
            <p className="hint">
              <i className="fa-solid fa-circle-info" />
              `User=sudo` は無効です。root実行なら空欄、または実ユーザー名を指定してください。
            </p>
          </>
        )}

        {mode === "unit_file" && (
          <label className="field">
            <span>Unit File Content</span>
            <textarea
              rows={12}
              placeholder={"[Unit]\nDescription=...\n[Service]\nExecStart=...\n[Install]\nWantedBy=multi-user.target"}
              value={unitContent}
              onChange={(event) => setUnitContent(event.target.value)}
            />
          </label>
        )}

        <label className="switch">
          <input
            type="checkbox"
            checked={autoEnable}
            onChange={(event) => setAutoEnable(event.target.checked)}
          />
          Auto enable after create
        </label>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <i className="fa-solid fa-check" />
          {submitting ? "Creating..." : "Create Service"}
        </button>
      </form>
    </Modal>
  );
}
