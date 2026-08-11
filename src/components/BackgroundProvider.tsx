"use client";

import { useEffect } from "react";

export const BG_LS_KEY = "custom-background-image";

function applyBackground() {
  try {
    const custom = localStorage.getItem(BG_LS_KEY);
    if (custom) {
      document.documentElement.style.backgroundImage = `url(${custom})`;
    } else {
      // インラインスタイルを消してCSSのデフォルト(/background.jpg)に戻す
      document.documentElement.style.backgroundImage = "";
    }
  } catch {
    // localStorage が使えない環境ではスキップ
  }
}

/**
 * localStorageのカスタム背景をhtmlのbackground-imageに適用する。
 * 変更イベント "bg-changed" を受け取ると即時再適用する。
 */
export default function BackgroundProvider() {
  useEffect(() => {
    applyBackground();

    const handler = () => applyBackground();
    window.addEventListener("bg-changed", handler);
    return () => window.removeEventListener("bg-changed", handler);
  }, []);

  return null;
}
