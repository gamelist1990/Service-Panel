import type { Group, GroupAction, ServiceAction, ServiceView } from "../types";

const SERVICE_ACTIONS: Array<{ action: ServiceAction; icon: string }> = [
  { action: "start", icon: "fa-play" },
  { action: "stop", icon: "fa-stop" },
  { action: "restart", icon: "fa-rotate-right" },
  { action: "reload", icon: "fa-rotate" },
  { action: "status", icon: "fa-circle-info" },
  { action: "enable", icon: "fa-toggle-on" },
  { action: "disable", icon: "fa-toggle-off" }
];

interface GroupedServices {
  id: string;
  name: string;
  services: ServiceView[];
}

interface ServiceGroupBoardProps {
  groups: Group[];
  groupedServices: GroupedServices[];
  onDeleteGroup: (id: string) => Promise<void>;
  onGroupAction: (groupId: string, action: GroupAction) => Promise<void>;
  onAssignGroup: (serviceId: string, groupId: string | null) => Promise<void>;
  onServiceAction: (serviceId: string, action: ServiceAction) => Promise<void>;
  onOpenJournal: (serviceId: string) => Promise<void>;
  onOpenUnitEditor: (serviceId: string) => Promise<void>;
  onDeleteService: (serviceId: string) => Promise<void>;
}

export function ServiceGroupBoard({
  groups,
  groupedServices,
  onDeleteGroup,
  onGroupAction,
  onAssignGroup,
  onServiceAction,
  onOpenJournal,
  onOpenUnitEditor,
  onDeleteService
}: ServiceGroupBoardProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>
          <i className="fa-solid fa-layer-group" />
          Services By Group
        </h2>
      </header>

      {groupedServices.length === 0 && <p className="empty-note">No services yet. Add one from the header.</p>}

      <div className="group-list">
        {groupedServices.map((group) => (
          <article key={group.id} className="group-block">
            <header className="group-header">
              <h3>{group.name}</h3>
              <div className="group-controls">
                <button className="btn" onClick={() => onGroupAction(group.id, "start")}>
                  <i className="fa-solid fa-play" />
                  Start All
                </button>
                <button className="btn" onClick={() => onGroupAction(group.id, "stop")}>
                  <i className="fa-solid fa-stop" />
                  Stop All
                </button>
                <button className="btn" onClick={() => onGroupAction(group.id, "restart")}>
                  <i className="fa-solid fa-rotate-right" />
                  Restart All
                </button>
                {group.id !== "ungrouped" && (
                  <button className="btn btn-danger" onClick={() => onDeleteGroup(group.id)}>
                    <i className="fa-solid fa-trash" />
                    Delete Group
                  </button>
                )}
              </div>
            </header>

            <div className="service-grid">
              {group.services.map((service) => (
                <article className="service-card" key={service.id}>
                  <div className="service-meta">
                    <strong>{service.name}</strong>
                    <p>{service.unit}</p>
                    <p>mode: {service.creation_mode}</p>
                    {service.startup_command && <p>cmd: {service.startup_command}</p>}
                    <p>
                      active: <span>{service.active_state}</span> / enabled: <span>{service.enabled_state}</span>
                    </p>
                  </div>

                  <div className="service-actions">
                    <select
                      value={service.group_id ?? ""}
                      onChange={(event) => onAssignGroup(service.id, event.target.value || null)}
                    >
                      <option value="">Ungrouped</option>
                      {groups.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <div className="chip-actions">
                      {SERVICE_ACTIONS.map((entry) => (
                        <button key={entry.action} className="btn btn-chip" onClick={() => onServiceAction(service.id, entry.action)}>
                          <i className={`fa-solid ${entry.icon}`} />
                          {entry.action}
                        </button>
                      ))}
                      <button className="btn btn-chip" onClick={() => onOpenJournal(service.id)}>
                        <i className="fa-solid fa-scroll" />
                        journal
                      </button>
                      <button className="btn btn-chip" onClick={() => onOpenUnitEditor(service.id)}>
                        <i className="fa-solid fa-pen-to-square" />
                        unit file
                      </button>
                      <button className="btn btn-chip btn-danger" onClick={() => onDeleteService(service.id)}>
                        <i className="fa-solid fa-trash" />
                        delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

