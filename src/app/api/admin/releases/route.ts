import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/utils";

// GET /api/admin/releases — リリースノート一覧取得
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const releases = await prisma.releaseNote.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ releases });
}

// POST /api/admin/releases — リリースノート登録
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { version, title, body: noteBody } = body as {
    version?: string;
    title?: string;
    body?: string;
  };

  if (!version || !title || !noteBody) {
    return NextResponse.json(
      { error: "version, title, body は必須です" },
      { status: 400 }
    );
  }

  try {
    const release = await prisma.releaseNote.create({
      data: { version: version.trim(), title: title.trim(), body: noteBody.trim() },
    });
    return NextResponse.json({ release }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "登録に失敗しました。バージョンが重複している可能性があります。" },
      { status: 409 }
    );
  }
}
