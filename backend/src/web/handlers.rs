use axum::{
    extract::{Path as AxumPath, Query, State},
    http::{header, HeaderValue, StatusCode},
    response::{Html, Response},
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::Utc;
use rust_embed::RustEmbed;
use sysinfo::System;
use uuid::Uuid;

use crate::{
    domain::models::{
        ActionResponse, AuthQuery, BootstrapResponse, ExecutionLogEntry, Group, GroupActionItem,
        GroupActionRequest, GroupActionResponse, GroupCreateRequest, JournalQuery,
        ServiceActionRequest, ServiceCreateRequest, ServiceEntry, ServiceGroupRequest, ServiceView,
        SystemStatusResponse, UnitFileResponse, UnitFileUpdateRequest,
    },
    error::AppError,
    infra::systemd::{
        build_generated_unit_content, ensure_script_executable, normalize_startup_command,
        normalize_unit_name, read_journal, run_quiet_systemctl, run_systemctl_action,
        run_systemctl_args, slugify_for_unit, write_unit_file_and_reload,
    },
    state::AppState,
};

#[derive(RustEmbed)]
#[folder = "../web/dist/"]
struct WebDist;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/request", get(request_page))
        .route("/assets/*path", get(serve_embedded_asset))
        .route("/api/bootstrap", get(api_bootstrap))
        .route("/api/system/status", get(api_system_status))
        .route("/api/groups", post(api_create_group))
        .route("/api/groups/:id", delete(api_delete_group))
        .route("/api/groups/:id/action", post(api_group_action))
        .route("/api/services", get(api_services).post(api_create_service))
        .route("/api/services/:id", delete(api_delete_service))
        .route("/api/services/:id/group", patch(api_update_service_group))
        .route("/api/services/:id/action", post(api_service_action))
        .route("/api/services/:id/journal", get(api_service_journal))
        .route(
            "/api/services/:id/unit-file",
            get(api_get_service_unit_file).put(api_update_service_unit_file),
        )
        .route(
            "/api/executions",
            get(api_executions).delete(api_clear_executions),
        )
        .with_state(state)
}

pub async fn request_page(
    State(state): State<AppState>,
    Query(auth): Query<AuthQuery>,
) -> Result<Html<String>, AppError> {
    ensure_access(&state, &auth.uuid).await?;

    let Some(index_file) = WebDist::get("index.html") else {
        return Ok(Html(format!(
            "<html><body><h2>Embedded web build not found</h2><p>Build backend with web dist available.</p><p>UUID: {}</p></body></html>",
            auth.uuid
        )));
    };

    let raw = String::from_utf8_lossy(index_file.data.as_ref()).to_string();
    let injected = raw.replace(
        "</head>",
        &format!(
            "<script>window.__ACCESS_UUID__='{}';</script></head>",
            auth.uuid
        ),
    );
    Ok(Html(injected))
}

pub async fn serve_embedded_asset(AxumPath(path): AxumPath<String>) -> Result<Response, AppError> {
    let embedded_path = format!("assets/{}", path);
    let Some(file) = WebDist::get(&embedded_path) else {
        return Err(AppError::not_found("asset not found"));
    };

    let mime = mime_guess::from_path(&embedded_path).first_or_octet_stream();
    let mut response = Response::new(file.data.into_owned().into());
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime.as_ref())
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    Ok(response)
}

pub async fn api_bootstrap(
    State(state): State<AppState>,
    Query(auth): Query<AuthQuery>,
) -> Result<Json<BootstrapResponse>, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    let config = state.storage.load_config().await?;
    let services = hydrate_services(config.services).await;
    let logs = state.storage.read_execution_logs(200).await?;

    Ok(Json(BootstrapResponse {
        groups: config.groups,
        services,
        execution_logs: logs,
    }))
}

