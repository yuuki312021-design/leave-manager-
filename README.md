# Leave Manager

有給休暇管理アプリ (Next.js + Turso DB + Render)

---

## Render デプロイ設定

### render.yaml による自動設定

`render.yaml` に以下が定義されています:

| 項目 | 値 |
|------|-----|
| buildCommand | `npm install --legacy-peer-deps && node scripts/migrate-turso.js && npx prisma generate && next build` |
| startCommand | `npm run start:prod` (`= node scripts/migrate-turso.js && npm run start`) |

> **重要**: Render ダッシュボードの Settings → Start Command / Build Command が手動で設定されている場合、`render.yaml` より優先されます。
> ダッシュボードの設定を必ず確認してください。

### Render ダッシュボードの手動設定 (推奨)

Render ダッシュボード → サービス選択 → **Settings** → **Build & Deploy** で以下を設定:

| 項目 | 設定値 |
|------|--------|
| **Build Command** | `npm install --legacy-peer-deps && node scripts/migrate-turso.js && npx prisma generate && next build` |
| **Start Command** | `npm run start:prod` |

設定後、**Manual Deploy** → **Deploy latest commit** を実行してください。

---

## Turso DB マイグレーション

### 通常手順 (Render 経由)

デプロイ時に `buildCommand` と `startCommand` の両方でマイグレーションが実行されます。
ログに以下が表示されれば成功:

```
[migrate-turso] Starting... (2026-08-11T...)
[migrate-turso] ========== Turso DB マイグレーション開始 ==========
[migrate-turso] ALTER SKIP : users.reminderTime already exists
[migrate-turso] ALTER SKIP : users.pushEnabled already exists
[migrate-turso] ========== マイグレーション完了 (0.XXs, exit code 0) ==========
```

### 緊急手動実行 (Render Shell) ← ログインが復旧しない場合

ログインエラー `no such column: main.users.reminderTime` が発生した場合:

1. Render ダッシュボード → サービス選択 → **Shell** タブを開く
2. 以下を実行:

```bash
node scripts/migrate-turso.js
```

Environment Variables は Render Shell で自動的に利用可能です。

### ローカル手動実行

```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io \
TURSO_AUTH_TOKEN=your-token \
node scripts/migrate-turso.js
```

または `.env.local` に設定後:

```bash
npm run migrate
```

### Turso CLI を使った直接実行 (最終手段)

```bash
turso db shell <your-db-name>
```

接続後、以下の SQL を実行:

```sql
ALTER TABLE users ADD COLUMN reminderTime TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE users ADD COLUMN pushEnabled BOOLEAN NOT NULL DEFAULT false;
```

> すでにカラムが存在する場合はエラーになりますが、無視して問題ありません。

---

## npm スクリプト

| スクリプト | 説明 |
|-----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー起動 |
| `npm run start:prod` | マイグレーション実行後にサーバー起動 (Render 本番用) |
| `npm run migrate` | Turso DB マイグレーションのみ実行 |
| `npm run lint` | ESLint チェック |

---

## 環境変数

Render ダッシュボードの Environment Variables で以下を設定してください:

| 変数名 | 説明 |
|--------|------|
| `TURSO_DATABASE_URL` | Turso DB の接続 URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso DB の認証トークン |
| `NEXTAUTH_URL` | 本番 URL (`https://your-app.onrender.com`) |
| `NEXTAUTH_SECRET` | NextAuth のシークレットキー |
| `RESEND_API_KEY` | メール送信用 Resend API キー |
| `NOTIFICATION_EMAIL` | 通知メール送信元アドレス |
| `CRON_SECRET` | Cron ジョブ認証シークレット |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push 公開鍵 |
| `VAPID_PRIVATE_KEY` | Web Push 秘密鍵 |
| `VAPID_SUBJECT` | Web Push サブジェクト (`mailto:...`) |
