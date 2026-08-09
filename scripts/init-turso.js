#!/usr/bin/env node
// scripts/init-turso.js
// Tursoデータベースにテーブルを作成するスクリプト
// 使い方: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/init-turso.js

const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Error: TURSO_DATABASE_URL が設定されていません");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function main() {
  const sqlFile = path.join(__dirname, "../prisma/turso-init.sql");
  const sql = fs.readFileSync(sqlFile, "utf-8");

  // コメントと空行を除いてセミコロンで分割
  const statements = sql
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter((s) => s.length > 0);

  console.log(`${statements.length} ステートメントをバッチ実行します...`);

  // バッチ実行（DDLは deferred モードで一括実行）
  try {
    await client.batch(statements, "deferred");
    console.log("\nTursoデータベースの初期化が完了しました!");
  } catch (err) {
    console.error("バッチ実行エラー:", err.message);
    // フォールバック: 1つずつ実行
    console.log("1ステートメントずつ実行します...");
    for (const stmt of statements) {
      const preview = stmt.substring(0, 60).replace(/\n/g, " ");
      try {
        await client.execute(stmt);
        console.log(`OK: ${preview}...`);
      } catch (e) {
        if (
          e.message &&
          (e.message.includes("already exists") || e.message.includes("duplicate column"))
        ) {
          console.log(`SKIP (already exists): ${preview}...`);
        } else {
          console.error(`Error: ${preview}...`);
          console.error(e.message);
          process.exit(1);
        }
      }
    }
    console.log("\nTursoデータベースの初期化が完了しました!");
  }
}

main();
