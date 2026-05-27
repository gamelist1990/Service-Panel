import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";

interface AddGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function AddGroupModal({ open, onClose, onSubmit }: AddGroupModalProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(name.trim());
      setName("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Add Group" onClose={onClose}>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Group Name</span>
          <input
            placeholder="api-services"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <i className="fa-solid fa-check" />
          {submitting ? "Adding..." : "Add Group"}
        </button>
      </form>
    </Modal>
  );
}
