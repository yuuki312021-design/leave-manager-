import { prisma } from "./prisma";
import { sendWebPush } from "./push";

/**
 * notified=false のリリースノートを全 PushSubscription に通知し、
 * 送信後 notified=true に更新する。
 * エラーがあってもクラッシュしない（try/catch で握りつぶす）。
 */
export async function runReleaseNotifications(): Promise<{
  releasesProcessed: number;
  notificationsSent: number;
  errors: number;
}> {
  let releasesProcessed = 0;
  let notificationsSent = 0;
  let errors = 0;

  try {
    // notified=false のリリースノートを取得
    const pendingReleases = await prisma.releaseNote.findMany({
      where: { notified: false },
      orderBy: { createdAt: "asc" },
    });

    if (pendingReleases.length === 0) {
      console.log("[release-notifier] 未通知のリリースノートはありません");
      return { releasesProcessed: 0, notificationsSent: 0, errors: 0 };
    }

    // 全 PushSubscription を取得
    const subscriptions = await prisma.pushSubscription.findMany();

    if (subscriptions.length === 0) {
      console.log("[release-notifier] 購読者がいないためスキップします");
      // notified=true に更新だけ行う
      await prisma.releaseNote.updateMany({
        where: { id: { in: pendingReleases.map((r) => r.id) } },
        data: { notified: true },
      });
      return { releasesProcessed: pendingReleases.length, notificationsSent: 0, errors: 0 };
    }

    for (const release of pendingReleases) {
      console.log(`[release-notifier] リリースノート通知: ${release.version} "${release.title}"`);
      releasesProcessed++;

      for (const sub of subscriptions) {
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            {
              title: `🆕 アプリ更新: ${release.title}`,
              body: release.body,
              icon: "/icon-192.png",
              data: { url: "/" },
            }
          );
          notificationsSent++;
        } catch (err) {
          console.error(
            `[release-notifier] 送信エラー (endpoint=${sub.endpoint.substring(0, 40)}...):`,
            err
          );
          errors++;
        }
      }

      // 送信完了後に notified=true へ更新
      try {
        await prisma.releaseNote.update({
          where: { id: release.id },
          data: { notified: true },
        });
      } catch (err) {
        console.error(`[release-notifier] notified 更新エラー (id=${release.id}):`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error("[release-notifier] 予期しないエラー:", err);
    errors++;
  }

  console.log(
    `[release-notifier] 完了: releases=${releasesProcessed}, sent=${notificationsSent}, errors=${errors}`
  );
  return { releasesProcessed, notificationsSent, errors };
}
