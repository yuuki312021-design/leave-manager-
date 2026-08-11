import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { runReleaseNotifications } from "@/lib/release-notifier";
import { ADMIN_EMAIL } from "@/lib/utils";

// POST /api/admin/releases/notify — 即時通知実行
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runReleaseNotifications();
  return NextResponse.json({ ok: true, ...result });
}
