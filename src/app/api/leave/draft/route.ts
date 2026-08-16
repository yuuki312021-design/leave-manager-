import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { LeaveType } from "@/lib/utils";

export interface LeaveDraftBody {
  date: string;
  type: LeaveType;
  period?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hours?: string | null;
  reason?: string | null;
}

// GET /api/leave/draft — 自分の下書き取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const draft = await prisma.leaveDraft.findUnique({
      where: { userId },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "下書きの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/leave/draft — 下書き保存/上書き
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const body: LeaveDraftBody = await request.json();
    const { date, type } = body;

    if (!date || !type) {
      return NextResponse.json(
        { error: "取得日と種別は必須です" },
        { status: 400 }
      );
    }

    const draft = await prisma.leaveDraft.upsert({
      where: { userId },
      update: {
        date,
        type,
        period: body.period ?? null,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        hours: body.hours ?? null,
        reason: body.reason ?? null,
      },
      create: {
        userId,
        date,
        type,
        period: body.period ?? null,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        hours: body.hours ?? null,
        reason: body.reason ?? null,
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "下書きの保存に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/leave/draft — 自分の下書き削除
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    await prisma.leaveDraft.deleteMany({
      where: { userId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "下書きの削除に失敗しました" },
      { status: 500 }
    );
  }
}
