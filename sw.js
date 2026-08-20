/* ===== Service Worker: シェル即時起動（cache-first）＋バージョン掃除 ===== */
'use strict';
const CACHE = 'cp-shell-v41';   /* 2026-08-20 s41＝合鍵付きURL（?k=を保存して即URLから消す）。s40=朝の儀式3カード撤廃+view-cal4修正 */
/* 🔴履歴（版を上げたのに日付コメントが腐っていた反省。以後は同じ行で必ず両方を直す）：
 *   v37=2026-08-09 修身レイヤーのPWA同格化／v38=受診後FB／v39=（記録漏れ）／v40=2026-08-20 その撤廃。 */
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* GET同一オリジンのみキャッシュ（APIのPOSTは素通し・データはapp側localStorageが持つ） */
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  ev.respondWith(
    caches.match(req).then(hit => {
      const refetch = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);           // オフライン時はキャッシュ
      return hit || refetch;          // キャッシュ即返し＋裏で更新（stale-while-revalidate）
    })
  );
});
