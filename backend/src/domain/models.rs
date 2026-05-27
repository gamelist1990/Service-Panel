use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PanelConfig {
    pub groups: Vec<Group>,
    pub services: Vec<ServiceEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServiceEntry {
    pub id: String,
    pub name: String,
    pub unit: String,
    pub group_id: Option<String>,
    pub description: Option<String>,
    pub creation_mode: String,
    pub startup_command: Option<String>,
    pub working_directory: Option<String>,
    pub run_as_user: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UrlTokenStore {
    pub tokens: Vec<UrlToken>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UrlToken {
    pub uuid: String,
    pub issued_at: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExecutionLogEntry {
    pub id: String,
    pub timestamp: String,
    pub service_id: String,
    pub unit: String,
    pub action: String,
    pub ok: bool,
    pub output: String,
}

#[derive(Debug, Deserialize)]
pub struct AuthQuery {
    pub uuid: String,
}

#[derive(Debug, Deserialize)]
pub struct GroupCreateRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ServiceCreateRequest {
    pub name: String,
    pub unit: String,
    pub group_id: Option<String>,
    pub description: Option<String>,
    pub mode: Option<String>,
    pub unit_content: Option<String>,
    pub startup_command: Option<String>,
    pub working_directory: Option<String>,
    pub run_as_user: Option<String>,
    pub auto_enable: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ServiceGroupRequest {
    pub group_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ServiceActionRequest {
    pub action: String,
}

#[derive(Debug, Deserialize)]
pub struct GroupActionRequest {
    pub action: String,
}

#[derive(Debug, Deserialize)]
pub struct UnitFileUpdateRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct JournalQuery {
    pub uuid: String,
    pub lines: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct ServiceView {
    pub id: String,
    pub name: String,
    pub unit: String,
    pub group_id: Option<String>,
    pub description: Option<String>,
    pub active_state: String,
    pub enabled_state: String,
    pub creation_mode: String,
    pub startup_command: Option<String>,
    pub working_directory: Option<String>,
    pub run_as_user: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BootstrapResponse {
    pub groups: Vec<Group>,
    pub services: Vec<ServiceView>,
    pub execution_logs: Vec<ExecutionLogEntry>,
}

#[derive(Debug, Serialize)]
pub struct ActionResponse {
    pub ok: bool,
    pub output: String,
}

#[derive(Debug, Serialize)]
pub struct GroupActionItem {
    pub service_id: String,
    pub service_name: String,
    pub unit: String,
    pub ok: bool,
    pub output: String,
}

#[derive(Debug, Serialize)]
pub struct GroupActionResponse {
    pub ok: bool,
    pub action: String,
    pub group_id: String,
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub items: Vec<GroupActionItem>,
}

#[derive(Debug, Serialize)]
pub struct UnitFileResponse {
    pub unit: String,
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct SystemStatusResponse {
    pub timestamp: String,
    pub cpu_usage_percent: f32,
    pub memory_usage_percent: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub services_total: usize,
    pub services_running: usize,
    pub services_stopped: usize,
    pub running_rate_percent: f32,
    pub stopped_rate_percent: f32,
    pub recent_success_rate_percent: f32,
    pub health_score: f32,
    pub health_label: String,
}
