use std::path::{Path, PathBuf};

use anyhow::Result;
use chrono::Utc;
use tokio::{
    fs::{create_dir_all, read_to_string, OpenOptions},
    io::AsyncWriteExt,
    sync::Mutex,
};

use crate::{
    domain::models::{ExecutionLogEntry, PanelConfig, UrlTokenStore},
    error::AppError,
    infra::systemd::normalize_unit_name,
};

const DATA_DIR: &str = "data";
const CONFIG_FILE: &str = "data/config.json";
const TOKEN_FILE: &str = "data/url_tokens.json";
const EXEC_LOG_FILE: &str = "data/execution.log";
const DEFAULT_SYSTEMD_UNIT_DIR: &str = "/etc/systemd/system";

pub struct Storage {
    pub data_dir: PathBuf,
    pub config_path: PathBuf,
    pub token_path: PathBuf,
    pub exec_log_path: PathBuf,
    pub systemd_unit_dir: PathBuf,
    pub lock: Mutex<()>,
}

impl Storage {
    pub fn new() -> Result<Self> {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let data_dir = root.join(DATA_DIR);
        let systemd_unit_dir = std::env::var("SERVICE_PANEL_SYSTEMD_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(DEFAULT_SYSTEMD_UNIT_DIR));

        Ok(Self {
            data_dir: data_dir.clone(),
            config_path: root.join(CONFIG_FILE),
            token_path: root.join(TOKEN_FILE),
            exec_log_path: root.join(EXEC_LOG_FILE),
            systemd_unit_dir,
            lock: Mutex::new(()),
        })
    }

    pub fn unit_file_path(&self, unit: &str) -> Result<PathBuf, AppError> {
        let file_name = normalize_unit_name(unit)?;
        Ok(self.systemd_unit_dir.join(file_name))
    }

    pub async fn ensure_files(&self) -> Result<()> {
        create_dir_all(&self.data_dir).await?;

        if !Path::new(&self.config_path).exists() {
            let cfg = serde_json::to_string_pretty(&PanelConfig::default())?;
            tokio::fs::write(&self.config_path, cfg).await?;
        }

        if !Path::new(&self.token_path).exists() {
            let tokens = serde_json::to_string_pretty(&UrlTokenStore::default())?;
            tokio::fs::write(&self.token_path, tokens).await?;
        }

        if !Path::new(&self.exec_log_path).exists() {
            tokio::fs::write(&self.exec_log_path, "").await?;
        }

        Ok(())
    }

    pub async fn load_config(&self) -> Result<PanelConfig> {
        let _guard = self.lock.lock().await;
        let raw = read_to_string(&self.config_path).await?;
        let cfg = serde_json::from_str(&raw).unwrap_or_default();
        Ok(cfg)
    }

    pub async fn save_config(&self, cfg: &PanelConfig) -> Result<()> {
        let _guard = self.lock.lock().await;
        let text = serde_json::to_string_pretty(cfg)?;
        tokio::fs::write(&self.config_path, text).await?;
        Ok(())
    }

    pub async fn load_tokens(&self) -> Result<UrlTokenStore> {
        let _guard = self.lock.lock().await;
        let raw = read_to_string(&self.token_path).await?;
        let mut store: UrlTokenStore = serde_json::from_str(&raw).unwrap_or_default();
        let now = Utc::now();
        store.tokens.retain(|token| {
            chrono::DateTime::parse_from_rfc3339(&token.expires_at)
                .map(|d| d.with_timezone(&Utc) > now)
                .unwrap_or(false)
        });
        Ok(store)
    }

    pub async fn save_tokens(&self, store: &UrlTokenStore) -> Result<()> {
        let _guard = self.lock.lock().await;
        let text = serde_json::to_string_pretty(store)?;
        tokio::fs::write(&self.token_path, text).await?;
        Ok(())
    }

    pub async fn validate_uuid(&self, uuid: &str) -> Result<()> {
        let store = self.load_tokens().await?;
        if store.tokens.iter().any(|t| t.uuid == uuid) {
            self.save_tokens(&store).await?;
            return Ok(());
        }
        anyhow::bail!("invalid or expired uuid")
    }

    pub async fn append_execution_log(&self, entry: &ExecutionLogEntry) -> Result<()> {
        let _guard = self.lock.lock().await;
        let mut file = OpenOptions::new()
            .append(true)
            .create(true)
            .open(&self.exec_log_path)
            .await?;
        let line = serde_json::to_string(entry)?;
        file.write_all(line.as_bytes()).await?;
        file.write_all(b"\n").await?;
        Ok(())
    }

    pub async fn read_execution_logs(&self, max_items: usize) -> Result<Vec<ExecutionLogEntry>> {
        let _guard = self.lock.lock().await;
        let raw = read_to_string(&self.exec_log_path)
            .await
            .unwrap_or_default();

        let mut logs = Vec::new();
        for line in raw.lines().rev() {
            if let Ok(entry) = serde_json::from_str::<ExecutionLogEntry>(line) {
                logs.push(entry);
            }
            if logs.len() >= max_items {
                break;
            }
        }
        Ok(logs)
    }

    pub async fn clear_execution_logs(&self) -> Result<()> {
        let _guard = self.lock.lock().await;
        tokio::fs::write(&self.exec_log_path, "").await?;
        Ok(())
    }
}