pub async fn api_system_status(
    State(state): State<AppState>,
    Query(auth): Query<AuthQuery>,
) -> Result<Json<SystemStatusResponse>, AppError> {
    ensure_access(&state, &auth.uuid).await?;

    let mut sys = System::new();
    sys.refresh_cpu_usage();
    tokio::time::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL).await;
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = if sys.cpus().is_empty() {
        0.0
    } else {
        sys.cpus().iter().map(|cpu| cpu.cpu_usage()).sum::<f32>() / sys.cpus().len() as f32
    };

    let mem_total = sys.total_memory();
    let mem_used = sys.used_memory();
    let mem_usage_percent = if mem_total == 0 {
        0.0
    } else {
        (mem_used as f64 / mem_total as f64 * 100.0) as f32
    };

    let cfg = state.storage.load_config().await?;
    let mut running = 0usize;
    let mut stopped = 0usize;
    for svc in &cfg.services {
        let unit = canonicalize_unit_name(&svc.unit);
        let active = run_quiet_systemctl("is-active", &unit).await;
        if active.trim() == "active" {
            running += 1;
        } else {
            stopped += 1;
        }
    }
    let total = cfg.services.len();
    let running_rate = if total == 0 {
        100.0
    } else {
        (running as f64 / total as f64 * 100.0) as f32
    };
    let stopped_rate = if total == 0 {
        0.0
    } else {
        100.0 - running_rate
    };

    let recent_logs = state.storage.read_execution_logs(80).await?;
    let recent_total = recent_logs.len();
    let recent_ok = recent_logs.iter().filter(|x| x.ok).count();
    let recent_success = if recent_total == 0 {
        100.0
    } else {
        (recent_ok as f64 / recent_total as f64 * 100.0) as f32
    };

    let health_score = ((running_rate * 0.6) + (recent_success * 0.4)).clamp(0.0, 100.0);
    let health_label = if health_score >= 85.0 {
        "Excellent"
    } else if health_score >= 70.0 {
        "Stable"
    } else if health_score >= 50.0 {
        "Warning"
    } else {
        "Critical"
    };

    Ok(Json(SystemStatusResponse {
        timestamp: Utc::now().to_rfc3339(),
        cpu_usage_percent: cpu_usage,
        memory_usage_percent: mem_usage_percent,
        memory_used_mb: mem_used / 1024 / 1024,
        memory_total_mb: mem_total / 1024 / 1024,
        services_total: total,
        services_running: running,
        services_stopped: stopped,
        running_rate_percent: running_rate,
        stopped_rate_percent: stopped_rate,
        recent_success_rate_percent: recent_success,
        health_score,
        health_label: health_label.to_string(),
    }))
}

pub async fn api_services(
    State(state): State<AppState>,
    Query(auth): Query<AuthQuery>,
) -> Result<Json<Vec<ServiceView>>, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    let config = state.storage.load_config().await?;
    Ok(Json(hydrate_services(config.services).await))
}

pub async fn api_create_group(
    State(state): State<AppState>,
    Query(auth): Query<AuthQuery>,
    Json(req): Json<GroupCreateRequest>,
) -> Result<Json<Group>, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    if req.name.trim().is_empty() {
        return Err(AppError::bad_request("group name is required"));
    }

    let group = Group {
        id: Uuid::new_v4().to_string(),
        name: req.name.trim().to_string(),
        description: req.description.map(|s| s.trim().to_string()),
    };

    let mut cfg = state.storage.load_config().await?;
    cfg.groups.push(group.clone());
    state.storage.save_config(&cfg).await?;
    Ok(Json(group))
}

pub async fn api_delete_group(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Query(auth): Query<AuthQuery>,
) -> Result<StatusCode, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    let mut cfg = state.storage.load_config().await?;
    cfg.groups.retain(|g| g.id != id);
    for svc in &mut cfg.services {
        if svc.group_id.as_deref() == Some(id.as_str()) {
            svc.group_id = None;
        }
    }
    state.storage.save_config(&cfg).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn api_group_action(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Query(auth): Query<AuthQuery>,
    Json(req): Json<GroupActionRequest>,
) -> Result<Json<GroupActionResponse>, AppError> {
    ensure_access(&state, &auth.uuid).await?;

    let action = req.action.trim().to_lowercase();
    let allowed = ["start", "stop", "restart", "reload", "enable", "disable"];
    if !allowed.contains(&action.as_str()) {
        return Err(AppError::bad_request("unsupported group action"));
    }

    let cfg = state.storage.load_config().await?;
    let target_services: Vec<ServiceEntry> = cfg
        .services
        .iter()
        .filter(|svc| {
            if id == "ungrouped" {
                svc.group_id.is_none()
            } else {
                svc.group_id.as_deref() == Some(id.as_str())
            }
        })
        .cloned()
        .collect();

    if target_services.is_empty() {
        return Err(AppError::bad_request("no services in target group"));
    }

    let mut items = Vec::with_capacity(target_services.len());
    let mut success = 0usize;
    let mut failed = 0usize;

    for svc in target_services {
        let unit = canonicalize_unit_name(&svc.unit);
        let (ok, output) = run_systemctl_action(&action, &unit).await;
        if ok {
            success += 1;
        } else {
            failed += 1;
        }

        let log_entry = ExecutionLogEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            service_id: svc.id.clone(),
            unit: unit.clone(),
            action: format!("group:{}:{}", id, action),
            ok,
            output: output.clone(),
        };
        state.storage.append_execution_log(&log_entry).await?;

        items.push(GroupActionItem {
            service_id: svc.id,
            service_name: svc.name,
            unit,
            ok,
            output,
        });
    }

    Ok(Json(GroupActionResponse {
        ok: failed == 0,
        action,
        group_id: id,
        total: success + failed,
        success,
        failed,
        items,
    }))
}

