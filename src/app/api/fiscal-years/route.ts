import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/fiscal-years
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const fiscalYears = await prisma.fiscalYear.findMany({
      where: { userId },
      orderBy: { year: "desc" },
      include: {
        leaveRecords: {
          select: {
            consumedDays: true,
            type: true,
          },
        },
      },
    });
    return NextResponse.json(fiscalYears);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "年度データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/fiscal-years
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const body = await request.json();
    const { year, grantedDays } = body;

    if (!year || grantedDays === undefined || grantedDays < 0) {
      return NextResponse.json(
        { error: "年度と付与日数は必須です" },
        { status: 400 }
      );
    }

    const fiscalYear = await prisma.fiscalYear.upsert({
      where: { userId_year: { userId, year: Number(year) } },
      update: { grantedDays: Number(grantedDays) },
      create: { userId, year: Number(year), grantedDays: Number(grantedDays) },
    });

    return NextResponse.json(fiscalYear, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "年度データの保存に失敗しました" },
      { status: 500 }
    );
  }
}
