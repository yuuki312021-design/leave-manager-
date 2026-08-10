#!/usr/bin/env node
// scripts/migrate-turso.js
// Turso DB の増分マイグレーション（既存 DB への ALTER TABLE + 新テーブル作成）
// ビルド時に render.yaml の buildCommand から呼び出す。
// TURSO_DATABASE_URL が未設定の場合は何もせず正常終了する（ローカル SQLite 環境用）。

const { createClient } = require("@libsql/client");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.log("[migrate-turso] TURSO_DATABASE_URL が未設定 - マイグレーションをスキップします");
  process.exit(0);
}

const client = createClient({ url, authToken });

// ── Step 1: CREATE TABLE IF NOT EXISTS（フレッシュ DB 向け）────────────────
// 最新スキーマでテーブルを作成。既存テーブルがある場合は IF NOT EXISTS で無視。
const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joined_at" DATETIME,
    "reminderTime" TEXT NOT NULL DEFAULT '09:00',
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")`,
  `CREATE TABLE IF NOT EXISTS "fiscal_years" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "grantedDays" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiscal_years_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_years_userId_year_key" ON "fiscal_years"("userId", "year")`,
  `CREATE TABLE IF NOT EXISTS "leave_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "fiscalYearId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hours" REAL,
    "startTime" TEXT,
    "endTime" TEXT,
    "consumedDays" REAL NOT NULL,
    "note" TEXT,
    "notifiedDaybefore" BOOLEAN NOT NULL DEFAULT false,
    "notifiedDayof" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leave_records_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint")`,
  `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token")`,
  `CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_idx" ON "password_reset_tokens"("email")`,
];

// ── Step 2: ALTER TABLE（既存 DB への増分マイグレーション）──────────────────
// カラムが既に存在する場合は "duplicate column" エラーを無視する。
const ALTER_STATEMENTS = [
  // commit d108628: push notification settings columns
  `ALTER TABLE "users" ADD COLUMN "reminderTime" TEXT NOT NULL DEFAULT '09:00'`,
  `ALTER TABLE "users" ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT false`,
];

async function execIdempotent(sql, step) {
  const preview = sql.replace(/\s+/g, " ").substring(0, 100);
  try {
    await client.execute(sql);
    console.log(`[migrate-turso] ${step} OK: ${preview}...`);
  } catch (e) {
    const msg = (e.message || "").toLowerCase();
    if (
      msg.includes("duplicate column") ||
      msg.includes("already exists") ||
      msg.includes("table already exists") ||
      msg.includes("index already exists")
    ) {
      console.log(`[migrate-turso] ${step} SKIP (already exists): ${preview}...`);
    } else {
      console.error(`[migrate-turso] ${step} ERROR: ${preview}`);
      console.error(e.message);
      throw e;
    }
  }
}

async function main() {
  console.log("[migrate-turso] Turso DB マイグレーション開始...");

  console.log("[migrate-turso] --- Step 1: テーブル作成 (IF NOT EXISTS) ---");
  for (const sql of CREATE_STATEMENTS) {
    await execIdempotent(sql, "CREATE");
  }

  console.log("[migrate-turso] --- Step 2: ALTER TABLE（増分カラム追加）---");
  for (const sql of ALTER_STATEMENTS) {
    await execIdempotent(sql, "ALTER");
  }

  console.log("[migrate-turso] マイグレーション完了!");
}

main().catch((e) => {
  console.error("[migrate-turso] 予期しないエラー:", e.message);
  process.exit(1);
});
