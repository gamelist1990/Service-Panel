use std::{path::PathBuf, process::Stdio};

use anyhow::{Context, Result};
use tokio::{fs::create_dir_all, process::Command};

use crate::{error::AppError, infra::storage::Storage};

pub fn build_generated_unit_content(
    service_name: &str,
    exec_start: &str,
    working_directory: Option<&str>,
    run_as_user: Option<&str>,
) -> String {
    let mut text = String::new();
    text.push_str("[Unit]\n");
    text.push_str("Description=");
    text.push_str(&sanitize_unit_line(service_name));
    text.push_str("\nAfter=network.target\n\n");

    text.push_str("[Service]\n");
    text.push_str("Type=simple\n");
    text.push_str("ExecStart=");
    text.push_str(exec_start.trim());
    text.push('\n');

    if let Some(wd) = working_directory {
        text.push_str("WorkingDirectory=");
        text.push_str(wd.trim());
        text.push('\n');
    }

    if let Some(user) = run_as_user {
        text.push_str("User=");
        text.push_str(user.trim());
        text.push('\n');
    }

    text.push_str("Restart=on-failure\n");
    text.push_str("RestartSec=3\n\n");

    text.push_str("[Install]\n");
    text.push_str("WantedBy=multi-user.target\n");
    text
}

pub fn normalize_startup_command(
    raw: &str,
    working_directory: Option<&str>,
) -> Result<(String, Option<PathBuf>), AppError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(AppError::bad_request("ExecStart command is required"));
    }

    let mut parts = trimmed.split_whitespace();
    let Some(head) = parts.next() else {
        return Err(AppError::bad_request("ExecStart command is required"));
    };
    let tail = parts.collect::<Vec<_>>().join(" ");

    let (resolved_head, script_path) = if head.starts_with("./") {
        let Some(wd) = working_directory.map(str::trim).filter(|v| !v.is_empty()) else {
            return Err(AppError::bad_request(
                "relative ExecStart like ./server.sh requires WorkingDirectory",
            ));
        };
        let base = PathBuf::from(wd);
        let full = base.join(head.trim_start_matches("./"));
        let Some(full_text) = full.to_str() else {
            return Err(AppError::bad_request(
                "ExecStart path contains invalid utf-8",
            ));
        };
        (
            full_text.to_string(),
            if full_text.ends_with(".sh") {
                Some(full)
            } else {
                None
            },
        )
    } else if head.contains('/') && !head.starts_with('/') {
        return Err(AppError::bad_request(
            "ExecStart path must be absolute (example: /opt/app/server.sh)",
        ));
    } else {
        (
            head.to_string(),
            if head.starts_with('/') && head.ends_with(".sh") {
                Some(PathBuf::from(head))
            } else {
                None
            },
        )
    };

    let command = if tail.is_empty() {
        resolved_head
    } else {
        format!("{} {}", resolved_head, tail)
    };
    Ok((command, script_path))
}

#[cfg(unix)]
pub async fn ensure_script_executable(path: &std::path::Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    if !path.exists() {
        return Ok(());
    }

    let metadata = tokio::fs::metadata(path).await?;
    let mut perms = metadata.permissions();
    let mode = perms.mode();
    let desired = mode | 0o755;
    if mode != desired {
        perms.set_mode(desired);
        tokio::fs::set_permissions(path, perms).await?;
    }
    Ok(())
}

#[cfg(not(unix))]
pub async fn ensure_script_executable(_path: &std::path::Path) -> Result<()> {
    Ok(())
}

pub fn slugify_for_unit(input: &str) -> String {
    let mut out = String::new();
    for c in input.trim().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    let out = out.trim_matches('-').chars().take(48).collect::<String>();
    if out.is_empty() {
        "service-panel-task".to_string()
    } else {
        out
    }
}

