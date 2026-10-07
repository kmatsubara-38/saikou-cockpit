/* ===== Service Worker: シェル即時起動（cache-first）＋バージョン掃除 ===== */
'use strict';
const CACHE = 'cp-shell-v66';   /* 2026-10-06 s66＝b171 2秒ルール1段目（押した瞬間の反応・登録は受付番号つきで1回の照会・送り直し）／s65＝b170 Slack の画面を Slack と同じ使い心地に（書く欄を上・新しい順・絵文字の選び窓・⭐スター／チャンネル／DM・🔕解決・器をほかの画面に）／s64＝b169「Slack」の画面（チャンネル・スレッド・メンション・送信予約・添付・リアクション・要返信）／2026-10-04 s63＝b167「🧾 Notion CRM からつくる」を全員の①へ（②の登録からは外す）・保存済み（今日）／2026-10-04 s62＝監査の直し（書きかけ中は自動で読み直さない・90秒の時間切れ・?v=/?k= を控えない・申し送りの行き先）／2026-10-04 s61＝🔴公開ページの入力欄の例文から実在の方の名前を外した（架空の例へ）／2026-10-03 s60＝📔b165 を PWA へ同格化＝①報告タブの「🛡 毎日の運用」の先頭に📔日報（PC と同じ4問・同じ確かめ・{api:'nippoSheetLoad'／'nippoSheetSave'}）②紹介登録（view-shokai）を撤去＝紹介実績は患者様の②へ一本化 ③②に Notion CRM からのドラフト2本（{api:'regDraft'}・受診アドバイザー対応は {api:'advSave'} で SF へ）④api() の例外に失敗の返事（e.data）を載せる（日報の staleDate・url）⑤未来の箱は撤去（サーバの b165 と対）。Codex R7_pwa。index.html／app.js の2本・ASSETS 9件のまま。 s59＝📝b164 を PWA へ同格化＝①紹介登録と進捗②で、SF に性別が無いときだけ「性別（SFに未登録＝選ぶとSFへ書き込みます）」男性／女性／不明を出す（未選択なら送らない・Codex R4_sex／R4c）②索引ができたとき、開いている進捗があれば描き直さず「↻ 一覧を更新」。index.html／app.js の2本・ASSETS 9件のまま。 s58＝📝b162 を PWA へ同格化＝①紹介登録は SF患者リンクだけ（患者様名・予約申込日・性別の欄を撤去・{api:'cvPeek'} で読んで見せる）②患者様の進捗に「② 分析シート登録」（登録済み・受付済み・索引の範囲外にはボタンを出さない＝「更新」の文言も無い）③HOME の定期MTG（ホットリスト）カード撤去 ④b163＝患者様リストで②の索引が無い・古いときは {api:'regIdxWarm'} を1回呼んで描き直す。s57 が配信済みかは未確認＝版を上げて s56／s57 の古い殻を必ず入れ替える（b162 敵対監査 r3 の条件3）。index.html／app.js／sw.js の3本・ASSETS 9件のまま。 s57＝🧠右下ボタンを「ロビン（第二の脳）の鮮度と LINE 取込」に作り替え（PC 版 b158 と同格・{api:'robinStatus'}／{api:'robinSyncLine'}・提携先の最近のやり取りは2段目のボタンへ）。index.html／app.js／style.css の3本・ASSETS 9件のまま。 s56＝💫b157 メジャーアップデートを PWA へ同格化（Codex gpt-6-astra R4）＝①現れ＝#main の .card/.notif/.pcard に PC版と同じ .rv（IntersectionObserver 1本・.rdy→.in・段差 --rv-i 60ms×n 上限8・reduced-motion で停止・MutationObserver で描画後の要素も拾う）②フィードバック実施の誤申告＝patientList の r.atx（ミラー案内）を fbErr（本物の失敗）と分けて表示（サーバ b157 と対）③💬右下 FAB＝直近に🔎で開いた提携先（CTX）の Slack／LINE を {api:'chatPull'} で1往復して下からのシートに出す（サーバでマスク済 HTML）。index.html／app.js／style.css の3本・ASSETS 9件のまま（新ファイル無し）。 s55＝🏰b151 の仕上げを PWA へ同格化＝①金の面・赤の面の白文字を地色へ（.sched .mt 1.6:1→11.4:1／.badge 3.0:1→5.65:1）②「選ぶ」は金14%の洗い＋金文字（.chip.on／.seg-btn.active＝塗り潰しをやめる）③形は「操作＝角丸4px・状態＝ピル」（.btn／.chip を角丸4pxへ）と指で押せる44px。style.css のみ・app.js 無改修・ASSETS 9件のまま。 s54＝🏰ver.5 案A（Codex gpt-6-astra/ultra 設計）の値を PWA へ＝地#0d0d10・インク#f2f1ee・金#e4c38b・意味色3・角丸4px＋ピル・影なし（PC版 b150 と同格・style.css のみ・ASSETS 9件のまま・app.js 無改修）。s53＝🏞背景を松原のCodex画像「ラピュタ遺跡」に（＋🧭MVVの箱を中身の幅で中央へ＝PC版b149と同格・style.css のみ）（PC版b148と同格・bg.jpg 76KB＋縦持ち用 bg_p.jpg 127KB を ASSETS に追加＝9件・style.css の body::before/::after だけ・app.js は無改修）。s52＝🧭MVVの4行（私は／Mission／Vision／Value・正本R7 §11）をホーム最初の行に掲示（PC版b147と同格）。Missionの文言もR6→R7へ追従。読むだけ・入力ゼロ・API往復ゼロ＝index.htmlとstyle.cssだけの変更でapp.jsは無改修。s51＝🧭Missionをホーム最初の行に掲示（PC版b146と同格・松原「常に自分の欲求に振り切りたいから」）。読むだけ・入力ゼロ・API往復ゼロ＝index.htmlとstyle.cssだけの変更でapp.jsは無改修。ファイルは増えていない（ASSETS 7件のまま）。s50＝📚読書の写真を**何枚でもまとめて**（1冊ずつ自動登録・期限と進捗は一覧で）。s49＝配信の入口を直した。install の addAll が HTTPキャッシュ（Pagesは10分）を見ていたため、新品のキャッシュに古いHTMLが焼き込まれることがあった＝cache:'reload' を明示 */
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
 *   v55=2026-09-07 🏰b151 の仕上げの同格化（金の面・赤の面の白文字を地色へ／選ぶ＝金14%の洗い／操作は角丸4px・44px）。style.css のみ。v50〜v54 の要旨は CACHE 行の末尾。
 *   v66=2026-10-06 b171 2秒ルール1段目＝押した要素がすぐ光る・登録の照会は1回・受付番号で送り直し。app.js。
 *   v65=2026-10-06 b170 Slack の画面＝書く欄を上・新しい順・絵文字の選び窓（1,878件）・⭐スター／チャンネル／DM・🔕解決・器をほかの画面と同じに。app.js・index.html。
 *   v64=2026-10-05 b169 Slack の画面（下のタブに 💬 Slack）。app.js・index.html。
 *   v63=2026-10-04 b167 同格化（Notion CRM からつくる を全員の①へ・② の登録からは外す・保存済み（今日））。app.js。
 *   v62=2026-10-04 監査の直し（M-2 書きかけ中は読み直さない・M-3 api の時間切れ・m-1/m-2 ?v= と ?k= を控えない・M-5 申し送りの行き先）。app.js・sw.js。
 *   v61=2026-10-04 🔴入力欄の例文（予定登録・通知の宛先と本文・担当者名・管理番号）を架空の例へ。index.html だけ。
 *   v60=2026-10-03 📔b165 同格化（日報・紹介登録を②へ・②にCRMドラフト・api の e.data）。index.html・app.js。
 *   v59=2026-09-29 📝b164 同格化（SF に性別が無いときだけ性別を選ぶ・描き直しで進捗を閉じない）。index.html・app.js。
 *   v58=2026-09-29 📝b162 同格化（CV は SF リンクだけ・②分析シート登録・定期MTG撤去）。index.html・app.js。
 *   （v57 は未配信のまま 2026-09-26 に b159 の直し＝②は松原の判断待ちで止める・説明はサーバの文 を同梱）
 *   v57=2026-09-17 🧠ロビン同期（右下ボタンの作り替え・PC b158 と同格）。変更＝index.html・app.js・style.css。
 *   v56=2026-09-13 💫b157 メジャーアップデート同格化（現れ／atx／💬FAB）。変更＝index.html・app.js・style.css（sw.js は版のみ）。
 *   v50=2026-08-27 📚読書＝写真の複数添付→1冊ずつ自動登録／一覧の各行で期限を入れられるように（PC版b144と同格）。
 *   v51=2026-09-01 🧭Missionをホーム最初の行に掲示（PC版b146と同格）。変更＝index.html と style.css。
 *   v52=2026-09-06 🧭MVVの4行へ（正本R7 §11・PC版b147と同格）。変更＝index.html と style.css（app.js は不変）。
 *   v53=2026-09-06 🏞背景 bg.jpg／bg_p.jpg（殻9件）＋帳＋素の文字の面＋MVV中央（PC版b148/b149と同格）。変更＝index.html・style.css・sw.js。
 *   v54=2026-09-07 🏰ver.5 案A（Codex gpt-6-astra/ultra）の値＝地#0d0d10・インク#f2f1ee・金#e4c38b・意味色3・角丸4px＋ピル・影なし（PC版b150と同格）。変更＝style.css のみ。 */
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './bg.jpg',           /* 🏞s53：背景・横（76KB・オフラインでも出す＝殻の一部） */
  './bg_p.jpg'          /* 🏞s53：背景・縦持ち用（127KB・原本の中央〜右のアーチを9:16で切り出し。横900pxを縦に引き伸ばすとぼけるため） */
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
  /* 🆕s62（2026-10-04 監査 m-1・m-2）：版読み（?v=）と合鍵付きURL（?k=）は控えない＝毎回の控えが積もらない・合鍵が端末の控えに残らない */
  if (url.searchParams.has('v') || url.searchParams.has('k')) return;
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
