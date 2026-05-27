import { ServiceGroupBoard } from "../components/ServiceGroupBoard";
import type { Group, GroupAction, ServiceAction, ServiceView } from "../types";

interface GroupedServices {
  id: string;
  name: string;
  services: ServiceView[];
}

interface ServicesPageProps {
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

export function ServicesPage({
  groups,
  groupedServices,
  onDeleteGroup,
  onGroupAction,
  onAssignGroup,
  onServiceAction,
  onOpenJournal,
  onOpenUnitEditor,
  onDeleteService
}: ServicesPageProps) {
  return (
    <div className="content-grid">
      <ServiceGroupBoard
        groups={groups}
        groupedServices={groupedServices}
        onDeleteGroup={onDeleteGroup}
        onGroupAction={onGroupAction}
        onAssignGroup={onAssignGroup}
        onServiceAction={onServiceAction}
        onOpenJournal={onOpenJournal}
        onOpenUnitEditor={onOpenUnitEditor}
        onDeleteService={onDeleteService}
      />
    </div>
  );
}

