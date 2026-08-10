import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/push/subscribe
// Body: { endpoint: string, p256dh: string, auth: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const body = await request.json();
    const { endpoint, p256dh, auth } = body as {
      endpoint?: string;
      p256dh?: string;
      auth?: string;
    };

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "endpoint, p256dh, auth は必須です" },
        { status: 400 }
      );
    }

    // upsert: 同じ endpoint があれば更新、なければ作成
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth, userId },
      update: { p256dh, auth, userId },
    });

    return NextResponse.json({ ok: true, id: subscription.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "購読情報の保存に失敗しました" },
      { status: 500 }
    );
  }
}
