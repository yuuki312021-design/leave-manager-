import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/user/notification-settings
// Body: { reminderTime?: string, pushEnabled?: boolean }
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const body = await request.json();
    const { reminderTime, pushEnabled } = body as {
      reminderTime?: string;
      pushEnabled?: boolean;
    };

    // HH:MM 形式バリデーション
    if (reminderTime !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(reminderTime)) {
        return NextResponse.json(
          { error: "reminderTime は HH:MM 形式で指定してください" },
          { status: 400 }
        );
      }
    }

    const data: { reminderTime?: string; pushEnabled?: boolean } = {};
    if (reminderTime !== undefined) data.reminderTime = reminderTime;
    if (pushEnabled !== undefined) data.pushEnabled = pushEnabled;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { pushEnabled: true, reminderTime: true },
    });

    return NextResponse.json({ ok: true, ...user });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "通知設定の更新に失敗しました" },
      { status: 500 }
    );
  }
}
