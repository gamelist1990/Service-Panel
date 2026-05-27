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
      <div className="brand">
        <h1>
          <i className="fa-solid fa-screwdriver-wrench" />
          Service Panel
        </h1>
        <p>systemd / systemctl operation center</p>
      </div>

      <nav className="main-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <i className="fa-solid fa-chart-line" />
          Overview
        </NavLink>
        <NavLink to="/services" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <i className="fa-solid fa-layer-group" />
          Services
        </NavLink>
        <NavLink to="/editor" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <i className="fa-solid fa-file-pen" />
          Editor
        </NavLink>
      </nav>

      <div className="topbar-actions">
        <button className="btn" onClick={onOpenGroupModal}>
          <i className="fa-solid fa-folder-plus" />
          Add Group
        </button>
        <button className="btn" onClick={onOpenServiceModal}>
          <i className="fa-solid fa-plus" />
          Add Service
        </button>
        <button className="btn btn-primary" onClick={onRefresh} disabled={busy}>
          <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-rotate"}`} />
          {busy ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </header>
  );
}

