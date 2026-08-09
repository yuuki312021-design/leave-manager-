import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "パスワードを入力してください" },
        { status: 400 }
      );
    }

    // ユーザー取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // パスワード検証
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "パスワードが正しくありません" },
        { status: 400 }
      );
    }

    // password_reset_tokens を削除（メールアドレスで紐付け）
    await prisma.passwordResetToken.deleteMany({
      where: { email: user.email },
    });

    // ユーザー削除（leave_records・fiscal_years は onDelete: Cascade で自動削除）
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[account/delete] エラー:", error);
    return NextResponse.json(
      { error: "アカウントの削除に失敗しました" },
      { status: 500 }
    );
  }
}