pub async fn api_create_service(
    State(state): State<AppState>,
    Query(auth): Query<AuthQuery>,
    Json(req): Json<ServiceCreateRequest>,
) -> Result<Json<ServiceEntry>, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    if req.name.trim().is_empty() {
        return Err(AppError::bad_request("service name is required"));
    }

    let mode = req
        .mode
        .clone()
        .unwrap_or_else(|| {
            if req
                .startup_command
                .as_deref()
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false)
            {
                "startup_command".to_string()
            } else {
                "unit_file".to_string()
            }
        })
        .to_lowercase();

    let unit = if mode == "startup_command" {
        if !req.unit.trim().is_empty() {
            normalize_unit_name(&canonicalize_unit_name(&req.unit))?
        } else {
            let generated = format!("{}.service", slugify_for_unit(&req.name));
            normalize_unit_name(&generated)?
        }
    } else {
        if req.unit.trim().is_empty() {
            return Err(AppError::bad_request("unit is required for unit_file mode"));
        }
        normalize_unit_name(&canonicalize_unit_name(&req.unit))?
    };

    let startup_command = if mode == "startup_command" {
        let cmd = req
            .startup_command
            .as_deref()
            .unwrap_or("")
            .trim()
            .to_string();
        if cmd.is_empty() {
            return Err(AppError::bad_request(
                "startup_command is required for startup_command mode",
            ));
        }

        let (normalized, script_path) =
            normalize_startup_command(&cmd, req.working_directory.as_deref())?;
        if let Some(path) = script_path.as_deref() {
            ensure_script_executable(path).await?;
        }
        Some(normalized)
    } else {
        None
    };

    let working_directory = req
        .working_directory
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.to_string());

    let run_as_user = req
        .run_as_user
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.to_string());

    if let Some(user) = run_as_user.as_deref() {
        if user.eq_ignore_ascii_case("sudo") {
            return Err(AppError::bad_request(
                "User= sudo is invalid. Use a real Linux user (e.g. ubuntu) or leave blank for root.",
            ));
        }
    }

    if mode == "startup_command" {
        let content = build_generated_unit_content(
            &req.name,
            startup_command.as_deref().unwrap_or_default(),
            working_directory.as_deref(),
            run_as_user.as_deref(),
        );
        write_unit_file_and_reload(&state.storage, &unit, &content).await?;
    } else if let Some(content) = req.unit_content.as_deref() {
        if !content.trim().is_empty() {
            write_unit_file_and_reload(&state.storage, &unit, content).await?;
        }
    }

    if req.auto_enable.unwrap_or(false) {
        let (ok, output) = run_systemctl_args(&["enable", &unit]).await;
        if !ok {
            return Err(AppError::bad_request(&format!(
                "failed to enable {}: {}",
                unit, output
            )));
        }
    }

    let service = ServiceEntry {
        id: Uuid::new_v4().to_string(),
        name: req.name.trim().to_string(),
        unit,
        group_id: req.group_id,
        description: req.description.map(|d| d.trim().to_string()),
        creation_mode: mode,
        startup_command,
        working_directory,
        run_as_user,
    };

    let mut cfg = state.storage.load_config().await?;
    cfg.services.push(service.clone());
    state.storage.save_config(&cfg).await?;
    Ok(Json(service))
}

pub async fn api_delete_service(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Query(auth): Query<AuthQuery>,
) -> Result<StatusCode, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    let mut cfg = state.storage.load_config().await?;
    cfg.services.retain(|svc| svc.id != id);
    state.storage.save_config(&cfg).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn api_update_service_group(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Query(auth): Query<AuthQuery>,
    Json(req): Json<ServiceGroupRequest>,
) -> Result<StatusCode, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    let mut cfg = state.storage.load_config().await?;
    if let Some(svc) = cfg.services.iter_mut().find(|svc| svc.id == id) {
        svc.group_id = req.group_id;
        state.storage.save_config(&cfg).await?;
        return Ok(StatusCode::NO_CONTENT);
    }
    Err(AppError::not_found("service not found"))
}

