import { prisma } from "./prisma";
import { calcMandatoryLeaveDays, MANDATORY_LEAVE_DAYS } from "./utils";
import {
  sendWebPush,
  buildLeaveReminderNotification,
  buildMandatoryLeaveWarningNotification,
} from "./push";

// ── JST ユーティリティ ────────────────────────────────────

/** UTC+9（JST）にオフセットした Date を返す */
function getJSTNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

/** 現在の JST 時刻を "HH:MM" 文字列で返す */
function getJSTHHMM(): string {
  const jst = getJSTNow();
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * JST の YYYY-MM-DD 文字列を返す
 * @param offsetDays 0 = 今日, 1 = 明日
 */
function getJSTDateStr(offsetDays = 0): string {
  const jst = getJSTNow();
  jst.setUTCDate(jst.getUTCDate() + offsetDays);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 日付文字列 (YYYY-MM-DD) から年度（4月始まり）を返す */
function getFiscalYearFromDateStr(dateStr: string): number {
  const [year, month] = dateStr.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

// ── スケジューラー本体 ────────────────────────────────────

export interface PushSchedulerResult {
  usersProcessed: number;
  notificationsSent: number;
  errors: number;
}

/**
 * 現在の JST 時刻に一致する reminderTime を持つ
 * pushEnabled ユーザー全員にプッシュ通知を送信する。
 *
 * 送信内容:
 *   - 明日に有給取得がある場合 → 前日リマインダー
 *   - 今日に有給取得がある場合 → 当日リマインダー
 *   - 2〜3月 かつ 今年度の義務取得日数が5日未満 → 義務警告
 */
export async function runPushNotifications(): Promise<PushSchedulerResult> {
  const currentHHMM = getJSTHHMM();
  const today = getJSTDateStr(0);
  const tomorrow = getJSTDateStr(1);

  const [, todayMonthStr] = today.split("-");
  const todayMonth = Number(todayMonthStr);
  const isMandatoryPeriod = todayMonth === 2 || todayMonth === 3;

  console.log(
    `[push-scheduler] 実行: JST=${currentHHMM}, 今日=${today}, 明日=${tomorrow}`
  );

  // reminderTime が現在の JST HH:MM に一致し pushEnabled=true のユーザーを取得
  const users = await prisma.user.findMany({
    where: { pushEnabled: true, reminderTime: currentHHMM },
    include: { pushSubscriptions: true },
  });

  console.log(`[push-scheduler] 対象ユーザー: ${users.length}人`);

  let usersProcessed = 0;
  let notificationsSent = 0;
  let errors = 0;

  for (const user of users) {
    if (user.pushSubscriptions.length === 0) continue;
    usersProcessed++;

    // ── 有給取得の有無を確認 ──────────────────────────────
    const tomorrowCount = await prisma.leaveRecord.count({
      where: { userId: user.id, date: tomorrow },
    });
    const todayCount = await prisma.leaveRecord.count({
      where: { userId: user.id, date: today },
    });

    // ── 義務警告チェック（2〜3月のみ） ──────────────────
    let mandatoryRemainingDays: number | null = null;
    if (isMandatoryPeriod) {
      const currentFY = getFiscalYearFromDateStr(today);
      const fiscalYear = await prisma.fiscalYear.findUnique({
        where: { userId_year: { userId: user.id, year: currentFY } },
        include: { leaveRecords: true },
      });
      if (fiscalYear) {
        const taken = calcMandatoryLeaveDays(fiscalYear.leaveRecords);
        const remaining = MANDATORY_LEAVE_DAYS - taken;
        if (remaining > 0) {
          mandatoryRemainingDays = remaining;
        }
      }
    }

    // ── 各サブスクリプションに通知を送信 ─────────────────
    for (const sub of user.pushSubscriptions) {
      // 前日リマインダー
      if (tomorrowCount > 0) {
        try {
          await sendWebPush(
            sub,
            buildLeaveReminderNotification(tomorrow, "day-before")
          );
          notificationsSent++;
        } catch (e) {
          console.error(
            `[push-scheduler] 前日リマインダー送信失敗 (userId=${user.id}):`,
            e
          );
          errors++;
        }
      }

      // 当日リマインダー
      if (todayCount > 0) {
        try {
          await sendWebPush(
            sub,
            buildLeaveReminderNotification(today, "same-day")
          );
          notificationsSent++;
        } catch (e) {
          console.error(
            `[push-scheduler] 当日リマインダー送信失敗 (userId=${user.id}):`,
            e
          );
          errors++;
        }
      }

      // 義務警告（2〜3月のみ）
      if (mandatoryRemainingDays !== null) {
        try {
          await sendWebPush(
            sub,
            buildMandatoryLeaveWarningNotification(mandatoryRemainingDays)
          );
          notificationsSent++;
        } catch (e) {
          console.error(
            `[push-scheduler] 義務警告送信失敗 (userId=${user.id}):`,
            e
          );
          errors++;
        }
      }
    }
  }

  console.log(
    `[push-scheduler] 完了: ユーザー ${usersProcessed}人, 通知 ${notificationsSent}件, エラー ${errors}件`
  );

  return { usersProcessed, notificationsSent, errors };
}
