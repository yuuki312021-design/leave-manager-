import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWebPush } from "@/lib/push";

async function sendTestNotification() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);

  // VAPID キーの存在確認（デバッグ用）
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "VAPID キーが未設定です（NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY）",
        debug: {
          vapidPublicKey: !!vapidPublicKey,
          vapidPrivateKey: !!vapidPrivateKey,
          vapidSubject: !!vapidSubject,
        },
      },
      { status: 500 }
    );
  }

  // ユーザーの全購読情報を取得
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  console.log(
    `[push/test] userId=${userId}, subscriptionCount=${subscriptions.length}`
  );

  if (subscriptions.length === 0) {
    return NextResponse.json({
      ok: false,
      error:
        "購読情報がありません。設定画面で「通知を許可する」を実行してください。",
      subscriptionCount: 0,
    });
  }

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await sendWebPush(sub, {
        title: "テスト通知",
        body: "テスト通知: プッシュ通知が正常に動作しています",
        icon: "/icon-192.png",
        data: { url: "/settings" },
      });
      sent++;
      console.log(`[push/test] 送信成功: endpoint=${sub.endpoint.slice(0, 40)}...`);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      console.error(`[push/test] 送信失敗: ${msg}`);
    }
  }

  return NextResponse.json({
    ok: failed === 0 && sent > 0,
    subscriptionCount: subscriptions.length,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// GET /api/push/test - テスト通知（ブラウザから直接アクセス可能）
export async function GET() {
  try {
    return await sendTestNotification();
  } catch (error) {
    console.error("[push/test] エラー:", error);
    return NextResponse.json(
      { error: "テスト通知の送信中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// POST /api/push/test
// 認証済みユーザーの全購読にテスト通知を送信する
export async function POST() {
  try {
    return await sendTestNotification();
  } catch (error) {
    console.error("[push/test] エラー:", error);
    return NextResponse.json(
      { error: "テスト通知の送信中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
