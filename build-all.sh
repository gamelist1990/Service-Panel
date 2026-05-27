#!/usr/bin/env bash
set -e

root="$(cd "$(dirname "$0")" && pwd)"
web="$root/web"
backend="$root/backend"
out="$root/release"

echo "[1/3] Web build"
cd "$web"
bun install
bun run build
cd "$root"

echo "[2/3] Rust release build"
cd "$backend"
cargo build --release
cd "$root"

echo "[3/3] Collect single executable"
mkdir -p "$out"

cp "$backend/target/release/service-panel-backend" \
   "$out/service-panel"

echo "Done: $out/service-panel"