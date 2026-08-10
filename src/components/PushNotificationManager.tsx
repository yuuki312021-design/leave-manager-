"use client";

import { useCallback, useEffect, useState } from "react";

interface PushStatus {
  pushEnabled: boolean;
  reminderTime: string;
  subscriptionCount: number;
}

interface PushNotificationManagerProps {
  /** 通知設定の変更を親に通知するコールバック */
  onStatusChange?: (status: PushStatus) => void;
}

// Base64URL → Uint8Array 変換（VAPID公開鍵のデコードに使用）
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export default function PushNotificationManager({
  onStatusChange,
}: PushNotificationManagerProps) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [permissionState, setPermissionState] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [subscribing, setSubscribing] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ブラウザの通知許可状態を取得
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermissionState("unsupported");
      return;
    }
    setPermissionState(Notification.permission);
  }, []);

  // サーバーから現在の購読状況を取得
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/push/status");
      if (!res.ok) return;
      const data: PushStatus = await res.json();
      setStatus(data);
      onStatusChange?.(data);
    } catch {
      // ignore
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ブラウザの通知許可をリクエストし、SW購読を作成してDBに保存する
  const handleSubscribe = async () => {
    setErrorMsg("");
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setErrorMsg("このブラウザはプッシュ通知に対応していません");
      return;
    }

    setSubscribing(true);
    try {
      // 1. 通知許可をリクエスト
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission !== "granted") {
        setErrorMsg("通知が許可されませんでした");
        return;
      }

      // 2. Service Worker を取得
      const reg = await navigator.serviceWorker.ready;

      // 3. VAPID公開鍵で購読（空の場合はapplicationServerKeyなしで試みる）
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const subscribeOptions: PushSubscriptionOptionsInit = vapidKey
        ? { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }
        : { userVisibleOnly: true };

      const pushSub = await reg.pushManager.subscribe(subscribeOptions);
      const json = pushSub.toJSON();
      const keys = json.keys as { p256dh?: string; auth?: string } | undefined;

      // 4. DBに保存
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: keys?.p256dh ?? "",
          auth: keys?.auth ?? "",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "購読の保存に失敗しました");
      }

      await fetchStatus();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "購読に失敗しました");
    } finally {
      setSubscribing(false);
    }
  };

  // SW購読を解除してDBからも削除する
  const handleUnsubscribe = async () => {
    setErrorMsg("");
    setUnsubscribing(true);
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.getSubscription();

      if (pushSub) {
        const endpoint = pushSub.endpoint;
        await pushSub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      await fetchStatus();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "購読解除に失敗しました");
    } finally {
      setUnsubscribing(false);
    }
  };

  const isSubscribed =
    status !== null && status.subscriptionCount > 0 && permissionState === "granted";

  if (permissionState === "unsupported") {
    return (
      <p className="text-sm text-slate-400">
        このブラウザはプッシュ通知に対応していません
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 購読状態バッジ */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            isSubscribed
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSubscribed ? "bg-green-500" : "bg-slate-400"
            }`}
          />
          {isSubscribed ? "受信中" : "未設定"}
        </span>
        {status !== null && status.subscriptionCount > 1 && (
          <span className="text-xs text-slate-400">
            （{status.subscriptionCount} 端末）
          </span>
        )}
      </div>

      {/* 操作ボタン */}
      {!isSubscribed ? (
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={subscribing}
          className="btn-primary text-sm"
        >
          {subscribing ? "設定中..." : "通知を許可する"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={unsubscribing}
          className="btn-secondary text-sm"
        >
          {unsubscribing ? "解除中..." : "この端末の通知を解除する"}
        </button>
      )}

      {/* 許可済みだが購読未設定の補足 */}
      {permissionState === "granted" && !isSubscribed && (
        <p className="text-xs text-slate-400">
          ブラウザの通知許可は取得済みです。「通知を許可する」で購読を開始できます。
        </p>
      )}

      {/* 拒否された場合 */}
      {permissionState === "denied" && (
        <p className="text-xs text-amber-600">
          通知がブロックされています。ブラウザの設定から許可してください。
        </p>
      )}

      {/* エラー */}
      {errorMsg && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