pub fn normalize_unit_name(raw: &str) -> Result<String, AppError> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(AppError::bad_request("unit is required"));
    }

    if value.contains('/') || value.contains('\\') {
        return Err(AppError::bad_request(
            "unit must not include path separators",
        ));
    }

    if !value.ends_with(".service") {
        return Err(AppError::bad_request("unit must end with .service"));
    }

    if !value
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '@'))
    {
        return Err(AppError::bad_request(
            "unit contains unsupported characters",
        ));
    }

    Ok(value.to_string())
}

pub async fn run_quiet_systemctl(action: &str, unit: &str) -> String {
    let output = Command::new("systemctl")
        .arg(action)
        .arg(unit)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match output {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if text.is_empty() {
                String::from_utf8_lossy(&out.stderr).trim().to_string()
            } else {
                text
            }
        }
        Err(_) => "unknown".to_string(),
    }
}

pub async fn run_systemctl_action(action: &str, unit: &str) -> (bool, String) {
    if action == "status" {
        let (ok, output) = run_systemctl_args(&["status", "--no-pager", unit]).await;
        if ok {
            return (true, output);
        }

        let lower = output.to_ascii_lowercase();
        let not_found = lower.contains("could not be found")
            || lower.contains("loaded: not-found")
            || lower.contains("unit ") && lower.contains(" not found");
        return (!not_found, output);
    }

    let (ok, output) = run_systemctl_args(&[action, unit]).await;
    if ok {
        return (ok, output);
    }

    if matches!(action, "start" | "restart" | "reload") {
        return (ok, append_exec_hint_if_needed(output));
    }
    (ok, output)
}

pub async fn run_systemctl_args(args: &[&str]) -> (bool, String) {
    let output = Command::new("systemctl")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match output {
        Ok(out) => {
            let mut text = String::new();
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);

            if !stdout.trim().is_empty() {
                text.push_str(stdout.trim());
            }
            if !stderr.trim().is_empty() {
                if !text.is_empty() {
                    text.push_str("\n");
                }
                text.push_str(stderr.trim());
            }

            (out.status.success(), text)
        }
        Err(err) => (false, format!("failed to execute systemctl: {}", err)),
    }
}

pub async fn read_journal(unit: &str, lines: usize) -> (bool, String) {
    let output = Command::new("journalctl")
        .arg("-u")
        .arg(unit)
        .arg("-n")
        .arg(lines.to_string())
        .arg("--no-pager")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match output {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            if text.is_empty() {
                (out.status.success(), err)
            } else {
                (out.status.success(), text)
            }
        }
        Err(err) => (false, format!("failed to execute journalctl: {}", err)),
    }
}

pub async fn write_unit_file_and_reload(
    storage: &Storage,
    unit: &str,
    content: &str,
) -> Result<()> {
    let unit_path = storage
        .unit_file_path(unit)
        .map_err(|err| anyhow::anyhow!(err.message))?;
    if let Some(parent) = unit_path.parent() {
        create_dir_all(parent).await?;
    }

    tokio::fs::write(&unit_path, content)
        .await
        .with_context(|| format!("failed to write {}", unit_path.display()))?;

    let (ok, output) = run_systemctl_args(&["daemon-reload"]).await;
    if !ok {
        anyhow::bail!("systemctl daemon-reload failed: {}", output);
    }
    Ok(())
}

fn sanitize_unit_line(input: &str) -> String {
    input
        .trim()
        .chars()
        .map(|c| if c == '\n' || c == '\r' { ' ' } else { c })
        .collect::<String>()
}

fn append_exec_hint_if_needed(output: String) -> String {
    let lower = output.to_ascii_lowercase();
    if !(lower.contains("203/exec") || lower.contains("failed at step exec")) {
        return output;
    }

    format!(
        "{}\n\nHint: status=203/EXEC usually means ExecStart path/permission issue.\n- Use absolute path (e.g. /opt/app/server.sh)\n- Ensure script is executable: chmod +x /opt/app/server.sh\n- Ensure shebang exists: #!/usr/bin/env bash",
        output
    )
}