pub async fn api_service_action(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Query(auth): Query<AuthQuery>,
    Json(req): Json<ServiceActionRequest>,
) -> Result<Json<ActionResponse>, AppError> {
    ensure_access(&state, &auth.uuid).await?;

    let cfg = state.storage.load_config().await?;
    let Some(service) = cfg.services.iter().find(|svc| svc.id == id) else {
        return Err(AppError::not_found("service not found"));
    };

    let allowed = [
        "start", "stop", "restart", "reload", "status", "enable", "disable",
    ];
    let action = req.action.trim().to_lowercase();
    if !allowed.contains(&action.as_str()) {
        return Err(AppError::bad_request("unsupported action"));
    }

    let unit = canonicalize_unit_name(&service.unit);
    let (ok, output) = run_systemctl_action(&action, &unit).await;

    let log_entry = ExecutionLogEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now().to_rfc3339(),
        service_id: service.id.clone(),
        unit,
        action,
        ok,
        output: output.clone(),
    };
    state.storage.append_execution_log(&log_entry).await?;

    Ok(Json(ActionResponse { ok, output }))
}

pub async fn api_get_service_unit_file(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Query(auth): Query<AuthQuery>,
) -> Result<Json<UnitFileResponse>, AppError> {
    ensure_access(&state, &auth.uuid).await?;

    let cfg = state.storage.load_config().await?;
    let Some(service) = cfg.services.iter().find(|svc| svc.id == id) else {
        return Err(AppError::not_found("service not found"));
    };

    let unit_path = state
        .storage
        .unit_file_path(&canonicalize_unit_name(&service.unit))?;
    let content = tokio::fs::read_to_string(&unit_path)
        .await
        .with_context(|| format!("failed to read unit file: {}", unit_path.display()))?;

    Ok(Json(UnitFileResponse {
        unit: canonicalize_unit_name(&service.unit),
        path: unit_path.display().to_string(),
        content,
    }))
}

pub async fn api_update_service_unit_file(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Query(auth): Query<AuthQuery>,
    Json(req): Json<UnitFileUpdateRequest>,
) -> Result<Json<ActionResponse>, AppError> {
    ensure_access(&state, &auth.uuid).await?;

    if req.content.trim().is_empty() {
        return Err(AppError::bad_request("unit file content must not be empty"));
    }

    let cfg = state.storage.load_config().await?;
    let Some(service) = cfg.services.iter().find(|svc| svc.id == id) else {
        return Err(AppError::not_found("service not found"));
    };

    write_unit_file_and_reload(
        &state.storage,
        &canonicalize_unit_name(&service.unit),
        &req.content,
    )
    .await?;
    Ok(Json(ActionResponse {
        ok: true,
        output: "unit file saved and daemon-reload executed".to_string(),
    }))
}

pub async fn api_service_journal(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Query(query): Query<JournalQuery>,
) -> Result<Json<ActionResponse>, AppError> {
    ensure_access(&state, &query.uuid).await?;

    let cfg = state.storage.load_config().await?;
    let Some(service) = cfg.services.iter().find(|svc| svc.id == id) else {
        return Err(AppError::not_found("service not found"));
    };

    let lines = query.lines.unwrap_or(200).min(1000);
    let unit = canonicalize_unit_name(&service.unit);
    let (ok, output) = read_journal(&unit, lines).await;
    Ok(Json(ActionResponse { ok, output }))
}

pub async fn api_executions(
    State(state): State<AppState>,
    Query(auth): Query<AuthQuery>,
) -> Result<Json<Vec<ExecutionLogEntry>>, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    let logs = state.storage.read_execution_logs(500).await?;
    Ok(Json(logs))
}

pub async fn api_clear_executions(
    State(state): State<AppState>,
    Query(auth): Query<AuthQuery>,
) -> Result<StatusCode, AppError> {
    ensure_access(&state, &auth.uuid).await?;
    state.storage.clear_execution_logs().await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn hydrate_services(entries: Vec<ServiceEntry>) -> Vec<ServiceView> {
    let mut out = Vec::with_capacity(entries.len());
    for svc in entries {
        let unit = canonicalize_unit_name(&svc.unit);
        let active_state = run_quiet_systemctl("is-active", &unit).await;
        let enabled_state = run_quiet_systemctl("is-enabled", &unit).await;

        out.push(ServiceView {
            id: svc.id,
            name: svc.name,
            unit,
            group_id: svc.group_id,
            description: svc.description,
            active_state,
            enabled_state,
            creation_mode: svc.creation_mode,
            startup_command: svc.startup_command,
            working_directory: svc.working_directory,
            run_as_user: svc.run_as_user,
        });
    }
    out
}

pub async fn ensure_access(state: &AppState, uuid: &str) -> Result<(), AppError> {
    state
        .storage
        .validate_uuid(uuid)
        .await
        .map_err(|_| AppError {
            status: StatusCode::UNAUTHORIZED,
            message: "invalid or expired uuid".to_string(),
        })
}

use anyhow::Context;

fn canonicalize_unit_name(raw: &str) -> String {
    let mut value = raw.trim().to_string();
    if !value.ends_with(".service") {
        value.push_str(".service");
    }
    value
}
