import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/calendar/accounts — 連携済みアカウント一覧
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const accounts = await prisma.calendarAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "アカウント一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/calendar/accounts — 連携解除
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "アカウントIDが必要です" },
        { status: 400 }
      );
    }

    await prisma.calendarAccount.deleteMany({
      where: { id: Number(id), userId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "連携解除に失敗しました" },
      { status: 500 }
    );
  }
}
