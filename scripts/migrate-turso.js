#!/usr/bin/env node
// scripts/migrate-turso.js
// Turso DB の増分マイグレーション（既存 DB への ALTER TABLE + 新テーブル作成）
// render.yaml の buildCommand / startCommand から呼び出す。
// TURSO_DATABASE_URL が未設定の場合は exit code 1 でビルドを失敗させる。

const { createClient } = require("@libsql/client");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("[migrate-turso] FATAL: TURSO_DATABASE_URL が未設定です。");
  console.error("[migrate-turso] Render ダッシュボードの Environment Variables を確認してください。");
  process.exit(1);
}

if (!authToken) {
  console.error("[migrate-turso] FATAL: TURSO_AUTH_TOKEN が未設定です。");
  console.error("[migrate-turso] Render ダッシュボードの Environment Variables を確認してください。");
  process.exit(1);
}

// URL からシークレット部分を除いた表示用文字列
const urlDisplay = url.replace(/\?.*/, "");
console.log(`[migrate-turso] DB: ${urlDisplay}`);

const client = createClient({ url, authToken });

// ── ヘルパー: テーブルのカラム一覧を取得（PRAGMA table_info を使用）──────────
async function getColumns(tableName) {
  const result = await client.execute(`PRAGMA table_info("${tableName}")`);
  return result.rows.map((row) => row.name);
}

// ── ヘルパー: テーブルが存在するか確認 ──────────────────────────────────────
async function tableExists(tableName) {
  const result = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  return result.rows.length > 0;
}

// ── ヘルパー: CREATE 文を実行（IF NOT EXISTS を使用） ───────────────────────
async function execCreate(sql, label) {
  const preview = sql.replace(/\s+/g, " ").substring(0, 120);
  try {
    await client.execute(sql);
    console.log(`[migrate-turso] CREATE OK  : ${label}`);
  } catch (e) {
    console.error(`[migrate-turso] CREATE FAIL: ${label}`);
    console.error(`[migrate-turso]   SQL: ${preview}...`);
    console.error(`[migrate-turso]   Error: ${e.message}`);
    if (e.stack) console.error(e.stack);
    throw e;
  }
}

// ── ヘルパー: ALTER TABLE でカラム追加（PRAGMA で事前確認して冪等に実行）────
async function execAlter({ table, column, sql }) {
  let columns;
  try {
    columns = await getColumns(table);
  } catch (e) {
    console.error(`[migrate-turso] PRAGMA FAIL: table_info("${table}")`);
    console.error(`[migrate-turso]   Error: ${e.message}`);
    if (e.stack) console.error(e.stack);
    throw e;
  }

  if (columns.includes(column)) {
    console.log(`[migrate-turso] ALTER SKIP : ${table}.${column} already exists`);
    return;
  }

  try {
    await client.execute(sql);
    console.log(`[migrate-turso] ALTER OK   : Added ${table}.${column}`);
  } catch (e) {
    console.error(`[migrate-turso] ALTER FAIL : ${table}.${column}`);
    console.error(`[migrate-turso]   Error: ${e.message}`);
    if (e.stack) console.error(e.stack);
    throw e;
  }
}

// ── Step 1: CREATE TABLE IF NOT EXISTS（フレッシュ DB / 不足テーブル向け）────
const CREATE_STATEMENTS = [
  {
    label: "TABLE users",
    sql: `CREATE TABLE IF NOT EXISTS "users" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "joined_at" DATETIME,
      "reminderTime" TEXT NOT NULL DEFAULT '09:00',
      "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    label: "INDEX users_email_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")`,
  },
  {
    label: "TABLE fiscal_years",
    sql: `CREATE TABLE IF NOT EXISTS "fiscal_years" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "year" INTEGER NOT NULL,
      "grantedDays" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fiscal_years_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  },
  {
    label: "INDEX fiscal_years_userId_year_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_years_userId_year_key" ON "fiscal_years"("userId", "year")`,
  },
  {
    label: "TABLE leave_records",
    sql: `CREATE TABLE IF NOT EXISTS "leave_records" (
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
  },
  {
    label: "TABLE push_subscriptions",
    sql: `CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "endpoint" TEXT NOT NULL,
      "p256dh" TEXT NOT NULL,
      "auth" TEXT NOT NULL,
      "userId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  },
  {
    label: "INDEX push_subscriptions_endpoint_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint")`,
  },
  {
    label: "TABLE password_reset_tokens",
    sql: `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "token" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    label: "INDEX password_reset_tokens_token_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token")`,
  },
  {
    label: "INDEX password_reset_tokens_email_idx",
    sql: `CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_idx" ON "password_reset_tokens"("email")`,
  },
];

// ── Step 2: ALTER TABLE（既存 DB への増分カラム追加）──────────────────────────
// PRAGMA table_info で事前にカラム存在を確認し、冪等に実行する。
const ALTER_MIGRATIONS = [
  // commit d108628: push notification settings columns
  {
    table: "users",
    column: "reminderTime",
    sql: `ALTER TABLE "users" ADD COLUMN "reminderTime" TEXT NOT NULL DEFAULT '09:00'`,
  },
  {
    table: "users",
    column: "pushEnabled",
    sql: `ALTER TABLE "users" ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT false`,
  },
];

async function main() {
  console.log("[migrate-turso] ========== Turso DB マイグレーション開始 ==========");

  console.log("[migrate-turso] --- Step 1: テーブル・インデックス作成 (IF NOT EXISTS) ---");
  for (const { label, sql } of CREATE_STATEMENTS) {
    await execCreate(sql, label);
  }

  console.log("[migrate-turso] --- Step 2: ALTER TABLE（増分カラム追加）---");
  for (const migration of ALTER_MIGRATIONS) {
    await execAlter(migration);
  }

  console.log("[migrate-turso] ========== マイグレーション完了 ==========");
}

main().catch((e) => {
  console.error("[migrate-turso] 予期しないエラーが発生しました:");
  console.error(e.stack || e.message);
  process.exit(1);
});
