import webpush from "web-push";
import { prisma } from "./prisma";

// ── VAPID 初期設定 ────────────────────────────────────────
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// ── 型定義 ────────────────────────────────────────────────
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  /** Service Worker の notificationclick で使う URL */
  data?: { url?: string; [key: string]: unknown };
}

// ── 送信ユーティリティ ────────────────────────────────────

/**
 * 単一の PushSubscription に Web Push 通知を送信する。
 * 購読が無効（410 / 404）の場合は DB から自動削除する。
 */
export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[push] VAPID keys が未設定のためスキップします");
    return;
  }

  const sub = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };

  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 410 || statusCode === 404) {
      // 購読が失効しているため DB から削除
      console.log(`[push] 無効な購読を削除: ${subscription.endpoint}`);
      await prisma.pushSubscription
        .deleteMany({ where: { endpoint: subscription.endpoint } })
        .catch(() => {});
    } else {
      throw error;
    }
  }
}

// ── 通知内容ビルダー ──────────────────────────────────────

/**
 * 有給リマインダー通知ペイロードを生成する。
 * @param leaveDate 取得日 (YYYY-MM-DD)
 * @param type 'day-before' = 前日通知 / 'same-day' = 当日通知
 */
export function buildLeaveReminderNotification(
  leaveDate: string,
  type: "day-before" | "same-day"
): PushPayload {
  const [, m, d] = leaveDate.split("-");
  const dateLabel = `${Number(m)}/${Number(d)}`;
  const body =
    type === "day-before"
      ? `明日（${dateLabel}）は有給休暇の取得日です`
      : `本日（${dateLabel}）は有給休暇の取得日です`;

  return {
    title: "有給リマインダー",
    body,
    icon: "/icon-192.png",
    data: { url: "/" },
  };
}

/**
 * 年5日義務警告通知ペイロードを生成する。
 * @param remainingDays 取得義務の残り日数
 */
export function buildMandatoryLeaveWarningNotification(
  remainingDays: number
): PushPayload {
  return {
    title: "年5日有給取得義務",
    body: `年5日有給取得義務まであと${remainingDays}日です。3月末までに取得してください。`,
    icon: "/icon-192.png",
    data: { url: "/" },
  };
}
