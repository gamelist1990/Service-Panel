use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(author, version, about = "systemctl WebGUI backend")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    Serve {
        #[arg(long, default_value = "5600")]
        port: u16,
        #[arg(long, default_value = "0.0.0.0")]
        host: String,
    },
    IssueUrl {
        #[arg(long, default_value = "localhost")]
        host: String,
        #[arg(long, default_value = "5600")]
        port: u16,
        #[arg(long, default_value = "120")]
        ttl_minutes: i64,
    },
    ServeBg {
        #[arg(long, default_value = "5600")]
        port: u16,
        #[arg(long, default_value = "0.0.0.0")]
        host: String,
    },
}

impl Commands {
    pub fn serve_args(&self) -> Option<(String, u16)> {
        match self {
            Self::Serve { host, port } | Self::ServeBg { host, port } => {
                Some((host.clone(), *port))
            }
            _ => None,
        }
    }

    pub fn issue_args(&self) -> Option<(String, u16, i64)> {
        match self {
            Self::IssueUrl {
                host,
                port,
                ttl_minutes,
            } => Some((host.clone(), *port, *ttl_minutes)),
            _ => None,
        }
    }
}
