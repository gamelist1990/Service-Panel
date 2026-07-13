import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Overview", icon: "fa-chart-line", end: true },
  { to: "/services", label: "Services", icon: "fa-layer-group", end: false },
  { to: "/editor", label: "Editor", icon: "fa-file-pen", end: false }
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Primary">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `bottom-nav-item${isActive ? " active" : ""}`}
        >
          <i className={`fa-solid ${item.icon}`} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
