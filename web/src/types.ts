export type ToastType = "ok" | "error" | "info";

export type ServiceAction = "start" | "stop" | "restart" | "reload" | "status" | "enable" | "disable";
export type GroupAction = "start" | "stop" | "restart";
export type CreationMode = "unit_file" | "startup_command";

export interface Group {
  id: string;
  name: string;
  description: string | null;
}

export interface ServiceView {
  id: string;
  name: string;
  unit: string;
  group_id: string | null;
  description: string | null;
  active_state: string;
  enabled_state: string;
  creation_mode: string;
  startup_command: string | null;
  working_directory: string | null;
  run_as_user: string | null;
}

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  service_id: string;
  unit: string;
  action: string;
  ok: boolean;
  output: string;
}

export interface BootstrapResponse {
  groups: Group[];
  services: ServiceView[];
  execution_logs: ExecutionLogEntry[];
}

export interface ActionResponse {
  ok: boolean;
  output: string;
}

export interface GroupActionResponse {
  ok: boolean;
  action: string;
  group_id: string;
  total: number;
  success: number;
  failed: number;
  items: Array<{
    service_id: string;
    service_name: string;
    unit: string;
    ok: boolean;
    output: string;
  }>;
}

export interface UnitFileResponse {
  unit: string;
  path: string;
  content: string;
}

export interface SystemStatusResponse {
  timestamp: string;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  services_total: number;
  services_running: number;
  services_stopped: number;
  running_rate_percent: number;
  stopped_rate_percent: number;
  recent_success_rate_percent: number;
  health_score: number;
  health_label: string;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ServiceCreatePayload {
  name: string;
  unit: string;
  group_id: string | null;
  description: string | null;
  mode: CreationMode;
  auto_enable: boolean;
  unit_content?: string;
  startup_command?: string;
  working_directory?: string | null;
  run_as_user?: string | null;
}

