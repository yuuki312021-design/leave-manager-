import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { runPushNotifications } from "@/lib/notification-scheduler";

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
async function sendMail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] RESEND_API_KEY が設定されていないためメール送信をスキップします");
    return;
  }

  const from = process.env.NOTIFICATION_EMAIL || "onboarding@resend.dev";
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    console.error("[notifications] メール送信エラー:", {
      name: error.name,
      message: error.message,
    });
    throw new Error(`メール送信失敗: ${error.message}`);
  }

  console.log(`[notifications] メール送信成功: ${to} (id: ${data?.id})`);
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

    // 前日通知対象: 明日が取得日 かつ notifiedDaybefore=false（ユーザー情報込み）
    const tomorrowRecords = await prisma.leaveRecord.findMany({
      where: { date: tomorrow, notifiedDaybefore: false },
      include: { user: { select: { email: true, name: true } } },
    });

    // 当日通知対象: 今日が取得日 かつ notifiedDayof=false（ユーザー情報込み）
    const todayRecords = await prisma.leaveRecord.findMany({
      where: { date: today, notifiedDayof: false },
      include: { user: { select: { email: true, name: true } } },
    });

    let sentDaybefore = 0;
    let sentDayof = 0;

    // ユーザーIDごとにグループ化してメール送信
    type RecordWithUser = (typeof tomorrowRecords)[number];

    function groupByUser(records: RecordWithUser[]) {
      const map = new Map<number, { email: string; name: string; records: RecordWithUser[] }>();
      for (const r of records) {
        if (!r.user) continue; // 孤立データはスキップ
        if (!map.has(r.userId)) {
          map.set(r.userId, { email: r.user.email, name: r.user.name, records: [] });
        }
        map.get(r.userId)!.records.push(r);
      }
      return map;
    }

    // 前日通知
    const tomorrowByUser = groupByUser(tomorrowRecords);
    for (const [, { email, records }] of tomorrowByUser) {
      const html = `
        <h2>【有給取得リマインダー】明日の予定</h2>
        <p>明日（${tomorrow}）に以下の有給取得が登録されています：</p>
        <ul>${records.map((r) => `<li>${formatRecord(r)}</li>`).join("")}</ul>
        <p>有給管理アプリより自動送信</p>
      `;
      await sendMail(email, `【有給リマインダー】明日（${tomorrow}）の予定`, html);
      sentDaybefore += records.length;
    }
    if (tomorrowRecords.length > 0) {
      await prisma.leaveRecord.updateMany({
        where: { id: { in: tomorrowRecords.map((r) => r.id) } },
        data: { notifiedDaybefore: true },
      });
    }

    // 当日通知
    const todayByUser = groupByUser(todayRecords);
    for (const [, { email, records }] of todayByUser) {
      const html = `
        <h2>【有給取得リマインダー】本日の予定</h2>
        <p>本日（${today}）に以下の有給取得が登録されています：</p>
        <ul>${records.map((r) => `<li>${formatRecord(r)}</li>`).join("")}</ul>
        <p>有給管理アプリより自動送信</p>
      `;
      await sendMail(email, `【有給リマインダー】本日（${today}）の予定`, html);
      sentDayof += records.length;
    }
    if (todayRecords.length > 0) {
      await prisma.leaveRecord.updateMany({
        where: { id: { in: todayRecords.map((r) => r.id) } },
        data: { notifiedDayof: true },
      });
    }

    // ── プッシュ通知送信 ──────────────────────────────────
    let pushResult = { usersProcessed: 0, notificationsSent: 0, errors: 0 };
    try {
      pushResult = await runPushNotifications();
    } catch (pushError) {
      console.error("[notifications] プッシュ通知エラー:", pushError);
    }

    return NextResponse.json({
      ok: true,
      today,
      tomorrow,
      sentDaybefore,
      sentDayof,
      push: pushResult,
    });
  } catch (error) {
    console.error("[notifications] エラー:", error);
    return NextResponse.json(
      { error: "通知処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
