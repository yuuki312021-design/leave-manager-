import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/fiscal-years/[id]
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
    const { grantedDays } = body;

    if (grantedDays === undefined || grantedDays < 0) {
      return NextResponse.json(
        { error: "付与日数は0以上で入力してください" },
        { status: 400 }
      );
    }

    // 所有権チェック
    const existing = await prisma.fiscalYear.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fiscalYear = await prisma.fiscalYear.update({
      where: { id: Number(id) },
      data: { grantedDays: Number(grantedDays) },
    });

    return NextResponse.json(fiscalYear);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "年度データの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/fiscal-years/[id]
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
    const existing = await prisma.fiscalYear.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.fiscalYear.delete({
      where: { id: Number(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "年度データの削除に失敗しました" },
      { status: 500 }
    );
  }
}
