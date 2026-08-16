'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // ページ表示時に既存の Service Worker 更新を確認し、
          // 新しいバージョンがあれば即座に activate するよう促す
          registration.update().catch(() => {});

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新しい SW が待機中なら即座に skipWaiting させるメッセージを送信
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });

      // コントローラー更新時にページをリロード（新しい SW が即座に有効化された場合）
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }
  }, []);

  return null;
}
