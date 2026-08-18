import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";

// GET /api/calendar/callback — Google OAuth コールバック処理
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const stateParam = searchParams.get("state");

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?calendar=error&message=${encodeURIComponent(error)}`, request.url)
      );
    }
    if (!code || !stateParam) {
      return NextResponse.redirect(
        new URL("/settings?calendar=error&message=invalid_callback", request.url)
      );
    }

    let state: { userId?: string } = {};
    try {
      state = JSON.parse(
        Buffer.from(stateParam, "base64url").toString("utf-8")
      ) as { userId?: string };
    } catch {
      return NextResponse.redirect(
        new URL("/settings?calendar=error&message=invalid_state", request.url)
      );
    }

    if (state.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL("/settings?calendar=error&message=user_mismatch", request.url)
      );
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      return NextResponse.redirect(
        new URL("/settings?calendar=error&message=missing_config", request.url)
      );
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error(tokenData);
      return NextResponse.redirect(
        new URL(
          `/settings?calendar=error&message=${encodeURIComponent(tokenData.error ?? "token_failed")}`,
          request.url
        )
      );
    }

    // ユーザー情報を取得
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const userInfo = (await userInfoRes.json()) as { email?: string };

    const userId = Number(session.user.id);
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);

    await prisma.calendarAccount.upsert({
      where: { userId_provider: { userId, provider: "google" } },
      update: {
        email: userInfo.email ?? null,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? "",
        expiresAt,
      },
      create: {
        userId,
        provider: "google",
        email: userInfo.email ?? null,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? "",
        expiresAt,
      },
    });

    return NextResponse.redirect(
      new URL("/settings?calendar=connected", request.url)
    );
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(
      new URL("/settings?calendar=error&message=server_error", request.url)
    );
  }
}
