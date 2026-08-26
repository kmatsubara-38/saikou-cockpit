/* ===== Service Worker: シェル即時起動（cache-first）＋バージョン掃除 ===== */
'use strict';
const CACHE = 'cp-shell-v50';   /* 2026-08-27 s50＝📚読書の写真を**何枚でもまとめて**（1冊ずつ自動登録・期限と進捗は一覧で）。s49＝配信の入口を直した。install の addAll が HTTPキャッシュ（Pagesは10分）を見ていたため、新品のキャッシュに古いHTMLが焼き込まれることがあった＝cache:'reload' を明示 */
/* 🔴版を上げた理由（app.js / index.html / style.css のどれかを変えたら必ず上げる）：
 *   キャッシュ名が同じままだと、端末に焼かれた**旧app.js・旧index.html**が cache-first でそのまま返り続ける＝直したものが届かない。
 *   ASSETSは1つのキャッシュ名で丸ごと管理しているので、版を上げるだけで全部入れ替わる。
 * 🔴履歴（版を上げたのに日付コメントが腐っていた反省。以後は同じ行で必ず両方を直す）：
 *   v37=2026-08-09 修身レイヤーのPWA同格化／v38=受診後FB／v39=（記録漏れ）／v40=2026-08-20 その撤廃。
 *   v42=2026-08-20 合鍵の正規化（URLごと貼りOK・iOSホーム画面アプリの別領域仕様への本線対応）／v41=?k=受け取り口。
 *   v43=2026-08-23 ✍️文体ラボのPWA同格化（報告タブ内の独立1画面＋📚手本/📥収穫/↻取り直し/🗂いまの手本の4口を新規配線）。
 *   v44=2026-08-23 その失敗表示の根治（原因を取り違えない）＋📚手本の複数欄。
 *   v45=2026-08-24 ✍️文体ラボを独立タブへ。変更したのは index.html と app.js（style.css は不変）。
 *   v46=2026-08-24 ⑤スタッフの下位区分（②）。変更＝index.html と app.js（style.css は不変）。
 *   v47=2026-08-26 📖読書を「⋯その他」タブへ（PC版b142と同格・doPost5口）。
 *   v48=2026-08-26 📷その写真の入口の不具合を修理＝capture を外した（カメラ直行で、撮り溜めた写真を選べなかった）。
 *     🔴同時に**レシート(rcFile)**の capture も外した＝前から同じ状態で、ラベルは「撮影 / 画像を選択」と言っていた。
 *     PC版のレシート(fi_rcpt)は元から capture 無し＝スマホだけが食い違っていた（parity違反の解消）。
 *   v49=2026-08-26 🔴**版を上げても届かないことがある**穴を塞いだ＝install の addAll に cache:'reload'。
 *     あわせて裏の更新を ev.waitUntil で最後まで走らせ、オフラインで控えも無いときに undefined を返さないようにした。
 *   v50=2026-08-27 📚読書＝写真の複数添付→1冊ずつ自動登録／一覧の各行で期限を入れられるように（PC版b144と同格）。 */
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
  /* 🔴2026-08-26 s49：`c.addAll(ASSETS)` は**既定でHTTPキャッシュを見に行く**。
   *   GitHub Pages は `Cache-Control: max-age=600` を返す（実測・Age 525 を確認）ので、
   *   直前10分以内に一度開いていると、**新品のキャッシュに古い index.html / app.js が焼き込まれる**。
   *   版だけ上げても直したものが届かない＝「更新したのに変わらない」の正体のひとつ。
   *   → `cache: 'reload'` で毎回ネットワークから取り直す（配信の入口だけは絶対に妥協しない）。 */
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
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
        if (!res || !res.ok) return res;
        const copy = res.clone();
        /* 🔴書き込みを待つ形にする＝SWが止められても控えが消えない（put は誰にも待たれていなかった） */
        return caches.open(CACHE).then(c => c.put(req, copy)).then(() => res);
      }).catch(() => hit || Response.error());   // 🔴オフラインで控えも無いときに undefined を返さない
      /* 裏の更新も最後まで走らせる。呼べない状況（既に解決済み等）でも本流を止めない */
      try { ev.waitUntil(refetch); } catch (e) {}
      return hit || refetch;          // キャッシュ即返し＋裏で更新（stale-while-revalidate）
    })
  );
});
