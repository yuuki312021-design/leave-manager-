import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { calcSpecialLeaveInfo, calcTenure } from "@/lib/utils";

// GET /api/profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, joinedAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const joinedAtStr = user.joinedAt
      ? user.joinedAt.toISOString().split("T")[0]
      : null;

    let tenure = null;
    let specialLeave = null;
    if (joinedAtStr) {
      tenure = calcTenure(joinedAtStr);
      const specialRecords = await prisma.leaveRecord.findMany({
        where: { userId, type: "special" },
        select: { date: true, consumedDays: true },
      });
      specialLeave = calcSpecialLeaveInfo(joinedAtStr, specialRecords);
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      joinedAt: joinedAtStr,
      tenure,
      specialLeave,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "プロフィールの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PUT /api/profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const body = await request.json();
    const { joinedAt } = body;

    const parsedJoinedAt =
      joinedAt && joinedAt !== "" ? new Date(joinedAt) : null;

    if (parsedJoinedAt && isNaN(parsedJoinedAt.getTime())) {
      return NextResponse.json(
        { error: "入社日の形式が正しくありません" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { joinedAt: parsedJoinedAt },
      select: { id: true, name: true, email: true, joinedAt: true },
    });

    return NextResponse.json({
      ...user,
      joinedAt: user.joinedAt ? user.joinedAt.toISOString().split("T")[0] : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "プロフィールの更新に失敗しました" },
      { status: 500 }
    );
  }
}
