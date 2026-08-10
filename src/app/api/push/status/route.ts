import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/push/status
// 現在の購読状況と通知設定を返す
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pushEnabled: true,
        reminderTime: true,
        pushSubscriptions: {
          select: { id: true, endpoint: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      pushEnabled: user.pushEnabled,
      reminderTime: user.reminderTime,
      subscriptionCount: user.pushSubscriptions.length,
      subscriptions: user.pushSubscriptions,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "購読状況の取得に失敗しました" },
      { status: 500 }
    );
  }
}
