/* ===== Service Worker: シェル即時起動（cache-first）＋バージョン掃除 ===== */
'use strict';
const CACHE = 'cp-shell-v46';   /* 2026-08-24 s46＝🆕⑤スタッフの下位区分3択（パートナー様割引／アンバサダー契約店舗スタッフ／アンバサダー）をPC版b137と同格に。既定はパートナー様割引＝s45までと同じ動き */
/* 🔴版を上げた理由（app.js / index.html / style.css のどれかを変えたら必ず上げる）：
 *   キャッシュ名が同じままだと、端末に焼かれた**旧app.js・旧index.html**が cache-first でそのまま返り続ける＝直したものが届かない。
 *   ASSETSは1つのキャッシュ名で丸ごと管理しているので、版を上げるだけで全部入れ替わる。
 * 🔴履歴（版を上げたのに日付コメントが腐っていた反省。以後は同じ行で必ず両方を直す）：
 *   v37=2026-08-09 修身レイヤーのPWA同格化／v38=受診後FB／v39=（記録漏れ）／v40=2026-08-20 その撤廃。
 *   v42=2026-08-20 合鍵の正規化（URLごと貼りOK・iOSホーム画面アプリの別領域仕様への本線対応）／v41=?k=受け取り口。
 *   v43=2026-08-23 ✍️文体ラボのPWA同格化（報告タブ内の独立1画面＋📚手本/📥収穫/↻取り直し/🗂いまの手本の4口を新規配線）。
 *   v44=2026-08-23 その失敗表示の根治（原因を取り違えない）＋📚手本の複数欄。
 *   v45=2026-08-24 ✍️文体ラボを独立タブへ。変更したのは index.html と app.js（style.css は不変）。
 *   v46=2026-08-24 ⑤スタッフの下位区分（②）。変更＝index.html と app.js（style.css は不変）。 */
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
