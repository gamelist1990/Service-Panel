# Service Panel (React x Rust)

`systemctl` を WebGUI で扱う管理パネルです。  
一時URL (`/request?uuid=...`) をターミナルで発行して利用します。

- Webポート: `5600`
- URL形式: `http://<host>:5600/request?uuid=<UUID>`
- 単体配布: `service-panel` 1ファイル（frontend埋め込み）

## 主な機能

- サービスをグループ管理
- サービス追加/削除
- グループ追加/削除
- 追加時に2モード選択:
  - `systemctl file edit`: unit名とunit内容を直接管理
  - `startup command auto create`: 起動コマンドから `.service` を自動生成
- 既存サービスの unit file をGUIで直接編集して保存
- `start/stop/restart/reload/status`
- `enable/disable`
- `journalctl` ログ表示
- 実行ログ履歴表示
- unit名入力時に `.service` 省略可（自動補完）

## 対応OS

- Linux のみ対応（`systemctl` / `journalctl` 依存）
- Windows は非対応

## 一発ビルド（backend + frontend まとめて）

```bash
./build-all.sh
```

出力: `release/service-panel`

## GitHub Actions (Ubuntu x64 / arm64)

`.github/workflows/build-linux.yml` で次をビルドします。

- `ubuntu-24.04` (x64)
- `ubuntu-24.04-arm` (arm64)

## 手動ビルド

```bash
cd web
bun install
bun run build
cd ../backend
cargo build --release
```

## 使い方

### 1) サーバ起動（対話コンソール付き）

```bash
./release/service-panel serve --host 0.0.0.0 --port 5600
```

起動後、同じコンソールで次のコマンドを入力できます。

- `url 120` : 120分有効の一時URL発行
- `help`
- `exit`

### 2) URLを発行してアクセス

別コマンドとして発行する場合:

```bash
./release/service-panel issue-url --host localhost --port 5600 --ttl-minutes 120
```

### 3) バックグラウンド起動（プロンプトをすぐ返す）

```bash
./release/service-panel serve-bg --host 0.0.0.0 --port 5600
```

## データ保存先

- `backend/data/config.json` (グループ/サービス設定)
- `backend/data/url_tokens.json` (有効期限付きUUID)
- `backend/data/execution.log` (操作ログ)

## 備考

- `systemctl` / `journalctl` 実行のため、Linux環境での利用を想定。
- 権限が必要な操作は `sudo` などの権限設定が必要。
- `User=` に `sudo` を入れても管理者権限にはならない（`sudo` はユーザー名ではない）。
- unit file の書き込み先は既定で `/etc/systemd/system`。
- unit file の書き込み先を変えたい場合は環境変数 `SERVICE_PANEL_SYSTEMD_DIR` を指定。


/mnt/c/Users/PC_User/Desktop/GItMatrix/BunProject/Service-Panel
