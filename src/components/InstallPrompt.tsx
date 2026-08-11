"use client";

import { useEffect, useRef, useState } from "react";

// Chrome/Edge 独自イベントの型定義
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const LS_KEY_ANDROID = "pwa-install-dismissed";
const LS_KEY_IOS_AT = "pwa-ios-dismissed-at";
const IOS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30日
const SHOW_DELAY_MS = 1800;

type BannerState = "hidden" | "android" | "ios";

export default function InstallPrompt() {
  const [state, setState] = useState<BannerState>("hidden");
  const [installing, setInstalling] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // スタンドアロン（インストール済み）では何もしない
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const ua = navigator.userAgent;

    // iOS Safari 判定（CriOS = Chrome on iOS, FxiOS = Firefox on iOS は除外）
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);

    if (isIOS) {
      const dismissedAt = localStorage.getItem(LS_KEY_IOS_AT);
      if (dismissedAt && Date.now() - Number(dismissedAt) < IOS_COOLDOWN_MS) return;
      const timer = setTimeout(() => setState("ios"), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }

    // Chrome / Edge: beforeinstallprompt イベントを待つ
    if (localStorage.getItem(LS_KEY_ANDROID) === "true") return;

    let timer: ReturnType<typeof setTimeout>;
    const handler = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      timer = setTimeout(() => setState("android"), SHOW_DELAY_MS);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  // インストールダイアログを開く
  const handleInstall = async () => {
    if (!deferredRef.current) return;
    setInstalling(true);
    try {
      await deferredRef.current.prompt();
      const { outcome } = await deferredRef.current.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(LS_KEY_ANDROID, "true");
      }
    } finally {
      deferredRef.current = null;
      setInstalling(false);
      setState("hidden");
    }
  };

  const handleDismissAndroid = () => {
    localStorage.setItem(LS_KEY_ANDROID, "true");
    setState("hidden");
  };

  const handleDismissIOS = () => {
    localStorage.setItem(LS_KEY_IOS_AT, String(Date.now()));
    setState("hidden");
  };

  if (state === "hidden") return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="アプリをホーム画面に追加"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-5 md:w-96 z-50 animate-in"
      style={{ animation: "slideUp 0.25s ease-out" }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* ── Android / Chrome バナー ── */}
        {state === "android" && (
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* アプリアイコン */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-192.png"
                alt="有給管理 アイコン"
                width={48}
                height={48}
                className="rounded-xl flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">有給管理</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ホーム画面に追加してすばやくアクセス
                </p>
              </div>
              <button
                onClick={handleDismissAndroid}
                aria-label="閉じる"
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0 -mt-0.5"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <button
              onClick={handleInstall}
              disabled={installing}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {installing ? "インストール中..." : "アプリをインストール"}
            </button>
          </div>
        )}

        {/* ── iOS Safari ガイド ── */}
        {state === "ios" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-192.png"
                  alt="有給管理 アイコン"
                  width={36}
                  height={36}
                  className="rounded-xl"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">ホーム画面に追加</p>
                  <p className="text-xs text-slate-500">有給管理アプリ</p>
                </div>
              </div>
              <button
                onClick={handleDismissIOS}
                aria-label="閉じる"
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                  1
                </span>
                <span>
                  画面下部の{" "}
                  <span className="inline-flex items-center gap-0.5 font-medium text-slate-800">
                    共有ボタン
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="inline-block mb-0.5"
                      aria-hidden="true"
                    >
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </span>{" "}
                  をタップ
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                  2
                </span>
                <span>
                  「<strong className="text-slate-800">ホーム画面に追加</strong>」を選択
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                  3
                </span>
                <span>
                  右上の「<strong className="text-slate-800">追加</strong>」をタップして完了
                </span>
              </li>
            </ol>

            <button
              onClick={handleDismissIOS}
              className="mt-4 w-full border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium py-2 rounded-xl transition-colors"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
