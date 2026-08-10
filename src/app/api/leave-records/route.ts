import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcConsumedDays, calcSpecialLeaveInfo, HALF_DAY_LEAVE_ANNUAL_LIMIT, HOURLY_LEAVE_ANNUAL_LIMIT, type LeaveType } from "@/lib/utils";

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

    // 半休の年度取得上限チェック（20回/年度）
    if (type === "am_half" || type === "pm_half") {
      const halfCount = await prisma.leaveRecord.count({
        where: {
          userId,
          fiscalYearId: Number(fiscalYearId),
          type: { in: ["am_half", "pm_half"] },
        },
      });
      if (halfCount >= HALF_DAY_LEAVE_ANNUAL_LIMIT) {
        return NextResponse.json(
          {
            error: `半休の年間取得上限（${HALF_DAY_LEAVE_ANNUAL_LIMIT}回）に達しています（現在 ${halfCount} 回取得済み）`,
          },
          { status: 400 }
        );
      }
    }

    // 時間給の年度取得上限チェック（40時間/年度）
    if (type === "hourly") {
      const hourlyAgg = await prisma.leaveRecord.aggregate({
        where: {
          userId,
          fiscalYearId: Number(fiscalYearId),
          type: "hourly",
        },
        _sum: { hours: true },
      });
      const usedHours = hourlyAgg._sum.hours ?? 0;
      const newHours = Number(hours);
      if (usedHours + newHours > HOURLY_LEAVE_ANNUAL_LIMIT) {
        return NextResponse.json(
          {
            error: `時間給の年間取得上限（${HOURLY_LEAVE_ANNUAL_LIMIT}時間）を超えます（取得済み ${usedHours} 時間 + 今回 ${newHours} 時間 = ${usedHours + newHours} 時間）`,
          },
          { status: 400 }
        );
      }
    }

    // 特別有給休暇の利用可能判定
    if (type === "special") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { joinedAt: true },
      });
      const joinedAtStr = user?.joinedAt
        ? user.joinedAt.toISOString().split("T")[0]
        : null;
      if (!joinedAtStr) {
        return NextResponse.json(
          { error: "入社日が設定されていないため特別有給休暇を利用できません" },
          { status: 400 }
        );
      }
      const specialRecords = await prisma.leaveRecord.findMany({
        where: { userId, type: "special" },
        select: { date: true, consumedDays: true },
      });
      const info = calcSpecialLeaveInfo(joinedAtStr, specialRecords);
      if (!info || info.remainingDays <= 0) {
        return NextResponse.json(
          { error: "特別有給休暇の残日数がありません" },
          { status: 400 }
        );
      }
      if (date < info.anniversaryStart || date > info.anniversaryEnd) {
        return NextResponse.json(
          {
            error: `特別有給休暇は ${info.anniversaryStart} 〜 ${info.anniversaryEnd} の期間のみ利用できます`,
          },
          { status: 400 }
        );
      }
    }

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
