import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "トークンとパスワードは必須です" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上で設定してください" },
        { status: 400 }
      );
    }

    // トークンを検証
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 400 }
      );
    }

    // 期限切れチェック
    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json(
        { error: "トークンの有効期限が切れています" },
        { status: 400 }
      );
    }

    // ユーザーを取得
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 400 }
      );
    }

    // パスワードをハッシュ化して更新
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // 使用済みトークンを削除
    await prisma.passwordResetToken.delete({ where: { token } });

    return NextResponse.json(
      { message: "パスワードを更新しました" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[reset-password] エラー:", error);
    return NextResponse.json(
      { error: "パスワードの更新に失敗しました" },
      { status: 500 }
    );
  }
}
