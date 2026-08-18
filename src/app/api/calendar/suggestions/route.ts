import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/calendar/suggestions — 自分の候補一覧
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const suggestion = await prisma.pendingLeaveSuggestion.findFirst({
        where: { id: Number(id), userId },
      });
      if (!suggestion) {
        return NextResponse.json(
          { error: "候補が見つかりません" },
          { status: 404 }
        );
      }
      return NextResponse.json(suggestion);
    }

    const suggestions = await prisma.pendingLeaveSuggestion.findMany({
      where: { userId, status: "pending" },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "候補の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT /api/calendar/suggestions — 候補status更新（approved / rejected）
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const body: { id: number; status: "approved" | "rejected" } = await request.json();
    if (!body.id || !body.status) {
      return NextResponse.json(
        { error: "id と status は必須です" },
        { status: 400 }
      );
    }

    const updated = await prisma.pendingLeaveSuggestion.updateMany({
      where: { id: body.id, userId },
      data: { status: body.status },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "候補が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "候補の更新に失敗しました" },
      { status: 500 }
    );
  }
}
