import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/utils";

// PUT /api/admin/feedback/[id] — ステータス更新・管理者メモ追加（管理者のみ）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const { status, adminNote } = body as {
    status?: string;
    adminNote?: string;
  };

  const validStatuses = ["open", "in_progress", "resolved", "closed"];
  if (status !== undefined && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
  }

  const updateData: { status?: string; adminNote?: string } = {};
  if (status !== undefined) updateData.status = status;
  if (adminNote !== undefined) updateData.adminNote = adminNote;

  try {
    const feedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ feedback });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 404 });
  }
}
