import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

/** 今日の日付文字列 YYYY-MM-DD を返す（サーバー側） */
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

/** 明日の日付文字列 YYYY-MM-DD を返す */
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

/** メール送信ヘルパー */
async function sendMail(subject: string, html: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFICATION_EMAIL } =
    process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !NOTIFICATION_EMAIL) {
    console.warn("[notifications] SMTP設定が不完全なためメール送信をスキップします");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: SMTP_USER,
    to: NOTIFICATION_EMAIL,
    subject,
    html,
  });
}

/** 有給レコードを人間が読める形式に整形 */
function formatRecord(r: {
  date: string;
  type: string;
  hours: number | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}) {
  const typeLabel: Record<string, string> = {
    full: "全休",
    am_half: "午前半休",
    pm_half: "午後半休",
    hourly: "時間給",
  };
  let detail = typeLabel[r.type] ?? r.type;
  if (r.type === "hourly" && r.hours != null) {
    detail += ` ${r.hours}時間`;
    if (r.startTime && r.endTime) {
      detail += `（${r.startTime}〜${r.endTime}）`;
    }
  }
  if (r.note) detail += ` ／ 備考: ${r.note}`;
  return `${r.date} ${detail}`;
}

// GET /api/cron/notifications
// 外部cronサービス or Renderのcron jobから呼び出す
export async function GET(request: NextRequest) {
  // 簡易的なアクセス制御（CRON_SECRET が設定されている場合のみ検証）
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const today = todayStr();
    const tomorrow = tomorrowStr();

    // 前日通知対象: 明日が取得日 かつ notifiedDaybefore=false
    const tomorrowRecords = await prisma.leaveRecord.findMany({
      where: { date: tomorrow, notifiedDaybefore: false },
    });

    // 当日通知対象: 今日が取得日 かつ notifiedDayof=false
    const todayRecords = await prisma.leaveRecord.findMany({
      where: { date: today, notifiedDayof: false },
    });

    let sentDaybefore = 0;
    let sentDayof = 0;

    // 前日通知
    if (tomorrowRecords.length > 0) {
      const lines = tomorrowRecords.map(formatRecord).join("<br>");
      const html = `
        <h2>【有給取得リマインダー】明日の予定</h2>
        <p>明日（${tomorrow}）に以下の有給取得が登録されています：</p>
        <ul>${tomorrowRecords.map((r) => `<li>${formatRecord(r)}</li>`).join("")}</ul>
        <p>有給管理アプリより自動送信</p>
      `;
      await sendMail(`【有給リマインダー】明日（${tomorrow}）の予定`, html);
      await prisma.leaveRecord.updateMany({
        where: { id: { in: tomorrowRecords.map((r) => r.id) } },
        data: { notifiedDaybefore: true },
      });
      sentDaybefore = tomorrowRecords.length;
    }

    // 当日通知
    if (todayRecords.length > 0) {
      const html = `
        <h2>【有給取得リマインダー】本日の予定</h2>
        <p>本日（${today}）に以下の有給取得が登録されています：</p>
        <ul>${todayRecords.map((r) => `<li>${formatRecord(r)}</li>`).join("")}</ul>
        <p>有給管理アプリより自動送信</p>
      `;
      await sendMail(`【有給リマインダー】本日（${today}）の予定`, html);
      await prisma.leaveRecord.updateMany({
        where: { id: { in: todayRecords.map((r) => r.id) } },
        data: { notifiedDayof: true },
      });
      sentDayof = todayRecords.length;
    }

    return NextResponse.json({
      ok: true,
      today,
      tomorrow,
      sentDaybefore,
      sentDayof,
    });
  } catch (error) {
    console.error("[notifications] エラー:", error);
    return NextResponse.json(
      { error: "通知処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
