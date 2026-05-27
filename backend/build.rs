use std::{env, path::PathBuf, process::Command};

fn main() {
    println!("cargo:rerun-if-changed=../web/src");
    println!("cargo:rerun-if-changed=../web/index.html");
    println!("cargo:rerun-if-changed=../web/package.json");
    println!("cargo:rerun-if-changed=../web/bun.lock");

    if env::var("SERVICE_PANEL_SKIP_WEB_BUILD").as_deref() == Ok("1") {
        println!("cargo:warning=Skipping web build because SERVICE_PANEL_SKIP_WEB_BUILD=1");
        return;
    }

    let web_dir = PathBuf::from("..").join("web");

    let dist_index = web_dir.join("dist").join("index.html");

    let install_status = run_bun(&web_dir, &["install"]);
    match install_status {
        Some(status) if status.success() => {}
        Some(status) => {
            panic!("bun install failed with status: {status}");
        }
        None => {
            if !dist_index.exists() {
                panic!(
                    "bun command not found and web/dist/index.html does not exist. \
                     Run `cd web && bun install && bun run build` first."
                );
            }
            println!("cargo:warning=bun not found, using existing web/dist artifacts");
            return;
        }
    }

    let build_status = run_bun(&web_dir, &["run", "build"]);
    match build_status {
        Some(status) if status.success() => {}
        Some(status) => {
            panic!("bun run build failed with status: {status}");
        }
        None => {
            panic!("bun command disappeared before bun run build");
        }
    }
}

fn run_bun(web_dir: &PathBuf, args: &[&str]) -> Option<std::process::ExitStatus> {
    let mut commands: Vec<Vec<String>> = vec![
        std::iter::once("bun".to_string())
            .chain(args.iter().map(|s| s.to_string()))
            .collect(),
        std::iter::once("bun.exe".to_string())
            .chain(args.iter().map(|s| s.to_string()))
            .collect(),
    ];

    let mut cmd_line = String::from("bun");
    for a in args {
        cmd_line.push(' ');
        cmd_line.push_str(a);
    }
    commands.push(vec!["cmd".to_string(), "/C".to_string(), cmd_line]);

    for command in commands {
        let mut cmd = Command::new(&command[0]);
        if command.len() > 1 {
            cmd.args(&command[1..]);
        }
        let status = cmd.current_dir(web_dir).status();
        if let Ok(ok) = status {
            return Some(ok);
        }
    }
    None
}
