import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWebPush } from "@/lib/push";
import { ADMIN_EMAIL } from "@/lib/utils";

// GET /api/feedback — 自分のフィードバック一覧取得（認証済みユーザー）
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);

  const feedbacks = await prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ feedbacks });
}

// POST /api/feedback — 新規フィードバック送信（認証済みユーザー）
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);

  const reqBody = await request.json();
  const { type, title, body: feedbackBody } = reqBody as {
    type?: string;
    title?: string;
    body?: string;
  };

  if (!type || !["bug", "feature"].includes(type)) {
    return NextResponse.json(
      { error: "type は 'bug' または 'feature' です" },
      { status: 400 }
    );
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
  }
  if (!feedbackBody?.trim()) {
    return NextResponse.json({ error: "詳細は必須です" }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId,
      type: type.trim(),
      title: title.trim(),
      body: feedbackBody.trim(),
    },
  });

  // 管理者への全 PushSubscription にプッシュ通知を送信
  try {
    const adminUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      include: { pushSubscriptions: true },
    });
    if (adminUser?.pushSubscriptions?.length) {
      const typeLabel = type === "bug" ? "不具合報告" : "機能要望";
      for (const sub of adminUser.pushSubscriptions) {
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            {
              title: `新しいフィードバック: ${title.trim()}`,
              body: `${typeLabel}: ${feedbackBody.trim().slice(0, 50)}`,
              icon: "/icon-192.png",
              data: { url: "/admin/feedback" },
            }
          );
        } catch (pushErr) {
          console.error("[feedback] push 送信エラー:", pushErr);
        }
      }
    }
  } catch (notifyErr) {
    console.error("[feedback] 管理者通知エラー:", notifyErr);
  }

  return NextResponse.json({ feedback }, { status: 201 });
}
