import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextAuth 内部ルートと Cron は常に通過
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request });

  // API ルート: 未認証なら 401 を返す
  if (pathname.startsWith("/api/")) {
    if (!token) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return NextResponse.next();
  }

  // ログイン・登録ページ: 認証済みならトップへリダイレクト
  if (pathname === "/login" || pathname === "/signup") {
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // パスワードリセット関連ページ: 未認証でもアクセス可能
  if (
    pathname === "/auth/forgot-password" ||
    pathname.startsWith("/auth/reset-password")
  ) {
    return NextResponse.next();
  }

  // その他のページ: 未認証ならログインへリダイレクト
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // _next 内部ファイル・favicon・PWA アセットはミドルウェアをスキップ
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icon-192\\.png|icon-512\\.png).*)",
  ],
};
