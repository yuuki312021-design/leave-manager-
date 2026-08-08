import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcConsumedDays, type LeaveType } from "@/lib/utils";

// PUT /api/leave-records/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const { id } = await params;
    const body = await request.json();
    const { date, type, hours, note } = body;

    if (!date || !type) {
      return NextResponse.json(
        { error: "取得日・種別は必須です" },
        { status: 400 }
      );
    }

    if (type === "hourly" && (!hours || hours <= 0)) {
      return NextResponse.json(
        { error: "時間給の場合は時間数（1以上）を入力してください" },
        { status: 400 }
      );
    }

    // 所有権チェック
    const existing = await prisma.leaveRecord.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const consumedDays = calcConsumedDays(type as LeaveType, hours);

    const record = await prisma.leaveRecord.update({
      where: { id: Number(id) },
      data: {
        date,
        type,
        hours: type === "hourly" ? Number(hours) : null,
        consumedDays,
        note: note ?? null,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "有給取得の更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/leave-records/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const { id } = await params;

    // 所有権チェック
    const existing = await prisma.leaveRecord.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.leaveRecord.delete({
      where: { id: Number(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "有給取得の削除に失敗しました" },
      { status: 500 }
    );
  }
}
