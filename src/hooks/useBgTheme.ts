"use client";

import { useEffect, useState } from "react";

export type BgTheme = "dark" | "light";

/**
 * html要素の data-bg-theme 属性を監視し、背景の明暗テーマを返すフック。
 * BackgroundProvider が画像の輝度を分析して属性を更新すると即時反映される。
 * SSR では常に "dark"（デフォルト背景＝暗い建物写真）を返す。
 */
export function useBgTheme(): BgTheme {
  const [theme, setTheme] = useState<BgTheme>("dark");

  useEffect(() => {
    const update = () => {
      const val = document.documentElement.getAttribute("data-bg-theme");
      setTheme(val === "light" ? "light" : "dark");
    };

    // 初期値を即座に反映
    update();

    // data-bg-theme 属性の変化を監視
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "data-bg-theme") {
          update();
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bg-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
