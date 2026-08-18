import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import Holidays from "date-holidays";
import { sendWebPush } from "@/lib/push";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

const hd = new Holidays("JP");

function isWeekendOrHoliday(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return true;
  return hd.isHoliday(d) !== false;
}

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function toTimeStr(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    "http://localhost" // refresh 用には redirect_uri 不要だがインスタンス化に必要
  );
}

// POST /api/calendar/fetch — 連携済みGoogleカレンダーから予定を取得して候補生成
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    const account = await prisma.calendarAccount.findFirst({
      where: { userId, provider: "google" },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Googleカレンダーが連携されていません" },
        { status: 400 }
      );
    }

    const oauth2Client = getGoogleOAuth2Client();
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.expiresAt.getTime(),
    });

    // access token が期限切れなら更新
    const expiryMarginMs = 60 * 1000;
    if (account.expiresAt.getTime() - Date.now() < expiryMarginMs) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (!credentials.access_token) {
        return NextResponse.json(
          { error: "アクセストークンの更新に失敗しました。再連携してください。" },
          { status: 401 }
        );
      }
      await prisma.calendarAccount.update({
        where: { id: account.id },
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token ?? account.refreshToken,
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : new Date(Date.now() + 3600 * 1000),
        },
      });
      oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const now = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(now.getDate() + 14);

    const eventsRes = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: twoWeeksLater.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const events = eventsRes.data.items ?? [];
    const existingEventIds = new Set(
      (
        await prisma.pendingLeaveSuggestion.findMany({
          where: { userId },
          select: { eventId: true },
        })
      ).map((s) => s.eventId)
    );

    const created: {
      id: number;
      title: string;
      startDate: string;
      isAllDay: boolean;
    }[] = [];

    for (const event of events) {
      if (!event.id || !event.summary) continue;
      if (existingEventIds.has(event.id)) continue;

      const start = event.start?.dateTime ?? event.start?.date;
      const end = event.end?.dateTime ?? event.end?.date;
      if (!start || !end) continue;

      const isAllDay = !event.start?.dateTime;
      const startDate = isAllDay
        ? new Date(start + "T00:00:00")
        : new Date(start);
      // 終日予定の end.date は exclusive なので1日戻す
      const endDate = isAllDay
        ? new Date(new Date(end + "T00:00:00").getTime() - 86400000)
        : new Date(end);

      if (isWeekendOrHoliday(startDate)) continue;

      // 複数日にまたがる終日予定は各日を個別の候補として生成
      const dates: Date[] = [];
      if (isAllDay) {
        for (
          let d = new Date(startDate);
          d.getTime() <= endDate.getTime();
          d.setDate(d.getDate() + 1)
        ) {
          if (!isWeekendOrHoliday(d)) {
            dates.push(new Date(d));
          }
        }
      } else {
        dates.push(startDate);
      }

      for (const d of dates) {
        const suggestion = await prisma.pendingLeaveSuggestion.create({
          data: {
            userId,
            calendarId: "primary",
            eventId: event.id,
            title: event.summary,
            startDate: toDateStr(d),
            endDate: toDateStr(d),
            startTime: isAllDay ? null : toTimeStr(startDate),
            endTime: isAllDay ? null : toTimeStr(endDate),
            isAllDay,
            status: "pending",
          },
        });
        created.push({
          id: suggestion.id,
          title: suggestion.title,
          startDate: suggestion.startDate,
          isAllDay: suggestion.isAllDay,
        });
      }
    }

    // プッシュ通知送信
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });
    for (const suggestion of created) {
      for (const sub of subscriptions) {
        await sendWebPush(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          {
            title: `有給取得の候補: ${suggestion.title}`,
            body: `${suggestion.startDate} の予定を有給取得登録しますか？`,
            icon: "/icon-192.png",
            data: {
              url: `/suggestions?id=${suggestion.id}`,
            },
          }
        ).catch((err) => console.error("[push] suggestion notify failed:", err));
      }
    }

    await prisma.pendingLeaveSuggestion.updateMany({
      where: { id: { in: created.map((c) => c.id) } },
      data: { notifiedAt: new Date() },
    });

    return NextResponse.json({ created: created.length, items: created });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "カレンダー予定の取得に失敗しました" },
      { status: 500 }
    );
  }
}
