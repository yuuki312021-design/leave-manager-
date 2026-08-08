import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcConsumedDays, type LeaveType } from "@/lib/utils";

// GET /api/leave-records?year=2024
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");

    const where = yearParam
      ? { userId, fiscalYear: { year: Number(yearParam) } }
      : { userId };

    const records = await prisma.leaveRecord.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        fiscalYear: { select: { year: true, grantedDays: true } },
      },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "取得履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/leave-records
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const body = await request.json();
    const { fiscalYearId, date, type, hours, startTime, endTime, note } = body;

    if (!fiscalYearId || !date || !type) {
      return NextResponse.json(
        { error: "年度ID・取得日・種別は必須です" },
        { status: 400 }
      );
    }

    if (type === "hourly" && (!hours || hours <= 0)) {
      return NextResponse.json(
        { error: "時間給の場合は時間数（1以上）を入力してください" },
        { status: 400 }
      );
    }

    // 年度の所有権チェック
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: Number(fiscalYearId), userId },
    });
    if (!fiscalYear) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const consumedDays = calcConsumedDays(type as LeaveType, hours);

    const record = await prisma.leaveRecord.create({
      data: {
        userId,
        fiscalYearId: Number(fiscalYearId),
        date,
        type,
        hours: type === "hourly" ? Number(hours) : null,
        startTime: type === "hourly" ? (startTime ?? null) : null,
        endTime: type === "hourly" ? (endTime ?? null) : null,
        consumedDays,
        note: note ?? null,
      },
      include: {
        fiscalYear: { select: { year: true, grantedDays: true } },
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "有給取得の登録に失敗しました" },
      { status: 500 }
    );
  }
}
