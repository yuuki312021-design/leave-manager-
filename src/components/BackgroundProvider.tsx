"use client";

import { useEffect } from "react";

export const BG_LS_KEY = "custom-background-image";

/**
 * 画像URLをCanvas（64×64）にサンプリングし、相対輝度の平均から
 * 背景テーマ ("light" | "dark") を返す。
 * 輝度平均 > 0.45 → light、それ以外 → dark
 */
async function analyzeBrightness(imageUrl: string): Promise<"light" | "dark"> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const SIZE = 64;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("dark");
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          // ITU-R BT.601 相対輝度
          total +=
            (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) /
            255;
        }
        resolve(total / (SIZE * SIZE) > 0.45 ? "light" : "dark");
      } catch {
        resolve("dark");
      }
    };
    img.onerror = () => resolve("dark");
    img.src = imageUrl;
  });
}

async function applyBackground() {
  try {
    const custom = localStorage.getItem(BG_LS_KEY);

    // 背景画像を即時適用（同期）
    if (custom) {
      document.documentElement.style.backgroundImage = `url(${custom})`;
    } else {
      // インラインスタイルを消してCSSのデフォルト(/background.jpg)に戻す
      document.documentElement.style.backgroundImage = "";
    }

    // 輝度分析して data-bg-theme を設定（非同期）
    const imageUrl = custom ?? "/background.jpg";
    const theme = await analyzeBrightness(imageUrl);
    document.documentElement.setAttribute("data-bg-theme", theme);
  } catch {
    // エラー時はデフォルトの暗いテーマを維持
    document.documentElement.setAttribute("data-bg-theme", "dark");
  }
}

/**
 * localStorageのカスタム背景をhtmlのbackground-imageに適用し、
 * 画像の輝度を分析して data-bg-theme 属性を設定する。
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
