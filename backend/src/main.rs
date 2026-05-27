mod cli;
mod domain;
mod error;
mod infra;
mod state;
mod web;

use std::{
    io::{self, IsTerminal, Write},
    net::SocketAddr,
    process::{Command as StdCommand, Stdio},
    sync::Arc,
};

use anyhow::{Context, Result};
use chrono::{Duration, Utc};
use clap::Parser;
use domain::models::UrlToken;
use infra::storage::Storage;
use state::AppState;
use tower_http::cors::CorsLayer;

use crate::{
    cli::{Cli, Commands},
    web::handlers::build_router,
};

#[tokio::main]
async fn main() -> Result<()> {
    if cfg!(not(target_os = "linux")) {
        anyhow::bail!("Service Panel supports Linux only because it depends on systemctl");
    }

    let cli = Cli::parse();
    let storage = Arc::new(Storage::new()?);

    if let Some((host, port, ttl_minutes)) = cli.command.issue_args() {
        return issue_url(storage, host, port, ttl_minutes).await;
    }

    if let Commands::ServeBg { .. } = cli.command {
        let (host, port) = cli
            .command
            .serve_args()
            .unwrap_or_else(|| ("0.0.0.0".to_string(), 5600));
        return serve_bg(host, port);
    }

    let (host, port) = cli
        .command
        .serve_args()
        .unwrap_or_else(|| ("0.0.0.0".to_string(), 5600));
    serve(storage, host, port).await
}

fn serve_bg(host: String, port: u16) -> Result<()> {
    let exe = std::env::current_exe().context("failed to locate current executable")?;
    let child = StdCommand::new(exe)
        .arg("serve")
        .arg("--host")
        .arg(host)
        .arg("--port")
        .arg(port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .context("failed to start background server")?;

    println!(
        "Background server started (pid={}). Use your OS process manager to stop it.",
        child.id()
    );
    Ok(())
}

async fn serve(storage: Arc<Storage>, host: String, port: u16) -> Result<()> {
    storage.ensure_files().await?;
    let state = AppState {
        storage: storage.clone(),
    };

    let app = build_router(state).layer(CorsLayer::permissive());

    let addr: SocketAddr = format!("{}:{}", host, port)
        .parse()
        .context("invalid bind address")?;

    println!("Service Panel backend started on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let server_task = tokio::spawn(async move { axum::serve(listener, app).await });

    if io::stdin().is_terminal() {
        println!("Console command: url [ttl_minutes] | help | exit");
        run_console(storage, host.clone(), port).await?;
        server_task.abort();
        let _ = server_task.await;
        println!("Server stopped.");
        return Ok(());
    }

    let server_result = server_task
        .await
        .context("server task join error")?
        .context("server runtime error")?;
    Ok(server_result)
}

async fn run_console(storage: Arc<Storage>, host: String, port: u16) -> Result<()> {
    use tokio::io::{AsyncBufReadExt, BufReader};

    let stdin = BufReader::new(tokio::io::stdin());
    let mut lines = stdin.lines();

    loop {
        print!("service-panel> ");
        io::stdout().flush().ok();

        let Some(line) = lines.next_line().await.context("stdin read failed")? else {
            break;
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut parts = trimmed.split_whitespace();
        let cmd = parts.next().unwrap_or_default().to_lowercase();

        match cmd.as_str() {
            "help" => {
                println!("url [ttl_minutes]  : generate temporary URL");
                println!("exit               : stop server");
            }
            "url" => {
                let ttl = parts
                    .next()
                    .and_then(|v| v.parse::<i64>().ok())
                    .unwrap_or(120);
                let token = issue_url_internal(storage.clone(), ttl).await?;
                println!(
                    "Temporary URL (expires {}): http://{}:{}/request?uuid={}",
                    token.expires_at, host, port, token.uuid
                );
            }
            "exit" | "quit" => break,
            _ => println!("Unknown command. type `help`"),
        }
    }

    Ok(())
}

async fn issue_url(storage: Arc<Storage>, host: String, port: u16, ttl_minutes: i64) -> Result<()> {
    storage.ensure_files().await?;
    let token = issue_url_internal(storage, ttl_minutes).await?;

    println!(
        "Temporary URL (expires {}): http://{}:{}/request?uuid={}",
        token.expires_at, host, port, token.uuid
    );
    Ok(())
}

async fn issue_url_internal(storage: Arc<Storage>, ttl_minutes: i64) -> Result<UrlToken> {
    let now = Utc::now();
    let token = UrlToken {
        uuid: uuid::Uuid::new_v4().to_string(),
        issued_at: now.to_rfc3339(),
        expires_at: (now + Duration::minutes(ttl_minutes.max(1))).to_rfc3339(),
    };

    let mut store = storage.load_tokens().await?;
    store.tokens.push(token.clone());
    storage.save_tokens(&store).await?;
    Ok(token)
}
