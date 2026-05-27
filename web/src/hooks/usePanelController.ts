import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type {
  ActionResponse,
  BootstrapResponse,
  ExecutionLogEntry,
  Group,
  GroupAction,
  GroupActionResponse,
  ServiceAction,
  ServiceCreatePayload,
  ServiceView,
  SystemStatusResponse,
  ToastItem,
  ToastType,
  UnitFileResponse
} from "../types";

interface UnitEditorState {
  serviceId: string;
  unit: string;
  path: string;
  content: string;
}

export function usePanelController(uuid: string) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [services, setServices] = useState<ServiceView[]>([]);
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [journal, setJournal] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [unitEditor, setUnitEditor] = useState<UnitEditorState>({
    serviceId: "",
    unit: "",
    path: "",
    content: ""
  });

  const selectedServiceIdRef = useRef("");

  const groupedServices = useMemo(() => {
    const map = new Map<string, { id: string; name: string; services: ServiceView[] }>();
    map.set("ungrouped", { id: "ungrouped", name: "Ungrouped", services: [] });
    for (const group of groups) {
      map.set(group.id, { id: group.id, name: group.name, services: [] });
    }
    for (const service of services) {
      const key = service.group_id ?? "ungrouped";
      const current = map.get(key) ?? { id: key, name: "Unknown Group", services: [] };
      current.services.push(service);
      map.set(key, current);
    }
    return [...map.values()].filter((item) => item.services.length > 0 || item.id !== "ungrouped");
  }, [groups, services]);

  function notify(message: string, type: ToastType = "error") {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4200);
  }

  async function refreshAll() {
    if (!uuid) {
      return;
    }
    setBusy(true);
    try {
      const [data, status] = await Promise.all([
        api<BootstrapResponse>("/api/bootstrap", { uuid }),
        api<SystemStatusResponse>("/api/system/status", { uuid })
      ]);
      setGroups(data.groups ?? []);
      setServices(data.services ?? []);
      setLogs(data.execution_logs ?? []);
      setSystemStatus(status ?? null);
      if (!selectedServiceIdRef.current && data.services.length > 0) {
        setSelectedServiceId(data.services[0].id);
      }
    } catch (error) {
      notify(String((error as Error).message ?? error), "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    selectedServiceIdRef.current = selectedServiceId;
  }, [selectedServiceId]);

  useEffect(() => {
    refreshAll();
    const timer = window.setInterval(refreshAll, 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  async function addGroup(name: string) {
    await api<Group>("/api/groups", { method: "POST", uuid, body: { name } });
    notify("Group added", "ok");
    await refreshAll();
  }

  async function deleteGroup(id: string) {
    await api<null>(`/api/groups/${id}`, { method: "DELETE", uuid });
    notify("Group deleted", "ok");
    await refreshAll();
  }

  async function runGroupAction(groupId: string, action: GroupAction) {
    const result = await api<GroupActionResponse>(`/api/groups/${groupId}/action`, {
      method: "POST",
      uuid,
      body: { action }
    });
    notify(
      `Group ${action}: ${result.success}/${result.total} success${result.failed ? ` (${result.failed} failed)` : ""}`,
      result.failed > 0 ? "error" : "ok"
    );
    await refreshAll();
  }

  async function addService(payload: ServiceCreatePayload) {
    await api<ServiceView>("/api/services", { method: "POST", uuid, body: payload });
    notify("Service added", "ok");
    await refreshAll();
  }

  async function deleteService(id: string) {
    await api<null>(`/api/services/${id}`, { method: "DELETE", uuid });
    if (selectedServiceIdRef.current === id) {
      setSelectedServiceId("");
      setJournal("");
    }
    if (unitEditor.serviceId === id) {
      closeUnitEditor();
    }
    notify("Service deleted", "ok");
    await refreshAll();
  }

  async function runServiceAction(serviceId: string, action: ServiceAction) {
    const result = await api<ActionResponse>(`/api/services/${serviceId}/action`, {
      method: "POST",
      uuid,
      body: { action }
    });
    setLogs((prev) => {
      const targetUnit = services.find((service) => service.id === serviceId)?.unit ?? "";
      return [
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          service_id: serviceId,
          unit: targetUnit,
          action,
          ok: result.ok,
          output: result.output
        },
        ...prev
      ];
    });
    notify(result.ok ? `Action success: ${action}` : `Action failed: ${action}`, result.ok ? "ok" : "error");
    await refreshAll();
  }

  async function assignGroup(serviceId: string, groupId: string | null) {
    await api<null>(`/api/services/${serviceId}/group`, {
      method: "PATCH",
      uuid,
      body: { group_id: groupId }
    });
    await refreshAll();
  }

  async function openJournal(serviceId: string) {
    const output = await fetchServiceJournal(serviceId, 250);
    setJournal(output);
    setSelectedServiceId(serviceId);
  }

  async function fetchServiceJournal(serviceId: string, lines = 250) {
    const result = await api<ActionResponse>(`/api/services/${serviceId}/journal?lines=${lines}`, { uuid });
    const output = result.output || "(no logs)";
    setSelectedServiceId(serviceId);
    return output;
  }

  async function openUnitEditor(serviceId: string) {
    const data = await api<UnitFileResponse>(`/api/services/${serviceId}/unit-file`, { uuid });
    setUnitEditor({
      serviceId,
      unit: data.unit,
      path: data.path,
      content: data.content
    });
  }

  function closeUnitEditor() {
    setUnitEditor({ serviceId: "", unit: "", path: "", content: "" });
  }

  async function saveUnitEditor(content: string) {
    if (!unitEditor.serviceId) {
      return;
    }
    await api<ActionResponse>(`/api/services/${unitEditor.serviceId}/unit-file`, {
      method: "PUT",
      uuid,
      body: { content }
    });
    setUnitEditor((prev) => ({ ...prev, content }));
    notify("Unit file saved + daemon-reload", "ok");
    await refreshAll();
  }

  async function clearLogs() {
    await api<null>("/api/executions", { method: "DELETE", uuid });
    setLogs([]);
    notify("Execution logs cleared", "ok");
    await refreshAll();
  }

  return {
    busy,
    groups,
    groupedServices,
    services,
    logs,
    systemStatus,
    selectedServiceId,
    setSelectedServiceId,
    journal,
    unitEditor,
    setUnitEditor,
    toasts,
    setToasts,
    notify,
    refreshAll,
    addGroup,
    deleteGroup,
    runGroupAction,
    addService,
    deleteService,
    runServiceAction,
    assignGroup,
    openJournal,
    fetchServiceJournal,
    openUnitEditor,
    closeUnitEditor,
    saveUnitEditor,
    clearLogs
  };
}
