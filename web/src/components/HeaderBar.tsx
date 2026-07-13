import { NavLink } from "react-router-dom";

interface HeaderBarProps {
  busy: boolean;
  onOpenGroupModal: () => void;
  onOpenServiceModal: () => void;
  onRefresh: () => void;
}

export function HeaderBar({ busy, onOpenGroupModal, onOpenServiceModal, onRefresh }: HeaderBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i className="fa-solid fa-screwdriver-wrench" />
          </span>
          <div className="brand-text">
            <h1>Service Panel</h1>
            <p>systemd operation center</p>
          </div>
        </div>

        <nav className="main-nav" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <i className="fa-solid fa-chart-line" />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/services" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <i className="fa-solid fa-layer-group" />
            <span>Services</span>
          </NavLink>
          <NavLink to="/editor" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <i className="fa-solid fa-file-pen" />
            <span>Editor</span>
          </NavLink>
        </nav>

        <div className="topbar-actions">
          <button
            className="icon-btn"
            onClick={onOpenGroupModal}
            title="Add Group"
            aria-label="Add Group"
          >
            <i className="fa-solid fa-folder-plus" />
          </button>
          <button
            className="icon-btn"
            onClick={onOpenServiceModal}
            title="Add Service"
            aria-label="Add Service"
          >
            <i className="fa-solid fa-plus" />
          </button>
          <button
            className="icon-btn primary"
            onClick={onRefresh}
            disabled={busy}
            title="Refresh"
            aria-label="Refresh"
          >
            <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-rotate"}`} />
          </button>
        </div>
      </div>
    </header>
  );
}

