/* ===== 個人コックピット PWA app.js（依存ゼロ・PCブラウザ版パリティ 2026-07-23） ===== */
'use strict';

/* ---- CONFIG（既定値。URLはセットアップ画面から上書き可能） ---- */
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycby7wBMCZ8Wxlxd2dQX46TB0tdsf3fPJl90xcVxOPsndTVneOBNE0X5zaA6896tYRYXTrA/exec'
};
const LS = {
  KEY: 'cp_key',            // 合鍵（初回入力・端末ローカルのみ）
  URL: 'cp_url',            // GAS URL上書き
  HOME: 'cp_cache_home',    // 最終取得 home
  NOTIF: 'cp_cache_notifs'  // 最終取得 notifs
};

const $ = (id) => document.getElementById(id);
const gasUrl = () => localStorage.getItem(LS.URL) || CONFIG.GAS_URL;

/* 画面に出す版数＝配信されているsw.jsのCACHE名から読む（手書きだと更新し忘れてずれる） */
let APP_VER = '';
(function readVer() {
  fetch('sw.js?v=' + Date.now()).then(r => r.text()).then(t => {
    const m = t.match(/cp-shell-(v\d+)/);
    if (m) {
      APP_VER = 's' + m[1].slice(1);
      const u = document.getElementById('updatedAt');
      if (u && u.textContent && u.textContent.indexOf(' · ') < 0) u.textContent += ' · ' + APP_VER;
    }
  }).catch(() => {});
})();

/* ==== 📊計測のPWA同格化（2026-08-07 第2手の第2弾）====
 * 取るのは3つだけ＝表示ms・操作（api名）・エラー数。中身は数字と名前だけ＝本文・患者様情報は最初から読まない。
 * 送りは既存の{api:'home'}に同乗＝計測のための往復はゼロ。サーバがok:trueと言った時だけ控えを消す。 */
const MET_LS = 'cp_met';
let MET = (() => { try { return JSON.parse(localStorage.getItem(MET_LS) || '{}') || {}; } catch (e) { return {}; } })();
function metSave() {
  try {
    let s = JSON.stringify(MET);
    if (s.length > 6000) { MET = { v: MET.v || {}, c: {}, e: MET.e || {} }; s = JSON.stringify(MET); }   // 肥大時はタップ内訳から捨てる
    localStorage.setItem(MET_LS, s);
  } catch (e) {}
}
function metPg() { const t = document.querySelector('.tab.active'); return 'pwa' + ((t && t.dataset.view) || 'home'); }
function metView(pg, ms) {
  try { MET.v = MET.v || {}; const o = MET.v[pg] = MET.v[pg] || { n: 0, ms: 0 };
    o.n++; o.ms += Math.max(0, Math.min(60000, Math.round(ms || 0))); metSave(); } catch (e) {}
}
function metClick(f) {
  try { MET.c = MET.c || {}; const k9 = metPg() + ':' + f; MET.c[k9] = (MET.c[k9] || 0) + 1; metSave(); } catch (e) {}
}
function metErr() {
  try { MET.e = MET.e || {}; const p = metPg(); MET.e[p] = (MET.e[p] || 0) + 1; metSave(); } catch (e) {}
}
function metTake() { const m = MET; MET = {}; metSave(); return (m.v || m.c || m.e) ? m : null; }
function metBack(m) {
  if (!m) return;
  try {
    const mv = m.v || {}; Object.keys(mv).forEach(p => { MET.v = MET.v || {}; const o = MET.v[p] = MET.v[p] || { n: 0, ms: 0 };
      o.n += (mv[p] && mv[p].n) || 0; o.ms += (mv[p] && mv[p].ms) || 0; });
    const mc = m.c || {}; Object.keys(mc).forEach(k9 => { MET.c = MET.c || {}; MET.c[k9] = (MET.c[k9] || 0) + (mc[k9] || 0); });
    const me = m.e || {}; Object.keys(me).forEach(p => { MET.e = MET.e || {}; MET.e[p] = (MET.e[p] || 0) + (me[p] || 0); });
    metSave();
  } catch (e) {}
}

/* ---- APIコア：body=JSON文字列 / Content-Type text/plain（プリフライト回避） ---- */
async function api(payload) {
  const k = localStorage.getItem(LS.KEY);
  if (!k) { showSetup(); throw new Error('合鍵が未設定です'); }
  metClick(String(payload && payload.api || ''));   // 📊操作＝api名だけを数える（中身は見ない）
  const M9 = (payload && payload.api === 'home') ? metTake() : null;   // 📊homeの便にだけ同乗＝往復ゼロ増
  let res;
  try {
    res = await fetch(gasUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ k }, payload, M9 ? { met: M9 } : {})),
      redirect: 'follow'
    });
  } catch (e) {
    metBack(M9);   // 📊届かなかった控えは戻す＝次のhomeで再同乗
    setOffline(true);
    throw new Error('通信できません（オフラインまたはURL不正）: ' + e.message);
  }
  setOffline(!navigator.onLine);
  if (!res.ok) { metBack(M9); throw new Error('サーバー応答エラー HTTP ' + res.status); }
  let j;
  try { j = await res.json(); }
  catch (e) { metBack(M9); throw new Error('応答がJSONではありません（URL/デプロイ設定を確認）'); }
  if (!j.ok) {
    metBack(M9);
    if (j.error === 'auth') { showSetup('合鍵が一致しません。再入力してください。'); }
    if (j.error === 'unknown_api') {
      throw new Error('この機能はサーバー側が未開通です（GAS貼り替え＝doPost拡張の反映待ち）');
    }
    throw new Error('APIエラー: ' + (j.error || j.msg || '不明'));   // コックピットapi*は失敗時 msg で理由を返す＝黙殺しない
  }
  if (M9 && !(j.met && j.met.ok)) metBack(M9);   // 📊本体okでも計測だけ受け取れなかったなら控えは消さない
  return j;
}

/* ---- エラー/オフライン表示 ---- */
function showErr(msg) {
  try { metErr(); } catch (e) {}   // 📊エラー率＝削る回と品質監視の数字
  const b = $('errBox');
  if (!b) return;
  b.textContent = msg;
  b.classList.remove('hidden', 'ok');
  clearTimeout(showErr._t);
  showErr._t = setTimeout(() => b.classList.add('hidden'), 8000);
}
/* 🔴showOk は5箇所から呼ばれていたのに定義が無く、成功時に例外で止まっていた（2026-08-02 発見・修正）。
 *   同じ枠を使い、色だけ変えて「できた」を伝える。 */
/* ↩️「元に戻す」付きの成功表示（2026-08-05 第1手＝回復性）。切符が無ければ普通の表示 */
function showUndo(msg, token, after) {
  if (!token) { showOk(msg); return; }
  const b = $('errBox'); if (!b) return;
  b.classList.remove('hidden'); b.classList.add('ok');
  b.textContent = '';
  const sp = document.createElement('span'); sp.textContent = msg; b.appendChild(sp);
  const u = document.createElement('button'); u.className = 'chip'; u.style.marginLeft = '10px';
  u.textContent = '元に戻す';
  u.addEventListener('click', async () => {
    u.disabled = true; u.textContent = '戻しています…';
    try {
      const r = await api({ api: 'undo', token });
      if (r && r.ok) { showOk(r.msg || '戻しました'); if (after) after(); }
      else showErr((r && r.msg) || '戻せませんでした');
    } catch (e) { showErr(e.message); }
  });
  b.appendChild(u);
  clearTimeout(b._h); b._h = setTimeout(() => { b.classList.add('hidden'); b.classList.remove('ok'); }, 10000);
}
function showOk(msg) {
  const b = $('errBox');
  if (!b) return;
  b.textContent = msg;
  b.classList.remove('hidden');
  b.classList.add('ok');
  clearTimeout(showErr._t);
  showErr._t = setTimeout(() => { b.classList.add('hidden'); b.classList.remove('ok'); }, 3500);
}
function setOffline(off) {
  const b = $('offlineBanner');
  if (b) b.classList.toggle('hidden', !off);
}
window.addEventListener('online',  () => {
  setOffline(false);
  // 🔴過去月を表示中に当月の数字で塗り替えない（月は変わらないのに計器だけ動く誤読の防止）
  const sel = document.getElementById('hmSel');
  if (sel && sel.value && typeof loadHomeMonth === 'function') loadHomeMonth(sel.value);
  else loadHome();
});
window.addEventListener('offline', () => setOffline(true));

/* ---- キャッシュ（最終取得データ） ---- */
function saveCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
}
function readCache(key) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v && v.data; } catch (e) { return null; }
}

/* ---- タブ切替（5タブ：ホーム/通知/報告/生成/その他） ---- */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const v = $('view-' + btn.dataset.view);
    if (v) v.classList.remove('hidden');
    try { metView('pwa' + btn.dataset.view, 0) } catch (e) {}   // 📊タブ入場＝回数だけ（切替は即時なのでmsは0）
    if (btn.dataset.view === 'notif') loadNotifs();
    if (btn.dataset.view === 'home') loadHomeMonth();
    if (btn.dataset.view === 'pipe') plKindShow();   // 🔎入場時に選択中の一覧を読み込む
  });
});

/* ==== s12 報告タブ再設計（松原指示・世界一のダッシュボードへ）====
 * 全セクション=既定で閉じたアコーディオン（タイトルだけの一覧＝スクロール不要）＋
 * 並び=松原式二層【🔥日本一への一手】紹介→議事録→候補日時→カレンダー【🛡毎日の運用】出勤→勤怠→レシート。
 * HTMLは無傷＝JSで並び替え・開閉化（IDと既存リスナーは全て不変） */
(function () {
  const rep = document.getElementById('view-report');
  if (!rep) return;
  const cap = txt => { const d = document.createElement('div'); d.className = 'gcap'; d.textContent = txt; return d; };
  const frag = document.createDocumentFragment();
  frag.appendChild(cap('🔥 日本一への一手'));
  /* 🔴2026-08-20 b120で発見・同乗修正：'view-cal' は**実在しないid**だった（実体は index.html の `view-cal4`）。
   *   そのため「🗓カレンダー登録」だけ【🔥日本一への一手】に入らず、報告タブの最下部に取り残されていた。
   *   idの綴り違いは `if (s)` に黙って吸われる＝例外も出ない。並び替え台帳は実在idで書くこと。 */
  ['view-shokai', 'view-gijiroku', 'view-slotf', 'view-cal4'].forEach(id => { const s = document.getElementById(id); if (s) frag.appendChild(s); });
  frag.appendChild(cap('🛡 毎日の運用'));
  ['view-shukkin', 'view-kintai', 'view-receipt'].forEach(id => { const s = document.getElementById(id); if (s) frag.appendChild(s); });
  rep.insertBefore(frag, rep.firstChild);
  rep.querySelectorAll(':scope > div[id^="view-"]').forEach(sec => {
    const h = sec.querySelector('.sec-title');
    if (!h) return;
    const chev = document.createElement('span');
    chev.className = 'accv';
    chev.textContent = '▾';
    h.appendChild(chev);
    h.classList.add('acch');
    sec.classList.add('accsec', 'cls');   // 既定=閉（状態は保持しない＝毎回スマートな初期観）
    h.addEventListener('click', () => sec.classList.toggle('cls'));
  });
})();

/* ==== 月ユーティリティ（ホーム/アーカイブの月セレクタ共通） ==== */
function ymNow() {
  const d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}
function ymShift(ym, n) {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return ymNow();
  const d = new Date(+m[1], +m[2] - 1 + n, 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}
function ymLabel(ym) {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  return m ? m[1] + '年' + (+m[2]) + '月' : '–';
}

/* ==== ホーム計器 ==== */
const yen = n => (n == null ? '–' : '¥' + Number(n).toLocaleString('ja-JP'));
let hmYm = ymNow();   // ホームの表示月

function setSkeleton(on) {
  ['pjtN', 'mtgN', 'uriShoshin', 'uriSaishin', 'uriGokei'].forEach(id => {
    const e = $(id);
    if (e) e.classList.toggle('skel', !!on);
  });
}

function renderGauges(d) {
  // PJT紹介
  const r = d.refer || {};
  $('pjtN').textContent = r.pjt != null ? r.pjt : '–';
  $('pjtGoal').textContent = r.goal != null ? r.goal : 20;
  $('pjtBar').style.width = Math.min(100, (r.pjt || 0) / (r.goal || 20) * 100) + '%';
  $('pjtDetail').textContent = r.err
    ? '読取エラー: ' + r.err
    : `総数${r.total ?? '–'}｜自然${r.shizen ?? '–'}・スタッフ${r.staff ?? '–'}・巻き込み${r.maki ?? '–'}%`;
  // 定期MTG
  const m = d.mtg || {};
  $('mtgN').textContent = m.n != null ? m.n : '–';
  $('mtgGoal').textContent = m.goal != null ? m.goal : 20;   // homeMonth応答（cpMtg_生値）はgoal無し＝当月契約と同じ20で補完
  $('mtgBar').style.width = Math.min(100, (m.n || 0) / (m.goal || 20) * 100) + '%';
  $('mtgDetail').textContent = m.err ? '読取エラー: ' + m.err
    : m.pre ? '計測ルールは2026年7月開始＝この月は対象外'
    : `実施済 ${m.done ?? '–'}`;
  // 売上報酬
  const u = d.uri || {};
  $('uriShoshin').textContent = yen(u.shoshin);
  $('uriSaishin').textContent = yen(u.saishin);
  $('uriGokei').textContent  = yen(u.gokei);
  // 注記＝初診/再診の受診数と単価（松原指定 2026-07-27）。単価=売上÷件数の四捨五入
  const uf = (label, total, cnt) => cnt
    ? `${label}：受診${cnt}名/単価${Math.round((total || 0) / cnt).toLocaleString('ja-JP')}円`
    : `${label}：受診0名`;
  $('uriDetail').textContent = u.err
    ? '読取エラー: ' + u.err
    : uf('初診', u.shoshin, u.shoshinN) + '　' + uf('再診', u.saishin, u.saishinN);
}

function renderHome(d) {
  renderGauges(d);
  // スケジュール
  const ul = $('schedList');
  ul.innerHTML = '';
  const sched = d.sched || [];
  // 🔴読めなかったことを「無い」と混同しない（予定があるのに"なし"と出す事故の防止）
  if (d.schedErr) ul.innerHTML = '<li class="muted">⚠️ 予定を読めませんでした：' + esc(d.schedErr) + '</li>';
  else if (!sched.length) ul.innerHTML = '<li class="muted">今日の予定はありません</li>';
  // 🔴描き方は schedLi4 に一本化（Meetボタンを片方だけ出す食い違いを作らない・2026-08-02）
  sched.forEach(s => ul.appendChild(schedLi4(s)));
  lastSched = sched;
  schedApply(schedOpen());   // 🆕開閉状態を再適用（閉時=ヘッダ右の「次の予定」を最新化）
  scFillLinks4();            // 📹説明文に入らないMeetをあとから埋める（一覧は作り直さない）
  // 通知バッジ・更新時刻
  setBadge(d.notifUnread || 0);
  // 🔴版数は手書きしない（s19のまま固まっていた実害）。実際に動いているService Workerから読む
  $('updatedAt').textContent = (d.updated ? '更新 ' + d.updated : '') + (APP_VER ? ' · ' + APP_VER : '');
}

/* ==== 🆕2026-07-24 任務A：スケジュール開閉（ブラウザ版cpSchedOpenとは別キー cp_sched_open・既定=開） ====
 * 閉じていても「次の予定1件」（現在時刻以降の最初の非ルーティン予定）をヘッダ右に常時表示。
 * 配線は起動時1回のaddEventListenerのみ（PWAは再初期化ループなし＝二重化しない） */
const LS_SCHED = 'cp_sched_open';
let lastSched = [];

function schedOpen() {
  try { return localStorage.getItem(LS_SCHED) !== '0'; } catch (e) { return true; }
}
function schedNextTxt() {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  let allday = '';
  for (const s of lastSched) {
    if (!s || s.routine) continue;
    const t = String(s.t || '');
    const ttl = String(s.title || '').trim();
    if (t.indexOf('終日') >= 0) { if (!allday) allday = '終日 ' + ttl.slice(0, 18); continue; }
    const m = t.match(/^(\d{1,2}):(\d{2})/);
    if (!m) continue;
    if ((+m[1]) * 60 + (+m[2]) >= cur) return m[1] + ':' + m[2] + ' ' + ttl.slice(0, 18);
  }
  return allday;
}
function schedApply(open) {
  const b = $('schedList'), c = $('schedChev'), n = $('schedNext');
  if (!b) return;   // 旧キャッシュHTML対策のnullガード
  b.classList.toggle('hidden', !open);
  if (c) c.style.transform = open ? '' : 'rotate(-90deg)';
  if (n) {
    if (open) { n.classList.add('hidden'); n.textContent = ''; }
    else {
      const t = schedNextTxt();
      n.textContent = t ? '次 ' + t : '本日これ以降の予定なし';
      n.classList.remove('hidden');
    }
  }
}
if ($('schedHead')) {
  const schedTgl = () => {
    const open = $('schedList') ? $('schedList').classList.contains('hidden') : true;   // 閉→開／開→閉
    schedApply(open);
    try { localStorage.setItem(LS_SCHED, open ? '1' : '0'); } catch (e) {}
  };
  $('schedHead').addEventListener('click', schedTgl);
  $('schedHead').addEventListener('keydown', ev => { if (ev.key === 'Enter') schedTgl(); });
}

async function loadHome() {
  const cached = readCache(LS.HOME);
  if (cached) renderHome(cached);           // まずキャッシュを即描画
  try {
    const d = await api({ api: 'home' });
    if (!d.schedErr) saveCache(LS.HOME, d);   // 🔴読めなかった中身を保存すると次回も"予定なし"が出続ける
    renderHome(d);
  } catch (e) {
    if (!cached) $('schedList').innerHTML = '<li class="muted">取得失敗</li>';
    showErr(e.message);
  } finally {
    setSkeleton(false);
  }
}

/* 🆕月セレクタ：当月=既存{api:'home'}経路そのまま／過去月={api:'homeMonth', ym}（計器のみ差替・リロードなし） */
async function loadHomeMonth() {
  const seq = (loadHomeMonth._seq = (loadHomeMonth._seq || 0) + 1);   // 連打ガード＝最後の要求だけ描画（古い応答の後着上書きを防止）
  hmSelSync();
  if (hmYm === ymNow()) { setSkeleton(true); await loadHome(); return; }
  setSkeleton(true);
  try {
    const d = await api({ api: 'homeMonth', ym: hmYm });
    if (seq !== loadHomeMonth._seq) return;
    renderGauges(d);
    $('schedList').innerHTML = '<li class="muted">スケジュールは当月表示のみ（' + esc(ymLabel(hmYm)) + 'の計器を表示中）</li>';
    $('updatedAt').textContent = ymLabel(hmYm) + 'の実績';
  } catch (e) {
    if (seq !== loadHomeMonth._seq) return;
    showErr(e.message);
    hmYm = ymNow();   // エラー復元＝当月へ復帰（ブラウザ版hmFailと同等・古い月の計器を出しっぱなしにしない）
    hmSelSync();
    const cached = readCache(LS.HOME);
    if (cached) renderGauges(cached);
  } finally {
    if (seq === loadHomeMonth._seq) setSkeleton(false);
  }
}
/* 月セレクタ＝プルダウン（2026-07-27 松原指示）。2024-01起点＝ブラウザ版アーカイブと同じ遡り */
function hmSelFill() {
  const sel = $('hmSel');
  if (!sel || sel.options.length) return;
  const cur = ymNow();
  for (let ym = cur; ym >= '2024-01'; ym = ymShift(ym, -1)) {
    const op = document.createElement('option');
    op.value = ym;
    op.textContent = ymLabel(ym) + (ym === cur ? '（当月）' : '');
    sel.appendChild(op);
  }
}
function hmSelSync() {
  hmSelFill();
  const sel = $('hmSel');
  if (sel) sel.value = hmYm;
}
if ($('hmSel')) {
  hmSelFill();
  $('hmSel').addEventListener('change', () => { hmYm = $('hmSel').value || ymNow(); loadHomeMonth(); });
}

/* ==== 通知 ==== */
function setBadge(n) {
  const b = $('notifBadge');
  b.textContent = n > 99 ? '99+' : n;
  b.classList.toggle('hidden', !n);
}

function renderNotifs(d) {
  const box = $('notifList');
  box.innerHTML = '';
  const items = d.items || [];
  setBadge(d.unread || 0);
  if (d.nodb || d.missing) {
    box.innerHTML = '<div class="muted pad">⚠️ 通知の保管先が見つかりません（承認待ちが埋もれている可能性があります）</div>';
    return;
  }
  if (!items.length) { box.innerHTML = '<div class="muted pad">通知はありません</div>'; return; }
  items.forEach(it => {
    const div = document.createElement('div');
    // ステータス値はコックピット側と同じ日本語（未読/既読/完了）
    div.className = 'notif' + (it.status === '未読' || it.status === '' || it.status == null ? ' unread' : '');
    const actions = [];
    if (it.needAction && it.status !== '完了' && it.refTs) {
      actions.push(`<button class="btn btn-small btn-approve" data-act="approve" data-ref="${escAttr(it.refTs || '')}">承認</button>`);
    }
    if (it.status === '未読' || it.status === '' || it.status == null) {
      actions.push(`<button class="btn btn-small" data-act="read" data-ts="${escAttr(it.ts || '')}">既読</button>`);
    }
    div.innerHTML =
      `<div class="notif-head"><span>${esc(it.kind || '')}</span><span>${esc(it.date || '')}</span></div>` +
      `<div class="notif-title">${esc(it.title || '')}</div>` +
      `<div class="notif-body">${esc(it.body || '')}</div>` +
      (actions.length ? `<div class="notif-actions">${actions.join('')}</div>` : '');
    box.appendChild(div);
  });
}

$('notifList').addEventListener('click', async ev => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  /* 🔒申し送り承認＝SF書込（外部反映）なので楽観化しない＝従来どおりサーバ確認 */
  if (btn.dataset.act === 'approve') {
    btn.disabled = true;
    try { await api({ api: 'approve', refTs: btn.dataset.ref }); await loadNotifs(true); }
    catch (e) { btn.disabled = false; showErr(e.message); }
    return;
  }
  /* ⚡第4手のPWA同格化：既読は押した瞬間に薄くなる→失敗なら戻して理由を言う */
  const card = btn.closest('.notif');
  const pv = card ? card.style.opacity : '';
  if (card) card.style.opacity = '.45';
  btn.disabled = true;
  try {
    await api({ api: 'notifRead', ts: btn.dataset.ts });
    await loadNotifs(true);
  } catch (e) {
    if (card) card.style.opacity = pv;
    btn.disabled = false;
    showErr(e.message);
  }
});

$('btnReadAll').addEventListener('click', async () => {
  try { await api({ api: 'notifReadAll' }); await loadNotifs(true); }
  catch (e) { showErr(e.message); }
});

async function loadNotifs(force) {
  const cached = readCache(LS.NOTIF);
  if (cached && !force) renderNotifs(cached);
  try {
    const d = await api({ api: 'notifs' });
    saveCache(LS.NOTIF, d);
    renderNotifs(d);
  } catch (e) {
    if (!cached) $('notifList').innerHTML = '<div class="muted pad">取得失敗</div>';
    showErr(e.message);
  }
}

/* ==== 勤怠（自由記述・2026-07-23刷新）====
 * ボタン打刻を廃止し {api:'kintaiFree', text} を送信（GAS側は旧 {api:'kintai'} も後方互換で受ける）。
 * 応答msgには「◯月◯日の勤怠を記録（出勤…/退勤…/残業…）」が入る＝画面に残して音声入力の言い間違いを読み返しで検知 */
async function sendKintai() {
  const text = $('ktText').value.trim();
  const out = $('ktResult');
  if (!text) {
    out.className = 'result ng';
    out.textContent = '勤怠の内容を書いて（話して）から送信してください';
    return;
  }
  out.className = 'result';
  out.textContent = '送信中…（AIが日付・時刻を解析します）';
  $('btnKintaiSend').disabled = true;
  renderZangyo(null);   // 新しい報告の解析中は前回のテンプレを畳む
  try {
    const d = await api({ api: 'kintaiFree', text });
    out.className = 'result ok';
    out.textContent = '✅ ' + (d.msg || '勤怠を記録しました');   // 確定内容はクリアせず画面に残す（読み返し用）
    $('ktText').value = '';
    renderZangyo(d.fields || null);   // 🆕残業ありならテンプレプレビュー＋承認ボタン表示
  } catch (e) {
    out.className = 'result ng';
    out.textContent = e.message;
  } finally {
    $('btnKintaiSend').disabled = false;
  }
}
$('btnKintaiSend').addEventListener('click', sendKintai);

/* ==== 🆕2026-07-23 残業報告テンプレ→Slack承認送信 ====
 * apiKintaiFree応答のfields（残業あり時のみ表示）→テンプレを完全再現プレビュー→✅タップで {api:'zangyoReport'}。
 * 送信本文はサーバ側で再構築（ここでの文字列は表示専用）。二重送信防止＝サーバのCP_ZHO_SENT＋ボタンdisabled */
let zhoFields = null;

function zhoText(f) {
  const yb = f.youbi || ['日', '月', '火', '水', '木', '金', '土'][new Date(String(f.date) + 'T00:00:00+09:00').getDay()] || '';
  const it = (f.items || []).map(x => '・' + x).join('\n');
  return '▼残業報告　※' + String(f.date || '').replace(/-/g, '/') + '（' + yb + '）\n' +
    '・残業時間\n　' + (f.zangyoStart || '') + '～' + (f.taikin || '') + '\n\n▼詳細\n' + it;
}

/* 🔴2026-07-31 松原指示：読むだけ→直せる欄へ。下書きはサーバから取る
 *   （覚えた言い回しが当たった状態で返る）。通信前でも手元の型をまず出す＝待たせない。 */
/* 🔴zhoAuto＝いま自動で入れた本文。遅れて届いた下書きが書きかけを消さないようにする。
 *   zhoBase＝下書きの合言葉（サーバが「下書きを見て直した」と確認できたときだけ覚える）。 */
let zhoAuto = '', zhoBase = '';

function zhoFill(t) { const e = $('ktZhoTxt'); if (e) { e.value = t || ''; zhoAuto = t || ''; } }

async function zhoDraft(force) {
  if (!zhoFields) return;
  try {
    const d = await api({ api: 'zangyoReport', payload: Object.assign({}, zhoFields, { draft: true }) });
    if (!(d && d.text)) return;
    zhoBase = d.base || '';
    const e = $('ktZhoTxt');
    if (force !== true && e && e.value !== zhoAuto) return;   // 松原が触っている＝消さない
    zhoFill(d.text);
  } catch (e) { /* 取れなければ手元の型のまま＝止めない */ }
}

function renderZangyo(f) {
  const box = $('ktZho'), none = $('ktZhoNone'), btn = $('btnZhoSend'), res = $('ktZhoRes');
  if (!box || !none || !btn) return;   // 旧キャッシュHTML対策のnullガード
  zhoFields = null;
  if (!f || f.zangyoNone || !f.zangyoAri || !f.zangyoStart || !f.taikin || !(f.items && f.items.length)) {
    box.classList.add('hidden');
    none.classList.toggle('hidden', !(f && f.zangyoNone));   // 残業なし＝プレビュー非表示＋注記のみ
    return;
  }
  zhoFields = f;
  zhoBase = '';
  zhoFill(zhoText(f));
  zhoDraft(true);
  if (res) { res.className = 'result'; res.textContent = f.sent ? 'この日付の残業報告は送信済みです' : ''; }
  btn.disabled = !!f.sent;
  btn.textContent = f.sent ? '送信済み' : '✅ Slackへ残業報告（@channel）';
  none.classList.add('hidden');
  box.classList.remove('hidden');
}

if ($('btnZhoSend')) $('btnZhoSend').addEventListener('click', async () => {   // 旧キャッシュindex.html（v3以前）とのSW更新すれ違いでも全体を壊さない
  if (!zhoFields) return;
  const btn = $('btnZhoSend'), res = $('ktZhoRes');
  btn.disabled = true;   // 二重送信防止（サーバ側CP_ZHO_SENTフラグと二段構え）
  res.className = 'result';
  res.textContent = '送信中…';
  try {
    const tx = ($('ktZhoTxt').value || '').trim();
    if (!tx) { res.className = 'result ng'; res.textContent = '本文が空です'; btn.disabled = false; return; }
    const d = await api({ api: 'zangyoReport', payload: Object.assign({}, zhoFields, { text: tx, base: zhoBase }) });
    res.className = 'result ok';
    res.textContent = '✅ ' + (d.msg || 'Slackへ送信しました');
    btn.textContent = '送信済み';
  } catch (e) {
    res.className = 'result ng';
    res.textContent = e.message;
    btn.disabled = false;   // 失敗時のみ再試行可
  }
});

/* ==== 🆕2026-07-24 出勤時間報告（フレックス）→Slack承認送信 ====
 * 日付+出勤時刻→テンプレを完全再現プレビュー→✅タップで {api:'shukkinReport', date, time}。
 * 送信本文はサーバ側で再構築（ここでの文字列は表示専用）。二重送信防止＝サーバCP_SHUKKIN_SENT＋ボタンdisabled */
function skNorm(x) {
  x = String(x || '').trim()
    .replace(/[０-９：]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/時半/, ':30').replace(/時/, ':').replace(/分$/, '');
  if (/^\d{3,4}$/.test(x)) x = x.slice(0, -2) + ':' + x.slice(-2);
  if (/^\d{1,2}$/.test(x)) x += ':00';
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(x) ? x : null;
}

function skTpl(dt, t) {
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const tom = new Date(Date.now() + 33 * 3600e3).toISOString().slice(0, 10);
  const d = new Date(dt + 'T00:00:00+09:00');
  const yb = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] || '';
  const when = dt === today ? '本日' : (dt === tom ? '明日' : (d.getMonth() + 1) + '/' + d.getDate() + '（' + yb + '）は');
  // 🔴時刻は全角コロン（2026-07-27の根治）。半角のままだと🙋が :raising_hand: として保存され
  //   直前のコロンと「:30出勤です:」という偽の絵文字コードを作り、スマホのSlackで空白になる。
  //   v15で「画面の本文がそのまま送信される」ようになったため、ここがズレると実害になる。
  return '@channel\nおはようございます！\nいつも有り難うございます🍀\n\n▼共有\n' +
    when + String(t).replace(/^0/, '').replace(':', '：') + '出勤です🙋\n\nどうぞよろしくお願いいたします！';
}

/* 🔴skAuto＝いま自動で入れた本文。松原が触っていない時だけ入れ替える（2026-07-31 監査）。
 *   skBase＝下書きの合言葉。skKey＝いま表示中の日付+時刻。 */
let skAuto = '', skBase = '', skKey = '';

async function skDraft(dt, tm) {
  try {
    const d = await api({ api: 'shukkinReport', date: dt, time: tm, draft: true });
    if (!(d && d.text)) return;
    skBase = d.base || '';
    const e = $('skTxt');
    if (e && e.value === skAuto) { e.value = d.text; skAuto = d.text; }   // 触られていない時だけ
  } catch (e) { /* 取れなければ手元の型のまま＝止めない */ }
}

/* 🔴日付・時刻が変わったら本文を必ず作り直す（2026-07-31 監査）。
 *   以前は「欄が空のときだけ」入れていたので、9→9:30と打ち直しても本文は9:00のまま。
 *   それがそのまま@channelで全員に飛び、画面のトーストだけ9:30と言う事故になっていた。
 *   松原が手で直していた場合は勝手に消さず、送信を止めて「↩型に戻す」を促す。 */
function skPrev(force) {
  const box = $('skBox');
  if (!box) return;
  const dt = $('skDate').value, tm = skNorm($('skTime').value);
  if (!dt || !tm) { box.classList.add('hidden'); return; }
  const e = $('skTxt'), b = $('btnSkSend'), r = $('skRes');
  const key = dt + ' ' + tm;
  const changed = key !== skKey;
  const touched = !!(e && e.value && e.value !== skAuto);
  if (force === true || !e.value || (changed && !touched)) {
    skKey = key; skBase = '';
    if (e) { e.value = skTpl(dt, tm); skAuto = e.value; }
    skDraft(dt, tm);
    if (b) { b.disabled = false; b.textContent = '✅ Slackへ出勤時間報告（@channel）'; }
    if (r) { r.className = 'result'; r.textContent = ''; }
    box.classList.remove('hidden');
    return;
  }
  if (changed && touched) {
    skKey = key;
    if (b) { b.disabled = true; b.textContent = '⏸ 本文が古い日時のままです'; }
    if (r) { r.className = 'result ng';
      r.textContent = '⚠️ 日付か時刻を変えました。本文は直したままなので送れません。「↩ 型に戻す」で作り直してください'; }
  }
  box.classList.remove('hidden');
}

if ($('skDate')) {   // 旧キャッシュindex.htmlとのSW更新すれ違いでも全体を壊さないnullガード
  const d0 = $('skDate');
  if (!d0.value) d0.value = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  d0.addEventListener('change', skPrev);
}
if ($('skTime')) $('skTime').addEventListener('input', skPrev);
if ($('btnSkSend')) $('btnSkSend').addEventListener('click', async () => {
  const dt = $('skDate').value, tm = skNorm($('skTime').value);
  const btn = $('btnSkSend'), res = $('skRes');
  if (!dt || !tm) { res.className = 'result ng'; res.textContent = '日付と出勤時刻（例 9:30 / 930 / 9時半）を入れてください'; return; }
  btn.disabled = true;   // 二重送信防止（サーバ側CP_SHUKKIN_SENTフラグと二段構え）
  res.className = 'result';
  res.textContent = '送信中…';
  try {
    const tx = ($('skTxt').value || '').trim();
    if (!tx) { res.className = 'result ng'; res.textContent = '本文が空です'; btn.disabled = false; return; }
    const d = await api({ api: 'shukkinReport', date: dt, time: tm, text: tx, base: skBase });
    res.className = 'result ok';
    res.textContent = '✅ ' + (d.msg || 'Slackへ送信しました');
    btn.textContent = '送信済み';
  } catch (e) {
    res.className = 'result ng';
    res.textContent = e.message;
    btn.disabled = false;   // 失敗時のみ再試行可
  }
});

/* ==== 📚2026-07-31 覚えた言い回し＝いつでも見て、いつでも忘れさせられる ====
 * 覚えっぱなしで見えないのは怖い。ブラウザ版と同じ操作をアプリにも置く。 */
/* 🔴箱は残業カードと出勤カードの両方にある。押した方の箱を開く（2026-07-31 監査）。 */
async function mlOpen(id) {
  const b = $(id || 'mlBox');
  if (!b) return;
  if (!b.classList.contains('hidden')) { b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  b.textContent = '読み込み中…';
  try {
    const d = await api({ api: 'msgLearnList' });
    b.textContent = '';
    const h = document.createElement('div');
    h.className = 'field-label';
    h.textContent = '覚えた言い回し（' + (d.rows || []).length + '件）';
    b.appendChild(h);
    if (!(d.rows || []).length) {
      const m = document.createElement('div');
      m.className = 'muted';
      m.style.fontSize = '12px';
      m.textContent = 'まだ何も覚えていません。文面を直して送るとここに貯まります';
      b.appendChild(m);
      return;
    }
    (d.rows || []).forEach(x => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)';
      const l = document.createElement('span');
      l.style.fontSize = '13px';
      // 🔴v16：種類が3つ（残業／出勤／申し送り）。2択のままだと申し送りが「出勤」と嘘の名前で並ぶ
      const KN = { zho: '残業', shukkin: '出勤', moushi: '申し送り' };
      l.textContent = (KN[x.kind] || x.kind) + '　' + x.a + ' → ' + (x.b || '（削除）');
      const bt = document.createElement('button');
      bt.className = 'chip';
      bt.textContent = '忘れる';
      bt.addEventListener('click', async () => {
        try {
          await api({ api: 'msgLearnForget', kind: x.kind, a: x.a });
          b.classList.add('hidden');
          mlOpen(b.id);
        } catch (e) { l.textContent = '消せませんでした：' + e.message; }
      });
      row.appendChild(l); row.appendChild(bt); b.appendChild(row);
    });
  } catch (e) { b.textContent = '読めませんでした：' + e.message; }
}
if ($('zhoLearn')) $('zhoLearn').addEventListener('click', () => mlOpen('mlBox'));
if ($('skLearn')) $('skLearn').addEventListener('click', () => mlOpen('mlBox2'));
if ($('zhoReset')) $('zhoReset').addEventListener('click', () => { if (zhoFields) { zhoFill(zhoText(zhoFields)); zhoDraft(true); } });
if ($('skReset')) $('skReset').addEventListener('click', () => skPrev(true));

/* ==== 🧠2026-07-24 第二の脳（Plaud×Obsidian×Notion横断・読取専用・s9）====
 * 検索/ブリーフ/作戦盤＝サーバのapiBrain*へ委譲。結果はDOMノード+textContentで組立（エスケープ事故ゼロ） */
function brNode(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function brRenderSearch(box, r) {
  box.textContent = '';
  let any = false;
  (r.notion || []).forEach(tb => {
    any = true;
    const c = brNode('div', '');
    c.style.cssText = 'border:1px solid var(--line);border-radius:14px;padding:10px;margin-bottom:10px';
    c.appendChild(brNode('div', 'field-label', 'Notion｜' + tb.tab + '（' + tb.n + '件）'));
    (tb.hits || []).forEach(h => {
      const d = brNode('div', '');
      d.style.cssText = 'padding:6px 0;border-top:1px solid var(--line);font-size:13px;line-height:1.6';
      h.forEach(f => {
        const s = brNode('div', '');
        s.appendChild(brNode('b', '', f.k + '：'));
        s.appendChild(document.createTextNode(f.v));
        d.appendChild(s);
      });
      c.appendChild(d);
    });
    box.appendChild(c);
  });
  if (r.vaultErr) box.appendChild(brNode('div', 'muted', '🧠 ' + r.vaultErr));
  (r.vault || []).forEach(f0 => {
    any = true;
    const c = brNode('div', '');
    c.style.cssText = 'border:1px solid var(--line);border-radius:14px;padding:10px;margin-bottom:10px';
    c.appendChild(brNode('div', 'field-label', 'Obsidian｜' + f0.path));
    if (f0.body) {
      const p = brNode('pre', 'draft-pre', f0.body);
      c.appendChild(p);
    }
    box.appendChild(c);
  });
  if (!any) box.textContent = '「' + r.q + '」の該当なし（Notionミラー5DB＋rayly-brainを横断）';
}

if ($('btnBrSearch')) $('btnBrSearch').addEventListener('click', async () => {   // 旧キャッシュHTML対策のnullガード
  const q = $('brQ').value.trim(), box = $('brRes');
  if (!q) { box.textContent = '検索語を入れてください（例：提携先名・人名）'; return; }
  box.textContent = '検索中…（Notionミラー5DB＋rayly-brain横断）';
  try {
    const r = await api({ api: 'brainSearch', q });
    brRenderSearch(box, r);
  } catch (e) { box.textContent = e.message; }
});

if ($('btnBrBrief')) $('btnBrBrief').addEventListener('click', async () => {
  const q = $('brQ').value.trim(), box = $('brRes');
  if (!q) { box.textContent = 'ブリーフの相手名・案件名を入れてください'; return; }
  box.textContent = '⚡ ブリーフ生成中…（Notion+Obsidianの実データをGeminiが整形）';
  try {
    const r = await api({ api: 'brainBrief', q });
    box.textContent = '';
    const c = brNode('div', '');
    c.style.cssText = 'border:1px solid var(--accent);border-radius:14px;padding:12px';
    c.appendChild(brNode('div', 'field-label', '⚡ 商談ブリーフ｜' + r.q));
    c.appendChild(brNode('pre', 'draft-pre', r.brief));
    box.appendChild(c);
  } catch (e) { box.textContent = e.message; }
});

/* 📝s12 議事録取込＝区分（提携先=管理番号必須→SF活動記録も／社内・その他=第二の脳のみ） */
let gjKubun = '提携先';
document.querySelectorAll('#gjChips .chip').forEach(c => c.addEventListener('click', () => {
  gjKubun = c.dataset.k;
  document.querySelectorAll('#gjChips .chip').forEach(x => x.classList.toggle('on', x === c));
  if ($('gjKanriBox')) $('gjKanriBox').classList.toggle('hidden', gjKubun !== '提携先');
}));

async function gjPull(force) {   // 📝Plaud/Meet URL取込（force=取込済みの明示上書き）
  const u = $('plUrl').value.trim(), kn = ($('plKanri') ? $('plKanri').value.trim() : ''), res = $('plRes');
  if (!u) { res.className = 'result ng'; res.textContent = 'PlaudかMeetメモのURLを貼ってください'; return; }
  if (gjKubun === '提携先' && !kn) { res.className = 'result ng'; res.textContent = '提携先の議事録は管理番号を入れてください（例 1034）'; return; }
  res.className = 'result';
  res.textContent = '⬇ 取込中…（' + gjKubun + 'として処理：要約＋全文→Notion' + (gjKubun === '提携先' ? '＋SF活動記録' : '') + '）';
  $('btnPlPull').disabled = true;
  try {
    const r = await api({ api: 'plaudPull', url: u, kubun: gjKubun, kanri: kn, force: force === true });
    // 🔴取込済み＝黙って上書きしない。上書きは明示のタップで
    if (r && r.dup) {
      res.className = 'result';
      res.textContent = '';
      res.appendChild(document.createTextNode('⚠️ ' + (r.msg || '取込済みのURLです')));
      const rw = document.createElement('div');
      rw.style.marginTop = '8px';
      const b1 = document.createElement('button');
      b1.className = 'btn btn-small btn-primary';
      b1.textContent = '♻️ 上書きして最新化';
      b1.addEventListener('click', () => gjPull(true));
      rw.appendChild(b1);
      const b2 = document.createElement('button');
      b2.className = 'btn btn-small';
      b2.style.marginLeft = '6px';
      b2.textContent = 'やめる';
      b2.addEventListener('click', () => { res.textContent = ''; });
      rw.appendChild(b2);
      res.appendChild(rw);
      return;
    }
    res.className = 'result ok';
    res.textContent = r.msg + '\n日付: ' + (r.date || '') + (r.segs ? (' / 文字起こし ' + r.segs + 'セグメント') : '') +
      (r.partner ? ' / 提携先: ' + r.partner : '') + '\n' + (r.sf ? r.sf + '\n' : '') + (r.note || '');
    $('plUrl').value = '';
  } catch (e) {
    res.className = 'result ng';
    res.textContent = e.message;
  } finally {
    $('btnPlPull').disabled = false;
  }
}
if ($('btnPlPull')) $('btnPlPull').addEventListener('click', () => gjPull(false));

let brBoardDone = false;
async function brLoadBoard() {
  const b = $('brBoardBody');
  if (!b) return;
  try {
    const r = await api({ api: 'brainBoard' });
    b.textContent = '';
    b.appendChild(brNode('pre', 'draft-pre', r.board));
    if ($('brMeta') && r.meta) $('brMeta').textContent = 'データ鮮度：' + r.meta;
    brBoardDone = true;
  } catch (e) { b.textContent = e.message; }
}

/* ==== 🔎2026-07-26 v6.0 パイプライン（患者CV × 提携先ライフサイクル）＝PC版と同一契約 ====
 * 表示は全てDOMノード+textContent（エスケープ事故ゼロ）。書込はSF活動記録のみ */
function pnd(t, c, x) {
  const e = document.createElement(t);
  if (c) e.className = c;
  if (x != null) e.textContent = x;
  return e;
}

function futBox(f) {
  const w = pnd('div', 'fut');
  [['go', '✨ 実行したら訪れる未来', f.go], ['ng', '⚠️ 実行しなかった場合の未来', f.ng]].forEach(p9 => {
    const b = pnd('div', 'futb ' + p9[0]);
    b.appendChild(pnd('b', null, p9[1]));
    const ol = document.createElement('ol');
    (p9[2] || []).forEach(x => ol.appendChild(pnd('li', null, x)));
    b.appendChild(ol);
    w.appendChild(b);
  });
  return w;
}

function pipeOpen(host, btn, label, text) {
  const d = pnd('div', 'pbody', text);
  d.style.display = 'none';
  btn.addEventListener('click', () => {
    const o = d.style.display === 'none';
    d.style.display = o ? '' : 'none';
    btn.textContent = o ? '閉じる' : label;
  });
  host.appendChild(btn);
  host.appendChild(d);
}

function pipePatient(p) {
  const c = pnd('div', 'pcard');
  const h = pnd('h4');
  h.appendChild(document.createTextNode(p.name));
  if (p.status) h.appendChild(pnd('span', 'ppill ok', p.status));
  c.appendChild(h);
  let m = p.partnerName ? ('紹介元 ' + p.partnerName + (p.kanri ? '（#' + p.kanri + '）' : '')) : '紹介元 —';
  if (p.source) m += '　/　' + p.source;
  if (p.nextVisit) m += '　/　次回来院 ' + p.nextVisit;
  c.appendChild(pnd('div', 'pmeta', m));
  (p.steps || []).forEach((s, i) => {
    const row = pnd('div', 'pstep' + (i === 0 ? ' first' : ''));
    row.appendChild(pnd('span', 'pdot', s.done ? '✅' : '⬜'));
    const t = pnd('div', 'ptx');
    t.appendChild(pnd('div', 'pnm', s.n));
    if (s.sub) t.appendChild(pnd('div', 'psub', s.sub));
    if (s.body) {
      const lb = (s.bodyLabel || '内容') + 'を開く';
      pipeOpen(t, pnd('button', 'pmini', lb), lb, s.body);
    }
    if (s.act2 === 'fblock') {
      const lk = pnd('button', 'pmini', '✉️ 受診後フィードバックメッセージを生成');
      lk.disabled = true;
      lk.style.opacity = '.45';
      lk.title = '医師記入欄が更新されると押せます';
      t.appendChild(lk);
    }
    if (s.act2 === 'fbdraft') {
      const fd = pnd('button', 'pmini go', '✉️ 受診後フィードバックメッセージを生成');
      const fdb = pnd('div', 'pbody');
      fdb.style.display = 'none';
      const fdr = pnd('button', 'pmini', '↻ 作り直す');
      fdr.style.marginLeft = '6px';
      fdr.style.display = 'none';
      let done = false;
      const gen = async (force) => {
        if (!force && done) {
          const op = fdb.style.display === 'none';
          fdb.style.display = op ? '' : 'none';
          fdr.style.display = op ? '' : 'none';
          fd.textContent = op ? '閉じる' : '✉️ 受診後フィードバックメッセージを生成';
          return;
        }
        fd.disabled = true; fdr.disabled = true;
        fd.textContent = '生成中…';
        fdb.style.display = '';
        fdb.textContent = '紹介元スタイリスト様へお送りする文面を作成しています…';
        try {
          const x = await api({ api: 'fbDraft', id: p.id });
          fdb.textContent = x.text || '';
          done = true;
          fd.textContent = '閉じる';
          fdr.style.display = '';
        } catch (e) {
          fdb.textContent = e.message;
          fd.textContent = '✉️ 受診後フィードバックメッセージを生成';
        } finally { fd.disabled = false; fdr.disabled = false; }
      };
      fd.addEventListener('click', () => gen(false));
      fdr.addEventListener('click', () => { done = false; gen(true); });
      t.appendChild(fd); t.appendChild(fdr); t.appendChild(fdb);
    }
    if (s.fut) t.appendChild(futBox(s.fut));
    if (s.isFb) {
      const lw = document.createElement('label');
      lw.className = 'pchk';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      if (s.done) {
        cb.checked = true; cb.disabled = true;
        lw.appendChild(cb);
        lw.appendChild(document.createTextNode('実施済み' + (s.at ? '（' + s.at + '）' : '')));
      } else if (s.act === 'fb') {
        cb.addEventListener('change', () => { if (cb.checked) { cb.disabled = true; pipeFb(p.id, p.name, cb, lw); } });
        lw.appendChild(cb);
        lw.appendChild(document.createTextNode('実施した（チェックでSalesforceに記録）'));
      } else {
        cb.disabled = true;
        lw.appendChild(cb);
        lw.appendChild(document.createTextNode('状況を確認できません'));
      }
      t.appendChild(lw);
    }
    row.appendChild(t);
    if (s.at) row.appendChild(pnd('span', 'pat', s.at));
    c.appendChild(row);
  });
  const sec = pnd('div', 'psec');
  const cv = pnd('button', 'pmini', '📋 整理（CV要因）をNotionから読む');
  const cvb = pnd('div', 'pbody');
  cvb.style.display = 'none';
  cv.addEventListener('click', async () => {
    cv.disabled = true;
    cv.textContent = '読込中…';
    cvb.style.display = '';
    try {
      const x = await api({ api: 'pipeCv', name: p.name });
      cv.textContent = '整理（CV要因）／Notion CRM';
      cvb.textContent = x.text || '';
    } catch (e) {
      cv.textContent = '📋 整理（CV要因）をNotionから読む';
      cvb.textContent = e.message;
    } finally { cv.disabled = false; }
  });
  sec.appendChild(cv);
  sec.appendChild(cvb);
  c.appendChild(sec);
  return c;
}

async function pipeFb(id, name, cb, lw) {   // cb=チェックボックス / lw=ラベル
  try {
    const r = await api({ api: 'pipeFb', id, name });
    cb.checked = true;
    lw.lastChild.textContent = '実施済み';
    showErr(r.msg || '記録しました');
  } catch (e) {
    cb.checked = false;
    cb.disabled = false;
    showErr(e.message);
  }
}

async function pipeStep(id, kind, btn, lbl) {
  btn.disabled = true;
  btn.textContent = '記録中…';
  try {
    await api({ api: 'pipeStep', id, kind });
    btn.textContent = '✅ 記録済み';
  } catch (e) {
    btn.disabled = false;
    btn.textContent = lbl;
    showErr(e.message);
  }
}

function pipePartner(vv) {
  const c = pnd('div', 'pcard');
  const h = pnd('h4');
  h.appendChild(document.createTextNode(vv.name));
  if (vv.kanri) h.appendChild(pnd('span', 'ppill', '#' + vv.kanri));
  if (vv.status) h.appendChild(pnd('span', 'ppill ok', vv.status));
  if (vv.active) h.appendChild(pnd('span', 'ppill' + (vv.active.indexOf('休') >= 0 ? ' wa' : ''), vv.active));
  c.appendChild(h);
  c.appendChild(pnd('div', 'pmeta', '担当 ' + (vv.tanto || '—') + (vv.lastAct ? '　/　最終活動 ' + vv.lastAct : '')));
  const ls = pnd('div', 'psec');
  ls.appendChild(pnd('div', 'psh', '対応ステータス（新規提携の前後）'));
  (vv.life || []).forEach((s, i) => {
    const row = pnd('div', 'pstep' + (i === 0 ? ' first' : ''));
    row.appendChild(pnd('span', 'pdot', s.done ? '✅' : '⬜'));
    const t = pnd('div', 'ptx');
    t.appendChild(pnd('div', 'pnm', s.n));
    if (s.v) t.appendChild(pnd('div', 'psub', s.v));
    if (s.act === 'hansoku' && !vv._amb) {
      const hb = pnd('button', 'pmini go', '📮 依頼文を作る');
      hb.addEventListener('click', () => pipeHansoku(vv, t, hb));
      t.appendChild(hb);
    }
    if (s.act === 'give' && !vv._amb) {
      const gb = pnd('button', 'pmini', '✅ 提供済みにする');
      gb.addEventListener('click', () => pipeStep(vv.id, 'give', gb, '✅ 提供済みにする'));
      t.appendChild(gb);
    }
    if (s.fut) t.appendChild(futBox(s.fut));
    row.appendChild(t);
    if (s.at) row.appendChild(pnd('span', 'pat', s.at));
    ls.appendChild(row);
  });
  c.appendChild(ls);
  if (vv.nextNote || vv.nextDate) {
    const na = pnd('div', 'psec');
    na.appendChild(pnd('div', 'psh', '次回アクション'));
    na.appendChild(pnd('div', 'psub', (vv.nextDate ? vv.nextDate + '　' : '') + (vv.nextNote || '')));
    c.appendChild(na);
  }
  const ad = pnd('div', 'psec');
  ad.appendChild(pnd('div', 'psh', '今後どのようなアプローチが求められるか'));
  const ab = pnd('button', 'pmini', '⚡ 提案を生成');
  const abr = pnd('button', 'pmini', '↻ 作り直す');
  abr.style.marginLeft = '6px';
  abr.style.display = 'none';
  const abd = pnd('div', 'pbody');
  abd.style.display = 'none';
  const advGen = async () => {
    ab.disabled = true; abr.disabled = true;
    ab.textContent = '生成中…';
    abd.style.display = '';
    abd.textContent = '実データを読み解いています…';
    try {
      const x = await api({ api: 'pipeAdvice', kanri: vv.kanri, recordId: vv.id });
      // 🧠b65：第二の脳（Obsidian+Notionミラー）の同乗をスマホでも明示（注入自体はサーバ共通＝自動反映）
      abd.textContent = (x.advice || '') +
        (x.brain ? '\n\n🧠 第二の脳の記憶 ' + x.brain + '件を参照（' + (x.brainSrcs || []).slice(0, 3).join('・') + '）' : '');
      abr.style.display = '';
    } catch (e) { abd.textContent = e.message; }
    finally { ab.disabled = false; abr.disabled = false; ab.textContent = '⚡ 提案を生成'; }
  };
  ab.addEventListener('click', advGen);
  abr.addEventListener('click', advGen);
  ad.appendChild(ab);
  ad.appendChild(abr);
  ad.appendChild(abd);
  c.appendChild(ad);
  if (vv.patients && vv.patients.length) {
    const ps = pnd('div', 'psec');
    ps.appendChild(pnd('div', 'psh', '紹介実績 ' + (vv.patientsTotal || vv.patients.length) + '件' +
      (vv.patientsTotal > vv.patients.length ? '（直近' + vv.patients.length + '件を表示）' : '') + '　名前をタップで進捗を開く'));
    vv.patients.forEach(p => {
      const bt = pnd('button', 'pmini', p.name + '（' + (p.status || '—') + '）');
      bt.style.marginRight = '6px';
      const wrap = pnd('div');
      wrap.style.display = 'none';
      bt.addEventListener('click', () => {
        const o = wrap.style.display === 'none';
        if (o && !wrap.hasChildNodes()) wrap.appendChild(pipePatient(p));
        wrap.style.display = o ? '' : 'none';
      });
      ps.appendChild(bt);
      ps.appendChild(wrap);
    });
    c.appendChild(ps);
  }
  if (vv.acts && vv.acts.length) {
    const as = pnd('div', 'psec');
    as.appendChild(pnd('div', 'psh', '活動実績 ' + vv.acts.length + '件'));
    vv.acts.forEach(a => {
      const row = pnd('div', 'pstep');
      row.appendChild(pnd('span', 'pdot', '•'));
      const t = pnd('div', 'ptx');
      t.appendChild(pnd('div', 'pnm', a.s));
      if (a.b) t.appendChild(pnd('div', 'psub', a.b));
      row.appendChild(t);
      if (a.d) row.appendChild(pnd('span', 'pat', a.d));
      as.appendChild(row);
    });
    c.appendChild(as);
  }
  return c;
}

// 🔴2026-07-29：販促物はブラウザ版がv6.8（QR鮮度チェック→フォルダ生成→生成→依頼→発送案内）に
//   作り替わっており、PWAに残っていた旧v6.0の経路は「発送案内が永久に作れない」「同じサロンへ
//   2通目の依頼が飛ぶ」実害があった。スマホからは着手させず、ブラウザ版へ案内する。
async function pipeHansoku(vv, host, btn) {
  const box = pnd('div');
  box.style.marginTop = '8px';
  box.appendChild(pnd('div', 'pbody',
    '販促物の依頼は、ブラウザ版の「🎁 販促物制作」からお願いします。\n' +
    'QRの鮮度確認・フォルダ生成・完了報告の追跡まで一続きになっており、\n' +
    'スマホから出すと発送案内が作れなくなります。'));
  host.appendChild(box);
  return;
}

async function pipeHansokuLegacy_(vv, host, btn) {
  btn.disabled = true;
  btn.textContent = '作成中…';
  let r;
  try { r = await api({ api: 'hansokuDraft', kanri: vv.kanri, partnerName: vv.name }); }
  catch (e) { btn.disabled = false; btn.textContent = '📮 依頼文を作る'; showErr(e.message); return; }
  btn.disabled = false;
  btn.textContent = '📮 依頼文を作る';
  const box = pnd('div');
  box.style.marginTop = '8px';
  const pv = pnd('div', 'pbody', r.text || '');
  box.appendChild(pv);
  box.appendChild(pnd('div', 'psub', '補足（任意・この内容だけが依頼文に差し込まれます）'));
  const ta = document.createElement('textarea');
  ta.placeholder = '例）A5サイズ・両面／ロゴは既存データで';
  ta.rows = 3;
  box.appendChild(ta);
  const cp = pnd('button', 'pmini', '📋 依頼文をコピー');
  cp.addEventListener('click', () => { try { navigator.clipboard.writeText(pv.textContent); } catch (e) {} });
  box.appendChild(cp);
  const sd = pnd('button', 'pmini go', '✅ Slackへ投稿して記録');
  sd.style.marginLeft = '6px';
  sd.disabled = !r.hasCh;
  sd.addEventListener('click', async () => {
    sd.disabled = true;
    sd.textContent = '送信中…';
    try {
      const x = await api({ api: 'hansokuSend', id: vv.id, kanri: vv.kanri, partnerName: vv.name, extra: ta.value });
      sd.textContent = '送信済み';
      showErr(x.msg || '送信しました');
    } catch (e) {
      sd.disabled = false;
      sd.textContent = '✅ Slackへ投稿して記録';
      showErr(e.message);
    }
  });
  box.appendChild(sd);
  const rs = pnd('button', 'pmini', '↻ 作り直す');
  rs.style.marginLeft = '6px';
  rs.addEventListener('click', () => {
    host.removeChild(box);
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = '📮 依頼文を作る';
  });
  box.appendChild(rs);
  if (r.note) box.appendChild(pnd('div', 'muted', r.note));
  host.appendChild(box);
  btn.style.display = 'none';
}

/* 🆕2026-07-26 リスト行：既定は閉じた1行、ボタンでその場展開（リロードなし） */
function plPatientRow(p) {
  const c = pnd('div', 'pcard');
  const h = pnd('h4');
  h.appendChild(document.createTextNode(p.name));
  if (p.status) h.appendChild(pnd('span', 'ppill ok', p.status));
  if (p.kubun) h.appendChild(pnd('span', 'ppill' + (p.kubun === 'PJT' ? ' ok' : ''), p.kubun));
  c.appendChild(h);
  const st = p.steps || [];
  let dn = 0;
  st.forEach(x => { if (x.done) dn++; });
  let m = p.partnerName ? ('紹介元 ' + p.partnerName + (p.kanri ? '（#' + p.kanri + '）' : '')) : '紹介元 —';
  m += '　/　進捗 ' + dn + '/' + st.length;
  if (st[0] && st[0].sub) m += '　/　' + st[0].sub;
  c.appendChild(pnd('div', 'pmeta', m));
  const b = pnd('button', 'pmini', 'この患者様の進捗を開く');
  const w = pnd('div');
  w.style.display = 'none';
  b.addEventListener('click', () => {
    const o = w.style.display === 'none';
    if (o && !w.hasChildNodes()) w.appendChild(pipePatient(p));
    w.style.display = o ? '' : 'none';
    b.textContent = o ? '閉じる' : 'この患者様の進捗を開く';
  });
  c.appendChild(b);
  c.appendChild(w);
  return c;
}

function plPartnerRow(it) {
  const c = pnd('div', 'pcard');
  const h = pnd('h4');
  h.appendChild(document.createTextNode(it.name));
  if (it.kanri) h.appendChild(pnd('span', 'ppill', '#' + it.kanri));
  if (it.status) h.appendChild(pnd('span', 'ppill ok', it.status));
  if (it.active) h.appendChild(pnd('span', 'ppill' + (it.active.indexOf('休') >= 0 ? ' wa' : ''), it.active));
  c.appendChild(h);
  const m = [];
  if (it.contract) m.push('契約 ' + it.contract);
  if (it.lastAct) m.push('最終活動 ' + it.lastAct);
  if (it.nextNote) m.push('次回 ' + (it.nextDate ? it.nextDate + ' ' : '') + it.nextNote);
  c.appendChild(pnd('div', 'pmeta', m.join('　/　') || '—'));
  const b = pnd('button', 'pmini', 'この提携先の全体を開く');
  const w = pnd('div');
  w.style.display = 'none';
  b.addEventListener('click', async () => {
    if (w.hasChildNodes()) {
      const o = w.style.display === 'none';
      w.style.display = o ? '' : 'none';
      b.textContent = o ? '閉じる' : 'この提携先の全体を開く';
      return;
    }
    b.disabled = true;
    b.textContent = '読込中…';
    try {
      const r = await api({ api: 'partnerDetail', recordId: it.id });
      w.appendChild(pipePartner(r.partner));
      w.style.display = '';
      b.textContent = '閉じる';
    } catch (e) { b.textContent = 'この提携先の全体を開く'; showErr(e.message); }
    finally { b.disabled = false; }
  });
  c.appendChild(b);
  c.appendChild(w);
  return c;
}

async function plLoad(kind) {
  const host = $('pl' + kind + 'R');
  if (!host) return;
  const n = parseInt($('pl' + kind + 'N').value, 10) || 50;
  const ord = $('pl' + kind + 'O').value;
  host.textContent = '読込中…';
  try {
    const r = await api({ api: kind === 'Partner' ? 'partnerList' : 'patientList', limit: n, order: ord });
    host.textContent = '';
    const c9 = $('pl' + kind + 'Cnt');
    if (c9) c9.textContent = (r.total ? '全' + r.total + '件' : '') +
      ((r.items && r.total > r.items.length) ? '／表示' + r.items.length : '');
    if (r.fbErr) host.appendChild(pnd('div', 'muted', '⚠️ フィードバック実施の取得に失敗：' + r.fbErr));
    if (!r.items || !r.items.length) { host.appendChild(pnd('div', 'muted', '該当がありません')); return; }
    r.items.forEach(it => host.appendChild(kind === 'Partner' ? plPartnerRow(it) : plPatientRow(it)));
  } catch (e) {
    // 🔴host自身にエラーを書くと「中身がある」と判定され、以後ずっと再読込されなくなる
    host.innerHTML = '';
    host.appendChild(pnd('div', 'muted', '読み込みに失敗しました：' + e.message + '（もう一度お試しください）'));
    host.dataset.err = '1';
  }
}

/* 一覧の切替＝プルダウン（2026-07-27 松原指示。タブ入場時と切替時に、空なら読み込む） */
function plKindShow() {
  const sel = $('plKind');
  if (!sel) return;
  const kind = sel.value === 'Patient' ? 'Patient' : 'Partner';
  ['Partner', 'Patient'].forEach(k => {
    const w = $('pl' + k);
    if (w) w.classList.toggle('hidden', k !== kind);
  });
  const host = $('pl' + kind + 'R');
  if (host && (!host.firstChild || host.dataset.err === '1')) { delete host.dataset.err; plLoad(kind); }
}
if ($('plKind')) $('plKind').addEventListener('change', plKindShow);
['Partner', 'Patient'].forEach(kind => {
  ['N', 'O'].forEach(sfx => {
    const el = $('pl' + kind + sfx);
    if (el) el.addEventListener('change', () => plLoad(kind));
  });
});

if ($('btnPipeReset')) $('btnPipeReset').addEventListener('click', () => {
  const b = $('pipeRes'); if (b) b.textContent = '';
  const q = $('pipeQ'); if (q) { q.value = ''; q.focus(); }
});
if ($('btnPipeGo')) $('btnPipeGo').addEventListener('click', async () => {   // 旧キャッシュHTML対策のnullガード
  const q = $('pipeQ').value.trim(), b = $('pipeRes');
  if (!q) { b.textContent = '患者様名・提携サロン名・管理番号のいずれかを入れてください'; return; }
  b.textContent = '検索中…（Salesforceを横断）';
  try {
    const r = await api({ api: 'pipeSearch', q });
    b.textContent = '';
    if (r.warn) b.appendChild(pnd('div', 'muted', '⚠️ ' + r.warn));
    if (r.fbErr) b.appendChild(pnd('div', 'muted', '⚠️ フィードバック実施の取得に失敗：' + r.fbErr));
    if (r.partner) { r.partner._amb = !!r.ambiguous; b.appendChild(pipePartner(r.partner)); }
    if (r.patients && r.patients.length) {
      const s = pnd('div', 'psec');
      s.appendChild(pnd('div', 'psh', '患者様 ' + r.patients.length + '件（コンバージョン前後の進捗）'));
      r.patients.forEach(p => s.appendChild(pipePatient(p)));
      b.appendChild(s);
    }
    if (r.note) b.appendChild(pnd('div', 'muted', r.note));
  } catch (e) { b.textContent = e.message; }
});

/* ==== レシート ==== */
let rcB64 = null, rcName = null;

$('rcTarget').addEventListener('click', ev => {
  const b = ev.target.closest('.seg-btn');
  if (!b) return;
  document.querySelectorAll('#rcTarget .seg-btn').forEach(x => x.classList.toggle('active', x === b));
});

$('rcFile').addEventListener('change', async ev => {
  const f = ev.target.files[0];
  if (!f) return;
  $('rcFileLabel').textContent = '処理中…';
  try {
    const { b64, w, h } = await shrinkImage(f, 1600, 0.8);
    rcB64 = b64;
    rcName = 'receipt_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '.jpg';
    $('rcPreview').src = 'data:image/jpeg;base64,' + b64;
    $('rcPreview').classList.remove('hidden');
    $('rcFileLabel').textContent = `${f.name}（${w}×${h}・${Math.round(b64.length * 0.75 / 1024)}KB）`;
    $('btnSendReceipt').disabled = false;
  } catch (e) {
    $('rcFileLabel').textContent = '📷 撮影 / 画像を選択';
    showErr('画像処理に失敗: ' + e.message);
  }
});

function shrinkImage(file, maxPx, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = cv.toDataURL('image/jpeg', quality);
      resolve({ b64: dataUrl.split(',')[1], w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めません')); };
    img.src = url;
  });
}

$('btnSendReceipt').addEventListener('click', async () => {
  if (!rcB64) return;
  const target = document.querySelector('#rcTarget .seg-btn.active').dataset.v;
  const out = $('rcResult');
  out.className = 'result';
  out.textContent = '送信中…';
  $('btnSendReceipt').disabled = true;
  try {
    const d = await api({ api: 'receipt', b64: rcB64, name: rcName, target });
    out.className = 'result ok';
    out.textContent = '送信しました ' + (d.msg || '');
    rcB64 = null;
    $('rcPreview').classList.add('hidden');
    $('rcFileLabel').textContent = '📷 撮影 / 画像を選択';
    $('rcFile').value = '';
  } catch (e) {
    out.className = 'result ng';
    out.textContent = e.message;
    $('btnSendReceipt').disabled = false;
  }
});

/* ==== 🆕紹介登録（ブラウザ版apiShokai(f)と同フィールド：name/apply/type/sex/flag/plaud/sonota/sfp） ==== */
let skFlag = '';
if ($('skKubun')) $('skKubun').addEventListener('click', ev => {
  const c = ev.target.closest('.chip');
  if (!c) return;
  const v = c.dataset.v;
  document.querySelectorAll('#skKubun .chip').forEach(x => x.classList.remove('on'));
  if (skFlag === v) { skFlag = ''; return; }   // 再タップで解除（ブラウザ版と同挙動）
  skFlag = v;
  c.classList.add('on');
});
if ($('btnShokai')) $('btnShokai').addEventListener('click', async () => {
  const out = $('skResult');
  const f = {
    name: ($('skName') ? $('skName').value.trim() : ''),
    apply: ($('skApply') ? $('skApply').value : ''),
    type: ($('skType') ? $('skType').value : 'AGA'),
    sex: ($('skSex') ? $('skSex').value : ''),
    flag: skFlag,
    plaud: ($('skPlaud') ? $('skPlaud').value.trim() : ''),
    sonota: ($('skSonota') ? $('skSonota').value.trim() : ''),
    sfp: ($('skSfp') ? $('skSfp').value.trim() : '')
  };
  if (!f.name) { out.className = 'result ng'; out.textContent = '①患者様名を入れてください'; return; }
  if (!f.flag) { out.className = 'result ng'; out.textContent = '④⑤⑥の区分を1つ選んでください'; return; }
  out.className = 'result';
  out.textContent = '送信中…';
  $('btnShokai').disabled = true;
  try {
    const d = await api(Object.assign({ api: 'shokai' }, f));   // 🔴doPost契約=トップレベル{name,apply,type,sex,flag,plaud,sonota,sfp}（f入れ子は読まれない）
    out.className = 'result ok';
    out.textContent = '✅ ' + (d.msg || '登録しました');
    ['skName', 'skPlaud', 'skSonota', 'skSfp'].forEach(id => { if ($(id)) $(id).value = ''; });
    document.querySelectorAll('#skKubun .chip').forEach(x => x.classList.remove('on'));
    skFlag = '';
  } catch (e) {
    out.className = 'result ng';
    out.textContent = e.message;
  } finally {
    $('btnShokai').disabled = false;
  }
});

/* ==== 🆕カレンダー登録（calParse→下書きカード→承認→calCreate。Meet URL表示＋コピー） ==== */
let calDraftData = null;

async function copyText(text, btn) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (btn) { const t = btn.textContent; btn.textContent = '✅ コピーしました'; setTimeout(() => { btn.textContent = t; }, 1500); }
  } catch (e) { showErr('コピーに失敗: ' + e.message); }
}

if ($('btnCalParse')) $('btnCalParse').addEventListener('click', async () => {
  const out = $('calResult');
  const text = $('calTx') ? $('calTx').value.trim() : '';
  if (!text) { out.className = 'result ng'; out.textContent = '予定を書いてから解析を押してください'; return; }
  out.className = 'result';
  out.textContent = '解析中…（登録はまだされません）';
  $('btnCalParse').disabled = true;
  $('calDraft').classList.add('hidden');
  $('calDone').classList.add('hidden');
  try {
    const d = await api({ api: 'calParse', text });
    calDraftData = d.draft || null;
    if (!calDraftData) throw new Error('下書きが返りませんでした');
    out.textContent = '';
    $('calDraftBody').innerHTML =
      '<b>' + esc(calDraftData.title || '') + '</b><br>' +
      esc(String(calDraftData.start || '').replace('T', ' ')) + ' 〜 ' + esc(String(calDraftData.end || '').replace(/^.*T/, '')) +
      (calDraftData.online ? '<br><span class="pill">オンライン（Meet発行）</span>' : '') +
      (calDraftData.memo ? '<br><span class="muted">' + esc(calDraftData.memo) + '</span>' : '');
    $('calDraft').classList.remove('hidden');
  } catch (e) {
    out.className = 'result ng';
    out.textContent = e.message;
  } finally {
    $('btnCalParse').disabled = false;
  }
});

if ($('btnCalOk')) $('btnCalOk').addEventListener('click', async () => {
  if (!calDraftData) return;
  const out = $('calResult');
  out.className = 'result';
  out.textContent = '登録中…';
  $('btnCalOk').disabled = true;
  try {
    const dft = Object.assign({}, calDraftData, { buffer: !!($('calBuffer') && $('calBuffer').checked) });
    const d = await api({ api: 'calCreate', draft: dft });   // 🔴doPost契約のキー名は draft（dftでは no_draft になる）
    out.textContent = '';
    $('calDraft').classList.add('hidden');
    $('calTx').value = '';
    $('calDoneMsg').textContent = '✅ ' + (d.msg || '登録しました') + (d.when ? '｜' + d.when : '') +
      (d.needAdv ? '（Meetリンクは保留＝ブラウザ版のCalendar APIサービス追加が必要）' : '');
    const hasMeet = !!(d.meet);
    $('calMeetRow').classList.toggle('hidden', !hasMeet);
    if (hasMeet) {
      $('calMeetUrl').textContent = d.meet;
      $('btnMeetCopy').onclick = () => copyText(d.meet, $('btnMeetCopy'));
    }
    const hasDraft = !!(d.draft);
    $('calMsgDraft').classList.toggle('hidden', !hasDraft);
    $('btnCalMsgCopy').classList.toggle('hidden', !hasDraft);
    if (hasDraft) {
      $('calMsgDraft').textContent = d.draft;
      $('btnCalMsgCopy').onclick = () => copyText(d.draft, $('btnCalMsgCopy'));
    }
    $('calDone').classList.remove('hidden');
    calDraftData = null;
  } catch (e) {
    out.className = 'result ng';
    out.textContent = e.message;
  } finally {
    $('btnCalOk').disabled = false;
  }
});

/* ==== 🆕2026-07-24 任務B：候補日時ファインダー（{api:'slotFind', durMin, periodText}） ====
 * スロット計算はサーバ1箇所（apiSlotFind）＝ここは表示のみ。エラー理由は必ず表示（黙殺しない） */
if ($('btnSlotFind')) $('btnSlotFind').addEventListener('click', async () => {
  const out = $('sfResult'), daysBox = $('sfDays'), msgBox = $('sfMsgBox');
  const p = $('sfPeriod') ? $('sfPeriod').value.trim() : '';
  if (!p) { out.className = 'result ng'; out.textContent = '期間を書いてください（例「来週」「8月第1週」）'; return; }
  const du = parseInt($('sfDur') ? $('sfDur').value : '30', 10) || 30;
  out.className = 'result';
  out.textContent = '洗い出し中…（カレンダー照合）';
  if (daysBox) daysBox.innerHTML = '';
  if (msgBox) msgBox.classList.add('hidden');
  $('btnSlotFind').disabled = true;
  try {
    const d = await api({ api: 'slotFind', durMin: du, periodText: p });
    const days = d.days || [];
    out.className = 'result';
    out.textContent = d.period
      ? '対象期間 ' + (d.period.label || '') + (d.period.how ? '（' + d.period.how + '）' : '') : '';
    if (!days.length) {
      if (daysBox) daysBox.innerHTML = '<div class="muted pad">' + esc(d.note || 'この期間に条件を満たす空き枠がありません') + '</div>';
      return;
    }
    if (daysBox) daysBox.innerHTML = days.map(dd =>
      '<div class="field-label">' + esc(dd.d || '') + '</div><div class="chips">' +
      (dd.ts || []).map(t => '<span class="chip" style="cursor:default">' + esc(t) + '</span>').join('') +
      ((dd.more || 0) > 0 ? '<span class="chip" style="cursor:default;opacity:.6">ほか ' + (+dd.more || 0) + '件</span>' : '') +
      '</div>').join('');
    if (d.msg && $('sfMsg') && msgBox) {
      $('sfMsg').value = d.msg;
      msgBox.classList.remove('hidden');
    }
  } catch (e) {
    out.className = 'result ng';
    out.textContent = e.message;
  } finally {
    $('btnSlotFind').disabled = false;
  }
});
if ($('btnSfCopy')) $('btnSfCopy').addEventListener('click', () =>
  copyText($('sfMsg') ? $('sfMsg').value : '', $('btnSfCopy')));

/* ==== 🆕学びのアーカイブ（{api:'intel'}一覧＋未読/閲覧済/導入済チップ＋{api:'intelStatus'}） ==== */
let intelItems = [], intelFilterV = 'all';

function renderIntel() {
  const box = $('intelList');
  if (!box) return;
  const list = intelItems.filter(it => intelFilterV === 'all' || (it.st || '未読') === intelFilterV);
  if (!list.length) { box.innerHTML = '<div class="muted pad">該当する学びはありません</div>'; return; }
  box.innerHTML = '';
  list.forEach(it => {
    const div = document.createElement('div');
    div.className = 'notif';
    const st = it.st || '未読';
    div.innerHTML =
      '<div class="notif-head"><span>' + esc(it.kind || '') + '｜' + esc(it.date || '') + '</span>' +
      '<span class="pill st-' + (st === '導入済' ? 'done' : st === '閲覧済' ? 'seen' : 'new') + '">' + esc(st) + '</span></div>' +
      '<div class="notif-title">' + esc(it.head || '') + '</div>' +
      '<div class="notif-body hidden">' + esc(it.full || '') + '</div>' +
      '<div class="notif-actions">' +
      '<button class="btn btn-small" data-int="open">本文</button>' +
      (st !== '閲覧済' ? '<button class="btn btn-small" data-int="閲覧済" data-ts="' + escAttr(it.ts || '') + '">閲覧済に</button>' : '') +
      (st !== '導入済' ? '<button class="btn btn-small btn-approve" data-int="導入済" data-ts="' + escAttr(it.ts || '') + '">導入済に</button>' : '') +
      '</div>';
    box.appendChild(div);
  });
}

if ($('intelList')) $('intelList').addEventListener('click', async ev => {
  const btn = ev.target.closest('button[data-int]');
  if (!btn) return;
  if (btn.dataset.int === 'open') {
    const body = btn.closest('.notif');
    const full = body ? body.querySelector('.notif-body') : null;
    if (full) full.classList.toggle('hidden');
    return;
  }
  /* ⚡第4手のPWA同格化：チップも一覧も即時反映→失敗なら巻き戻す（disabledで待たせない） */
  const hit = intelItems.find(x => String(x.ts) === String(btn.dataset.ts));
  const old = hit ? hit.st : null;
  if (hit) { hit.st = btn.dataset.int; renderIntel(); }
  try {
    await api({ api: 'intelStatus', ts: btn.dataset.ts, status: btn.dataset.int });
  } catch (e) {
    if (hit && old != null) { hit.st = old; renderIntel(); }
    showErr(e.message);
  }
});

if ($('intelFilter')) $('intelFilter').addEventListener('click', ev => {
  const c = ev.target.closest('.chip');
  if (!c) return;
  intelFilterV = c.dataset.v || 'all';
  document.querySelectorAll('#intelFilter .chip').forEach(x => x.classList.toggle('on', x === c));
  renderIntel();
});

async function loadIntel() {
  const box = $('intelList');
  if (!box) return;
  box.innerHTML = '<div class="muted pad">読み込み中…</div>';
  try {
    const d = await api({ api: 'intel' });
    // 🔴doPost契約は {ts,date,kind,head,body,status}（ブラウザ版内部形は full/st）＝両形を st/full へ正規化して描画・フィルタを成立させる
    intelItems = (d.items || (d.learn && d.learn.items) || []).map(x => ({
      ts: x.ts, date: x.date, kind: x.kind, head: x.head,
      full: x.body != null ? x.body : (x.full || ''),
      st: x.status != null ? x.status : (x.st || '未読')
    }));
    const cnt = d.cnt || (d.learn && d.learn.cnt) || {};
    const map = { '未読': cnt['未読'] || 0, '閲覧済': cnt['閲覧済'] || 0, '導入済': cnt['導入済'] || 0 };
    document.querySelectorAll('#intelFilter .chip').forEach(c => {
      const v = c.dataset.v;
      if (v && v !== 'all') c.textContent = v + ' ' + map[v];
    });
    renderIntel();
  } catch (e) {
    box.innerHTML = '<div class="muted pad">取得失敗</div>';
    showErr(e.message);
  }
}
if ($('btnIntelReload')) $('btnIntelReload').addEventListener('click', loadIntel);

/* 🔑合鍵の正規化（2026-08-20 s42・iPhone実機「合鍵が一致しません」の根治）：
 *   iOSはホーム画面アプリがSafariと**別の保存領域**＝URLで開いた時の合鍵が引き継がれない（OS仕様）。
 *   だから初回画面での手貼りが本線になる。その手貼りを壊す3つの罠を全部ここで吸収する＝
 *   ①合鍵付きURLを丸ごと貼った（?k=を取り出して使う）②%エンコードのまま写した（復号する）
 *   ③コピーに改行・空白・不可視文字が混ざった（全部落とす。合鍵は空白を含まない前提）。 */
function normKey(raw) {
  let s = String(raw || '').trim();
  try {
    if (/^https?:\/\//i.test(s)) { const u = new URL(s); const kk = u.searchParams.get('k'); if (kk) s = kk; }
  } catch (e) {}
  if (/%[0-9A-Fa-f]{2}/.test(s)) { try { s = decodeURIComponent(s); } catch (e) {} }
  return s.replace(/[​-‍﻿\s]/g, '');
}

/* ==== 初回セットアップ（合鍵） ==== */
function showSetup(msg) {
  $('setup').classList.remove('hidden');
  $('setupUrl').value = localStorage.getItem(LS.URL) || '';
  if (msg) { $('setupErr').className = 'result ng'; $('setupErr').textContent = msg; }
}
$('setupSave').addEventListener('click', () => {
  const k = normKey($('setupKey').value);   /* s42：URLごと貼ってもOK・空白/不可視文字も吸収 */
  if (!k) { $('setupErr').className = 'result ng'; $('setupErr').textContent = '合鍵（または合鍵付きURL）を貼り付けてください'; return; }
  localStorage.setItem(LS.KEY, k);
  const u = $('setupUrl').value.trim();
  if (u) localStorage.setItem(LS.URL, u); else localStorage.removeItem(LS.URL);
  $('setup').classList.add('hidden');
  loadHome();
});
if ($('btnReSetup')) $('btnReSetup').addEventListener('click', () => showSetup());

/* ==== util ==== */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escAttr(s) { return esc(s); }


/* ==== 起動 ==== */
if ('serviceWorker' in navigator) {
  // 起動毎に更新チェック＋新版が制御を取ったら1回だけ自動リロード＝「開き直し2回」問題の根絶
  navigator.serviceWorker.register('sw.js').then(reg => { try { reg.update(); } catch (e) {} }).catch(() => {});
  let _swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swReloaded) return; _swReloaded = true; location.reload();
  });
}
setOffline(!navigator.onLine);
try { metView('pwahome', (window.performance && performance.now) ? performance.now() : 0) } catch (e) {}   // 📊起動＝表示ms
schedApply(schedOpen());   // 🆕起動時にスケジュール開閉状態を復元（既定=開）
if ($('hmLabel')) $('hmLabel').textContent = ymLabel(hmYm) + '（当月）';
if ($('hmNext')) $('hmNext').disabled = true;   // 起動時=当月（未来月へは進めない）
/* 🔑合鍵付きURL（2026-08-20 松原「スマホ再インストール用に合鍵付きURLを発行したい」）：
 *   ?k=（＋任意で&u=）を開いた瞬間に端末へ保存し、**URLバーと履歴から即座に消す**
 *   ＝リンクを誰かに転送しても・履歴に残っても、鍵が露出しない設計。 */
try {
  const q9 = new URLSearchParams(location.search);
  const qk9 = normKey(q9.get('k') || '');
  if (qk9) {
    localStorage.setItem(LS.KEY, qk9);
    const qu9 = (q9.get('u') || '').trim();
    if (qu9) localStorage.setItem(LS.URL, qu9);
    history.replaceState(null, '', location.pathname);
  }
} catch (e) {}
if (!localStorage.getItem(LS.KEY)) showSetup();
else loadHome();


/* ==== 🗓 予定を登録（4モード・2026-07-29）＝ブラウザ版と同じ決定論ロジック ====
   🔴件名に管理番号が入らないと「定期MTG n/20」に計上されない。だからAI任せにせず型で組む。 */
let calMode4 = 'free', calDrafts4 = null;

function calHM4(x) {
  x = String(x || '').trim().replace(/：/g, ':').replace(/(\d{1,2})時半/, '$1:30')
       .replace(/(\d{1,2})時(\d{1,2})分?/, '$1:$2').replace(/(\d{1,2})時/, '$1:00');
  const m = x.match(/^(\d{1,2}):(\d{2})$/) || x.match(/^(\d{1,2})(\d{2})$/) || x.match(/^(\d{1,2})$/);
  if (!m) return null;
  const hh = +m[1], mi = +(m[2] || 0);
  if (hh > 23 || mi > 59) return null;
  return ('0' + hh).slice(-2) + ':' + ('0' + mi).slice(-2);
}
function calShift4(date, hm, min) {
  const d = new Date(date + 'T' + hm + ':00');
  const e = new Date(d.getTime() + min * 60000);
  return e.getFullYear() + '-' + ('0' + (e.getMonth() + 1)).slice(-2) + '-' + ('0' + e.getDate()).slice(-2) +
         'T' + ('0' + e.getHours()).slice(-2) + ':' + ('0' + e.getMinutes()).slice(-2);
}
function calMShow4(evs) {
  calDrafts4 = evs;
  const b = $('calMBody');
  if (!b) return;
  b.textContent = evs.map(e => '・' + e.title + '\n　' + e.start.replace('T', ' ') + ' 〜 ' + e.end.replace('T', ' ')).join('\n');
  $('calMDraft').classList.remove('hidden');
}
function calErr4(m) { const r = $('calMResult'); if (r) { r.className = 'result ng'; r.textContent = m; r.classList.remove('hidden'); } }

function calBuildTask4() {
  const ti = ($('ctTitle').value || '').trim(), dt = $('ctDate').value;
  if (!ti) return calErr4('内容を書いてください');
  if (!dt) return calErr4('対象日を選んでください');
  const lines = ($('ctTimes').value || '').split(/\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return calErr4('時間帯を1行以上書いてください（例 10:30-11:00）');
  const evs = [], bad = [];
  lines.forEach(ln => {
    const p = ln.split(/[-−~〜]/);
    const s1 = calHM4(p[0]), e1 = calHM4(p[1]);
    if (!s1 || !e1 || s1 >= e1) { bad.push(ln); return; }
    evs.push({ title: '【タスク】' + ti, start: dt + 'T' + s1, end: dt + 'T' + e1 });
  });
  if (bad.length) return calErr4('読めない時間帯があります：' + bad.join(' / '));
  calMShow4(evs);
}
function calBuildMtg4() {
  const how = $('cmHow').value, k = ($('cmKanri').value || '').trim(), sal = ($('cmSalon').value || '').trim();
  const ta = ($('cmTanto').value || '').trim(), dt = $('cmDate').value, st = calHM4($('cmStart').value);
  const du = parseInt($('cmDur').value, 10) || 30;
  if (!k) return calErr4('管理番号を書いてください');
  if (!sal) return calErr4('サロン名が未入力です（番号から自動で入ります）');
  if (!ta) return calErr4('担当者名を書いてください');
  if (!dt || !st) return calErr4('日付と開始時刻を書いてください');
  const base = k + '：' + sal + ' ' + ta + '様｜定期MTG';
  calMShow4([
    { title: '【タスク】' + base + '準備', start: calShift4(dt, st, -30), end: dt + 'T' + st },
    { title: '【' + how + '】' + base, start: dt + 'T' + st, end: calShift4(dt, st, du), online: how === 'オンライン' },
    { title: '【タスク】' + base + '振り返り', start: calShift4(dt, st, du), end: calShift4(dt, st, du + 30) },
  ]);
}
function calBuildAdv4() {
  const how = $('cvHow').value, nm = ($('cvName').value || '').trim(), k = ($('cvKanri').value || '').trim();
  const sal = ($('cvSalon').value || '').trim(), dt = $('cvDate').value, st = calHM4($('cvStart').value);
  const du = parseInt($('cvDur').value, 10) || 60;
  if (!nm) return calErr4('お客様名を書いてください');
  if (!k) return calErr4('紹介元の管理番号を書いてください');
  if (!sal) return calErr4('紹介元サロン名が未入力です（番号から自動で入ります）');
  if (!dt || !st) return calErr4('日付と開始時刻を書いてください');
  const base = nm + '　※紹介元：' + k + '_' + sal + '｜受診アドバイザー対応';
  calMShow4([
    { title: '【タスク】' + base + '準備', start: calShift4(dt, st, -30), end: dt + 'T' + st },
    { title: '【' + how + '】' + base, start: dt + 'T' + st, end: calShift4(dt, st, du), online: how === 'オンライン' },
    { title: '【タスク】' + base + '振り返り', start: calShift4(dt, st, du), end: calShift4(dt, st, du + 30) },
  ]);
}

/* 管理番号→サロン名の自動補完（手打ちのブレが件名判定を外すのを防ぐ） */
async function calKanriFill(kanriId, salonId) {
  const k = ($(kanriId).value || '').trim();
  if (!/^\d{3,6}$/.test(k)) return;
  try {
    const r = await api({ api: 'kanriName', kanri: k });
    if (r && r.name) $(salonId).value = r.name;
  } catch (e) {}
}

function calModeShow(m) {
  calMode4 = m;
  document.querySelectorAll('#calModeChips .chip').forEach(c => c.classList.toggle('on', c.dataset.cal === m));
  ['task', 'mtg', 'adv'].forEach(x => {
    const el = $('calM_' + x);
    if (el) el.classList.toggle('hidden', x !== m);
  });
  // 自由記述もタブの1つ＝他のモードと同じ出し入れにする（欄が別カードに残る食い違いの解消）
  const fr = $('calM_free');
  if (fr) fr.classList.toggle('hidden', m !== 'free');
  const bb = $('btnCalBuild');
  if (bb) bb.classList.toggle('hidden', m === 'free');
  $('calMDraft').classList.add('hidden');
  calDrafts4 = null;
}

async function calMultiGo() {
  if (!calDrafts4 || !calDrafts4.length) return;
  const go = $('btnCalMGo'), res = $('calMResult');
  go.disabled = true; go.textContent = '登録中…';
  try {
    const r = await api({ api: 'calMulti', payload: { events: calDrafts4 } });
    res.className = 'result ' + (r.ok ? 'ok' : 'ng');
    res.textContent = r.msg || (r.ok ? '登録しました' : '登録に失敗しました');
    if (r.ng && r.ng.length) res.textContent += '\n⚠️ ' + r.ng.join('\n');
    res.classList.remove('hidden');
    if (r.ok) {
      // 🔴成功したときだけ消す（失敗して消すと全部打ち直しになる）
      ['ctTitle', 'ctTimes', 'cmKanri', 'cmSalon', 'cmTanto', 'cmStart', 'cvName', 'cvKanri', 'cvSalon', 'cvStart']
        .forEach(id => { const e = $(id); if (e) e.value = ''; });
      $('calMDraft').classList.add('hidden');
      calDrafts4 = null;
    }
  } catch (e) {
    res.className = 'result ng'; res.textContent = e.message; res.classList.remove('hidden');
  }
  go.disabled = false; go.textContent = 'この内容で登録する';
}

/* ==== ✍️ 文体ラボ（2026-07-29） ==== */
let stCh4 = 'slack', stTone4 = 'normal';
async function stWrite4() {
  const v = ($('stIn').value || '').trim();
  const res = $('stResult');
  if (!v) { res.className = 'result ng'; res.textContent = '話した内容を入れてください'; res.classList.remove('hidden'); return; }
  const b = $('btnStWrite');
  b.disabled = true; b.textContent = '整えています…';
  res.className = 'result'; res.textContent = '✍️ いつもの言い方に整えています…'; res.classList.remove('hidden');
  try {
    const r = await api({ api: 'styleWrite', voice: v, ch: stCh4, tone: stTone4, to: ($('stTo').value || '') });
    if (!r.ok) throw new Error(r.msg || '整えられませんでした');
    $('stOut').value = r.text || '';
    $('stOutWrap').classList.remove('hidden');
    let ft = (r.fixes && r.fixes.length) ? ('🔧 整えた箇所：' + r.fixes.join('／')) : '🔧 整える箇所はありませんでした';
    if (r.warns && r.warns.length) ft += '\n⚠️ ' + r.warns.join('／');
    $('stFix').textContent = ft;
    res.className = 'result ok';
    res.textContent = '✅ 整えました（型' + (r.pairs || 0) + '件・骨格' + (r.skel || 0) + '件を参照' +
                      (r.shots ? '＋あなたの文' + r.shots + '件' : '') + '）';
  } catch (e) {
    res.className = 'result ng'; res.textContent = e.message;
  }
  b.disabled = false; b.textContent = '✍️ いつもの僕の文章にする';
}

function wireCal4AndStyle() {
  const chips = $('calModeChips');
  if (chips) chips.addEventListener('click', ev => {
    const c = ev.target.closest('button[data-cal]');
    if (c) calModeShow(c.dataset.cal);
  });
  const bb = $('btnCalBuild');
  if (bb) bb.addEventListener('click', () => {
    $('calMResult').classList.add('hidden');
    if (calMode4 === 'task') calBuildTask4();
    else if (calMode4 === 'mtg') calBuildMtg4();
    else if (calMode4 === 'adv') calBuildAdv4();
  });
  const gg = $('btnCalMGo');
  if (gg) gg.addEventListener('click', calMultiGo);
  const ck = $('cmKanri'); if (ck) ck.addEventListener('blur', () => calKanriFill('cmKanri', 'cmSalon'));
  const vk = $('cvKanri'); if (vk) vk.addEventListener('blur', () => calKanriFill('cvKanri', 'cvSalon'));
  // 日付の初期値は開くたびに入れ直す（開きっぱなしで日を跨いでも前日にならない）
  ['ctDate', 'cmDate', 'cvDate'].forEach(id => {
    const e = $(id);
    if (e && !e.value) { const d = new Date(); e.value = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  });

  const cc = $('stChChips');
  if (cc) cc.addEventListener('click', ev => {
    const c = ev.target.closest('button[data-stch]');
    if (!c) return;
    stCh4 = c.dataset.stch;
    cc.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
  });
  const tc = $('stToneChips');
  if (tc) tc.addEventListener('click', ev => {
    const c = ev.target.closest('button[data-sttone]');
    if (!c) return;
    stTone4 = c.dataset.sttone;
    tc.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
  });
  const sw = $('btnStWrite'); if (sw) sw.addEventListener('click', stWrite4);
  const sc = $('btnStCopy');
  if (sc) sc.addEventListener('click', () => { try { navigator.clipboard.writeText($('stOut').value); showOk('コピーしました'); } catch (e) {} });
  const sp = $('btnStPolite'); if (sp) sp.addEventListener('click', () => { stTone4 = 'polite'; stWrite4(); });
  const ss = $('btnStShort'); if (ss) ss.addEventListener('click', () => { stTone4 = 'short'; stWrite4(); });
  calModeShow('free');
}
document.addEventListener('DOMContentLoaded', wireCal4AndStyle);

/* ════════ 🔴2026-08-02 松原指示（スマホアプリ版）════════
 *   ① タスクの一覧・追加・編集・ステータス・削除（ブラウザ版と同じシートを触る）
 *   ② 今日の予定にMeetがあればその場から入れる（表示はrenderHome側で対応）
 *   ③ 日ごとのスケジュール確認＋カレンダー本体を開く
 *   通信はすべて既存の api()。合鍵はローカルのまま。 */
const todayYmd = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/* ── ③ 日ごとのスケジュール ── */
/* ════════ 🗑 撤廃済み（2026-08-20 b120 / sw v40） ════════
 * ここに 🌅修身レイヤー（素読 → 🧭6ニーズ → 今日の1問）のPWA実装が在った：
 *   SODOKU4 / CREDO4 / NEEDS4 / shushin4() / nd4Cnt() / nd4Load() / nd4Tgl() /
 *   oq4Render() / oq4Load() / oq4Save() / oq4Done()
 * 松原「添付スクショのコンテンツも撤廃してほしい。素晴らしい内容だが、機能していないから」。
 * 🔴PC版（rayly_cockpit.gs b120）と**同時**に撤去した。素読はapi非依存の定数ベタ持ちだったため、
 *   PC側だけ消すとスマホにだけ生き残る＝いちばん質の悪い不整合になるところだった。
 * 🔴叩いていたサーバ口（doPost needsGet/needsToggle/oneqGet/oneqSave/oneqDone）も同時に撤去済み。
 * 🔴データは1バイトも消していない（needs / oneq シート・Vaultのジャーナリング記録は健在）。
 * 🔴復活には意図的な変更が要る＝verify_v59_pwa_shushin.js が不在を機械固定している。 */

function scYmd4() {
  const e = $('scD'); if (!e) return '';
  if (!e.value) e.value = todayYmd();
  return e.value;
}
function scCalLink4() {
  const a = $('scCal'); if (!a) return;
  const p = scYmd4().split('-');
  if (p.length === 3) a.href = 'https://calendar.google.com/calendar/u/0/r/day/' + p[0] + '/' + (+p[1]) + '/' + (+p[2]);
}
/* 📆b67：日⇄週セグメント（ブラウザ版b63と同格）。‹›は週表示で±7日・読み直しは表示中の方だけ */
let _scv4 = 'day';
function scGo4() { scCalLink4(); if (_scv4 === 'week') scWkLoad4(); else scLoad4(); }
function scView4(m) {
  _scv4 = (m === 'week') ? 'week' : 'day';
  const wk = _scv4 === 'week';
  const d9 = $('schedList'), w9 = $('scWk'), vd = $('scVd4'), vw = $('scVw4');
  if (!d9 || !w9) return;
  d9.classList.toggle('hidden', wk);
  w9.classList.toggle('hidden', !wk);
  if (vd) vd.classList.toggle('on', !wk);
  if (vw) vw.classList.toggle('on', wk);
  try { localStorage.setItem('cpScV4', _scv4); } catch (e) {}
  if (wk && !w9.dataset.done) scWkLoad4();
}
function scDay4(n) {
  const e = $('scD'); if (!e) return;
  const p = scYmd4().split('-');
  e.value = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * (_scv4 === 'week' ? 7 : 1) * 86400000).toISOString().slice(0, 10);
  scGo4();
}
async function scLoad4() {
  const ul = $('schedList'); if (!ul) return;
  scCalLink4();
  const ymd = scYmd4();
  ul.innerHTML = '<li class="muted">読み込み中…</li>';
  try {
    const r = await api({ api: 'schedDay', ymd });
    if (!r || !r.ok) { ul.innerHTML = '<li class="muted">⚠️ ' + esc((r && r.msg) || '読めませんでした') + '</li>'; return; }
    lastSched = r.items || [];
    if (!lastSched.length) { ul.innerHTML = '<li class="muted">' + esc(r.label) + 'の予定はありません</li>'; return; }
    ul.innerHTML = '';
    lastSched.forEach(s => ul.appendChild(schedLi4(s)));
    schedApply(schedOpen());
  } catch (e) { ul.innerHTML = '<li class="muted">⚠️ ' + esc(e.message) + '</li>'; }
}
/* ②Meet つきの1行（renderHomeからも使う＝表示の作り方を1つにする） */
function schedLi4(s) {
  const li = document.createElement('li');
  if (s.routine) li.classList.add('routine');
  const tag = s.tag
    ? `<span class="tag" style="background:${escAttr(s.tagColor || '#8e8e93')}">${esc(s.tag)}</span>` : '';
  /* 🔴2026-08-04 松原指示：カレンダーを開きに行かず、ここから会議に入る。
     件名が【オンライン】なのにURLが無いときは、先方の発行漏れを静かに知らせる。 */
  const meet = s.meet
    ? `<a class="mt" href="${escAttr(s.meet)}" target="_blank" rel="noopener">📹 オンライン開始</a>`
    : (s.noLink ? '<i class="mtn">リンク未発行</i>' : '');
  /* 🔴2026-08-04 松原指示：ここから直せるようにする。
     自分のカレンダーの予定だけ（s.who＝メンバーの予定は読むだけ・触らない）。 */
  const canEdit = !!s.id && !s.who;
  li.innerHTML = `<span class="t">${esc(s.t || '')}</span><span class="title">${esc(s.title || '')}${meet}</span>${tag}` +
    (canEdit ? '<button class="evx" aria-label="この予定を直す">✏️</button>' : '');
  if (canEdit) {
    li.dataset.eid = s.id;
    li.querySelector('.evx').addEventListener('click', () => scEdit4(li));
  }
  /* 💬b70（sw v38）：受診後FB行＝スケジュールの中でFB案（薬機法・個人情報準拠）／所見未更新表示。母艦と同格 */
  const t9 = String(s.title || '').trim();
  if (/^【タスク】/.test(t9) && /受診後FB$/.test(t9)) {
    const fb = document.createElement('button');
    fb.className = 'evx'; fb.textContent = '💬'; fb.setAttribute('aria-label', '受診後FB案');
    fb.addEventListener('click', () => fbSc4(li, t9));
    li.appendChild(fb);
  }
  return li;
}
async function fbSc4(li, title) {
  const ex = li.querySelector('.evp'); if (ex) { ex.remove(); return; }
  document.querySelectorAll('.evp').forEach(x => x.remove());
  const p = document.createElement('div'); p.className = 'evp';
  p.innerHTML = '<div class="muted">🩺 所見を確認してFB案を作っています…</div>';
  li.appendChild(p);
  try {
    const r = await api({ api: 'fbSched', title });
    p.textContent = '';
    if (!(r && r.ok)) { p.innerHTML = '<div class="note bad"></div>'; p.firstChild.textContent = (r && r.msg) || '生成できませんでした'; return; }
    if (r.pending) { p.innerHTML = '<div class="note bad"></div>'; p.firstChild.textContent = r.msg; return; }
    const h = document.createElement('div'); h.className = 'evp-h';
    h.textContent = '💬 ' + (r.name || '') + ' 様の受診後FB案';
    const ta = document.createElement('textarea'); ta.readOnly = true; ta.value = r.text;
    ta.style.minHeight = '180px';
    const cp = document.createElement('button'); cp.className = 'chip'; cp.textContent = '📋 コピー';
    cp.addEventListener('click', () => { try { navigator.clipboard.writeText(r.text); showOk('コピーしました'); } catch (e) {} });
    p.appendChild(h); p.appendChild(ta); p.appendChild(cp);
  } catch (e) { p.innerHTML = '<div class="note bad"></div>'; p.firstChild.textContent = e.message; }
}
/* 📹2026-08-04：GoogleのUIから付けたMeetは説明文に入らない（conferenceDataに入る）。
   ホームの一覧はそれを知らずに描かれるので、あとからリンクだけを取りに行って埋める。
   一覧を作り直さないので、ちらつかない。 */
async function scFillLinks4(ymd) {
  const ul = $('schedList'); if (!ul) return;
  const rows = ul.querySelectorAll('li[data-eid]'); if (!rows.length) return;
  /* 🔴読めなかったときは黙らない（「発行済なのに何も出ない」を二度と起こさない・2026-08-04 実害） */
  const note = (h) => { const w = $('scLinkWarn'); if (!w) return;
    if (!h) { w.classList.add('hidden'); w.textContent = ''; return; }
    w.classList.remove('hidden'); w.textContent = h; };
  try {
    const r = await api({ api: 'schedLinks', ymd: ymd || todayYmd(), force: false });
    if (!(r && r.ok)) { note('⚠️ オンライン会議のリンクを読めませんでした'); return; }
    if (r.err) { note('⚠️ オンライン会議のリンクを読めませんでした。' +
      'GASエディタの左「サービス」＋から Calendar API を追加してください'); return; }
    note('');
    ul.querySelectorAll('li[data-eid]').forEach(li => {
      const n = li.querySelector('.title'); if (!n) return;
      if (n.querySelector('.mt') || n.querySelector('.mtn')) return;
      const u = r.by[(li.dataset.eid || '').split('@')[0]] || '';
      if (u) {
        const a = document.createElement('a');
        a.className = 'mt'; a.href = u; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = '📹 オンライン開始'; n.appendChild(a); return;
      }
      /* 確かめたうえで無かったときだけ「未発行」と言う */
      if (n.textContent.indexOf('【オンライン】') >= 0) {
        const i = document.createElement('i'); i.className = 'mtn'; i.textContent = 'リンク未発行';
        n.appendChild(i);
      }
    });
  } catch (e) { note('⚠️ オンライン会議のリンクを読めませんでした：' + e.message); }
}
/* 📆週表示（b67全面リビルド＝ブラウザ版b63と同格）：曜日ヘッダタップで日表示へ・
   列は横スクロール+スナップ・列の中は縦スクロール（「ほか◯件」で隠さない） */
async function scWkLoad4() {
  const w = $('scWk'); if (!w) return;
  w.innerHTML = '<div class="muted">読み込み中…</div>';
  delete w.dataset.done;
  try {
    const r = await api({ api: 'schedWeek', ymd: scYmd4() });
    if (!(r && r.ok)) { w.innerHTML = '<div class="muted">⚠️ ' + esc((r && r.msg) || '読み込めませんでした') + '</div>'; return; }
    w.innerHTML = (r.warn && r.warn.length ? '<div class="note bad">⚠️ ' + esc(r.warn.join(' ／ ')) + '</div>' : '') +
      '<div class="wkg">' + r.days.map(d =>
        '<div class="wkd' + (d.today ? ' cur' : '') + ((d.wk === 0 || d.wk === 6) ? ' end' : '') + '">' +
        '<button class="wkh" type="button" data-ymd="' + escAttr(d.ymd) + '" title="タップでこの日の日表示">' +
        esc(d.label) + (d.today ? '・今日' : '') + '</button>' +
        (d.items.length ? d.items.map(e =>
          '<div class="wki' + (e.routine ? ' rt' : '') + '"><b>' +
          esc(e.t === '終日' ? '終日' : String(e.t).split('–')[0]) + '</b><span>' + esc(e.title) + '</span>' +
          (e.who ? '<i class="tag">' + esc(e.who) + '</i>' : '') + '</div>').join('')
          : '<div class="wke">予定なし</div>') +
        (d.more ? '<div class="wke">ほか' + d.more + '件（日表示で全部見る）</div>' : '') +
        '</div>').join('') + '</div>';
    w.dataset.done = '1';
    /* 曜日ヘッダタップ＝その日の日表示へ（日⇄週の行き来を1タップに） */
    w.querySelectorAll('.wkh').forEach(b2 => b2.addEventListener('click', () => {
      const d = $('scD'); if (!d) return;
      d.value = b2.dataset.ymd; scView4('day'); scLoad4();
      const c = $('schedCard'); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth' });
    }));
    const cu = w.querySelector('.wkd.cur');
    if (cu && cu.scrollIntoView) try { cu.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  } catch (e) { w.innerHTML = '<div class="muted">⚠️ ' + esc(e.message) + '</div>'; }
}
/* ✏️予定をその場で直す（Googleカレンダー本体を書き換える）。ブラウザ版と同じ門番・同じ言い方。
   🔴開いた時点で「直せるか」「ゲストに通知が飛ぶか」を先に出す。押してから知るのでは遅い。 */
function scEdit4(li) {
  const ex = li.querySelector('.evp');
  if (ex) { ex.remove(); return; }
  document.querySelectorAll('.evp').forEach(x => x.remove());
  const eid = li.dataset.eid || ''; if (!eid) return;
  const p = document.createElement('div'); p.className = 'evp';
  p.innerHTML = '<div class="muted">読み込み中…</div>';
  li.appendChild(p);
  api({ api: 'schedEvGet', id: eid }).then(r => {
    if (!(r && r.ok)) { p.innerHTML = '<div class="muted">⚠️ ' + esc((r && r.msg) || '読み込めませんでした') + '</div>'; return; }
    scForm4(p, r);
  }).catch(e => { p.innerHTML = '<div class="muted">⚠️ ' + esc(e.message) + '</div>'; });
}
function scForm4(p, r) {
  p.innerHTML = '<div class="evp-h">✏️ この予定を直す</div>' +
    '<div class="note s0" style="display:none"></div>' +
    '<label>内容</label><input class="s1">' +
    '<div class="g2b"><div><label>日</label><input type="date" class="s2"></div>' +
    '<div><label>開始</label><input type="time" class="s3"></div>' +
    '<div><label>終了</label><input type="time" class="s4"></div></div>' +
    '<label class="s9w"><input type="checkbox" class="s9">終日にする</label>' +
    '<label>場所</label><input class="s5">' +
    '<label>メモ</label><textarea class="s6" rows="2"></textarea>' +
    '<div class="evp-b"><button class="btn s7">この内容で直す</button>' +
    '<button class="chip s8">🗑 この予定を消す</button></div>' +
    '<div class="note s10" style="display:none"></div>';
  const q = c => p.querySelector(c);
  q('.s1').value = r.title || ''; q('.s2').value = r.date || '';
  q('.s3').value = r.start || ''; q('.s4').value = r.end || '';
  q('.s5').value = r.loc || ''; q('.s6').value = r.desc || '';
  q('.s9').checked = !!r.allday;
  const syncAll = () => { const a = q('.s9').checked; q('.s3').disabled = a; q('.s4').disabled = a; };
  q('.s9').addEventListener('change', syncAll); syncAll();
  const head = [];
  if (r.lock) head.push('🔴 ' + r.lock);
  if (r.guests) head.push('👥 ゲスト' + r.guests + '名。日時や内容を直すと全員に通知が飛びます');
  if (head.length) {
    const h = q('.s0'); h.style.display = 'block'; h.textContent = '';
    head.forEach((t, i) => { if (i) h.appendChild(document.createElement('br')); h.appendChild(document.createTextNode(t)); });
    if (r.lock) h.className = 'note s0 bad';
  }
  if (r.lock) { ['.s1', '.s2', '.s3', '.s4', '.s5', '.s6', '.s7', '.s8', '.s9'].forEach(c => { q(c).disabled = true; }); return; }
  const say = (s, ng) => { const m = q('.s10'); m.style.display = 'block'; m.textContent = s; m.className = 'note s10' + (ng ? ' bad' : ''); };
  q('.s7').addEventListener('click', async () => {
    const ti = (q('.s1').value || '').trim(), dt = q('.s2').value, ad = q('.s9').checked;
    if (!ti) { say('内容を入れてください', true); return; }
    if (!dt) { say('日を選んでください', true); return; }
    if (!ad && (!q('.s3').value || !q('.s4').value)) { say('開始と終了の時刻を入れてください', true); return; }
    if (!ad && q('.s3').value >= q('.s4').value) { say('終了は開始より後にしてください', true); return; }
    if (r.guests && !confirm('ゲスト' + r.guests + '名に変更の通知が飛びます。よろしいですか？')) return;
    const b = q('.s7'); b.disabled = true; b.textContent = '保存中…';
    try {
      const x = await api({ api: 'schedEvSave', t: { id: r.id, title: ti, date: dt, allday: ad,
        start: q('.s3').value, end: q('.s4').value, loc: q('.s5').value, desc: q('.s6').value } });
      b.disabled = false; b.textContent = 'この内容で直す';
      if (!(x && x.ok)) { say((x && x.msg) || '直せませんでした', true); return; }
      showOk(x.msg || '直しました');
      setTimeout(() => { scLoad4(); tkLoad4(false); }, 1000);
    } catch (e) { b.disabled = false; b.textContent = 'この内容で直す'; say('通信エラー：' + e.message, true); }
  });
  q('.s8').addEventListener('click', async () => {
    if (!confirm('「' + (r.title || '(無題)') + '」をGoogleカレンダーから消します。元に戻せません。' +
      (r.guests ? 'ゲスト' + r.guests + '名に取消が通知されます。' : '') + 'よろしいですか？')) return;
    const b = q('.s8'); b.disabled = true; b.textContent = '削除中…';
    try {
      const x = await api({ api: 'schedEvDelete', t: { id: r.id, confirm: true } });
      b.disabled = false; b.textContent = '🗑 この予定を消す';
      if (!(x && x.ok)) { say((x && x.msg) || '消せませんでした', true); return; }
      showOk(x.msg || '消しました');
      setTimeout(() => { scLoad4(); tkLoad4(false); }, 800);
    } catch (e) { b.disabled = false; b.textContent = '🗑 この予定を消す'; say('通信エラー：' + e.message, true); }
  });
  setTimeout(() => q('.s1').focus(), 60);
}

/* ── ① タスク ── */
let TK4 = null, TKDone4 = false, TKBrain4 = false;
async function tkLoad4(loud) {
  if (!$('tkList')) return;
  try {
    const r = await api({ api: 'tasks', done: TKDone4 });
    if (!r || !r.ok) { if (loud) showErr((r && r.msg) || '読み込めませんでした'); return; }
    TK4 = r; tkDraw4();
  } catch (e) { if (loud) showErr(e.message); }
}
/* 🧠2026-08-04 松原の定義：「残タスク＝脳のリソース（スペース・余裕）を奪っていくもの」。
 *   奪うのは件数ではなく“まだ頭で持ち続けている数”。理想は0件
 *   （やることが無い、ではなく「覚えておく必要が無い」状態）。
 *   ・4を基準線に置く＝同時に保持できるのは約4チャンク（Cowan 2001）
 *   ・予定に入れた時点で頭から降りる（Masicampo & Baumeister 2011）＝📅が唯一のレバー */
function tkBrain4() {
  const n = $('tkBn'); if (!n || !TK4) return;
  /* 🔴2026-08-05 再定義：未着手(yet)は予定に入れても頭から降りない。降ろせた=進行中×予定あり */
  const c = TK4.count || {}, ye = c.yet || 0, mi = c.mid || 0, he = c.held || 0;
  const b = ye + mi, t = b + he;
  n.textContent = b;
  n.style.color = b > 4 ? 'var(--warn)' : (b ? 'var(--ink)' : 'var(--ok)');
  const l = $('tkBl');
  if (l) l.textContent = b ? 'を、まだ頭が抱えています' : '件。いま頭は空いています';
  const bb = $('tkBb'); if (bb) bb.hidden = !t;
  const w = (x) => t ? ((Math.round(x / t * 1000) / 10) + '%') : '0%';
  [['tkB1', ye, 'var(--warn)'], ['tkB2', mi, 'var(--sub)'], ['tkB3', he, 'var(--ok)']].forEach(x => {
    const e = $(x[0]); if (e) { e.style.width = w(x[1]); e.style.background = x[2]; }
  });
  const k = $('tkBk');
  if (k) {
    k.innerHTML = '';
    [['var(--warn)', '未着手のまま', ye], ['var(--sub)', '進行中・予定なし', mi],
     ['var(--ok)', '進行中×予定あり＝降ろせた', he]].forEach(x => {
      const s = document.createElement('span');
      const i = document.createElement('em'); i.style.background = x[0]; s.appendChild(i);
      s.appendChild(document.createTextNode(x[1] + ' ' + x[2]));
      k.appendChild(s);
    });
  }
  const q = $('tkBs'); if (!q) return;
  q.textContent = b === 0
    ? (t ? '理想の状態です。動いているものは予定に載り、覚えておく必要はありません。' : 'タスクはありません。')
    : (ye > 0
      ? 'このまま残れば——未着手' + ye + '件は開いたループとして回り続け（ツァイガルニク効果）、「決めたのに動いていない」記録が自己効力感を目減りさせます。特効薬は最初の5分だけの着手＝進行中に変わった瞬間、ループは閉じ始めます。'
      : '同時に抱えられるのは4つ前後。進行中' + mi + '件は📅で置き場所を決めると頭から降ります。');
}
function tkDraw4() {
  const host = $('tkList'), cnt = $('tkCnt');
  if (!host || !TK4) return;
  host.innerHTML = '';
  if (cnt) cnt.textContent = '未着手 ' + (TK4.count['未着手'] || 0) + '／進行中 ' + (TK4.count['進行中'] || 0) +
    (TK4.count.over ? '　🔴期限切れ ' + TK4.count.over : '');
  tkBrain4();
  const bt = $('tkBrainTgl'); if (bt) bt.className = 'chip' + (TKBrain4 ? ' on' : '');
  /* 🧠絞り込みは画面側だけで完結（サーバを往復しない＝押した瞬間に切り替わる） */
  let rows = TK4.rows || [];
  if (TKBrain4) rows = rows.filter(t => t.status === '未着手' || (t.status !== '完了' && !(TK4.ev && TK4.ev[t.id])));
  if (!rows.length) {
    host.innerHTML = '<div class="muted" style="padding:8px 0">' +
      (TKBrain4 ? '頭に残っているものはありません' : (TKDone4 ? 'タスクはありません' : '未完了のタスクはありません')) + '</div>';
    return;
  }
  rows.forEach(t => host.appendChild(tkRow4(t)));
}
function tkRow4(t) {
  const d = document.createElement('div');
  d.className = 'tk-row' + (t.status === '完了' ? ' tk-done' : '');
  const m = document.createElement('div'); m.className = 'tk-main';
  const ti = document.createElement('div'); ti.className = 'tk-title'; ti.textContent = t.title; m.appendChild(ti);
  const meta = [], ev9 = (TK4 && TK4.ev) ? TK4.ev[t.id] : null;
  /* 🧠2026-08-04：置き場所が決まっていないものだけに印を付ける。
     予定に入れた行は代わりに実行予定日時を出す（松原指示）。 */
  if (t.status === '未着手' || (t.status !== '完了' && !ev9)) meta.push('🧠 まだ頭の中');
  if (ev9 && ev9.t) meta.push('📅 ' + ev9.t);
  if (t.due) meta.push('アクション ' + t.due);
  if (t.due2) meta.push('アライメント ' + t.due2);
  if (t.salon) meta.push(t.salon); else if (t.kanri) meta.push('#' + t.kanri);
  if (meta.length) {
    const mm = document.createElement('div');
    /* 🔴どちらの期限でも、割っていれば赤 */
    mm.className = 'tk-meta' + (t.status !== '完了' && TK4 &&
      ((t.due && t.due < TK4.today) || (t.due2 && t.due2 < TK4.today)) ? ' over' : '');
    mm.textContent = meta.join('　/　'); m.appendChild(mm);
  }
  d.appendChild(m);
  const b = document.createElement('div'); b.className = 'tk-btns';
  /* ⚡第4手のPWA同格化（2026-08-07）：押した瞬間に色が変わる。だめなら色ごと戻して理由を言う。
     成功時は無言＝反転そのものが返事（完了のundoトーストだけは維持） */
  const flip4 = v => b.querySelectorAll('.chip').forEach(x => {
    if (x.textContent === '未着手' || x.textContent === '進行中' || x.textContent === '完了')
      x.classList.toggle('on', x.textContent === v);
  });
  ['未着手', '進行中', '完了'].forEach(s => {
    const c = document.createElement('button');
    c.className = 'chip' + (t.status === s ? ' on' : ''); c.textContent = s;
    c.addEventListener('click', async () => {
      if (t.status === s) return;
      const old = t.status; t.status = s; flip4(s);
      try { const r = await api({ api: 'taskStatus', id: t.id, status: s });
        /* ↩️完了だけは戻せる表示（押し間違いの代償が最も大きい） */
        if (s === '完了' && r.undo) showUndo(r.msg, r.undo, () => tkLoad4(false));
        tkLoad4(false);
      } catch (e) { t.status = old; flip4(old); showErr(e.message); }
    });
    b.appendChild(c);
  });
  /* 🔴2026-08-04：📅で予定に入れる／入れてあれば直す。頭から降ろす唯一のレバーなので、
     数字（脳の空きメーター）と同じ画面・同じ行に置く。ブラウザ版と同じサーバを叩く。 */
  const hasEv = !!(TK4 && TK4.ev && TK4.ev[t.id]);
  const cal = document.createElement('button');
  cal.className = 'chip'; cal.textContent = hasEv ? '📅 予定を編集' : '📅 予定に入れる';
  cal.addEventListener('click', () => tkCal4(t, d, cal));
  b.appendChild(cal);
  /* 🔴編集（松原指示①）。行の中で開く＝一覧に戻らずに直せる */
  const ed = document.createElement('button');
  ed.className = 'chip'; ed.textContent = '✏️ 直す';
  ed.addEventListener('click', () => tkEdit4(t, d));
  b.appendChild(ed);
  const del = document.createElement('button');
  del.className = 'chip'; del.textContent = '消す';
  /* ↩️confirm廃止＝消してから「元に戻す」（2026-08-05 第1手） */
  del.addEventListener('click', async () => {
    try { const r = await api({ api: 'taskDelete', id: t.id });
      if (r && r.ok) { showUndo(r.msg || '消しました', r.undo, () => tkLoad4(false)); tkLoad4(false); }
      else showErr((r && r.msg) || '消せません');
    } catch (e) { showErr(e.message); }
  });
  b.appendChild(del);
  d.appendChild(b);
  return d;
}
function tkEdit4(t, row) {
  /* 🔴同じボタンなら閉じる／違うボタンなら差し替える。
     種類を見ずに閉じると、📅を開いたまま✏️を押したとき「閉じるだけ」になる（PC版で踏んだ罠）。 */
  const ex = row.querySelector('.tk-panel');
  if (ex && ex.dataset.k === 'edit') { ex.remove(); return; }
  document.querySelectorAll('.tk-panel').forEach(x => x.remove());
  const p = document.createElement('div'); p.className = 'tk-panel'; p.dataset.k = 'edit';
  p.innerHTML = '<label>やること</label><input class="e1">' +
    '<label>アクション期限（必須）</label><input type="date" class="e2">' +
    '<label>アライメント期限（任意）</label><input type="date" class="e7">' +
    '<label>管理番号</label><input class="e3" inputmode="numeric">' +
    '<label>メモ</label><textarea class="e4" rows="2"></textarea>' +
    '<button class="btn e5" style="margin-top:10px">この内容で直す</button>' +
    '<div class="note e6" style="display:none"></div>';
  p.querySelector('.e1').value = t.title || '';
  p.querySelector('.e2').value = t.due || '';
  p.querySelector('.e7').value = t.due2 || '';
  p.querySelector('.e3').value = t.kanri || '';
  p.querySelector('.e4').value = t.note || '';
  p.querySelector('.e5').addEventListener('click', async () => {
    const ti = (p.querySelector('.e1').value || '').trim();
    const note = p.querySelector('.e6');
    const say = (s) => { note.style.display = 'block'; note.className = 'note e6 bad'; note.textContent = s; };
    if (!ti) { say('やることを入れてください'); return; }
    if (!p.querySelector('.e2').value) { say('アクション期限（自分が動く日）を入れてください'); return; }
    const b = p.querySelector('.e5'); b.disabled = true; b.textContent = '保存中…';
    try {
      /* 🔴idを必ず渡す＝新規追加にならない。ステータスとサロンはそのまま持ち越す */
      const r = await api({ api: 'taskSave', t: { id: t.id, title: ti, status: t.status,
        due: p.querySelector('.e2').value, due2: p.querySelector('.e7').value,
        kanri: (p.querySelector('.e3').value || '').trim(),
        salon: t.salon || '', note: p.querySelector('.e4').value || '' } });
      b.disabled = false; b.textContent = 'この内容で直す';
      if (r && r.ok) { showOk(r.msg || '直しました'); tkLoad4(false); } else say((r && r.msg) || '直せませんでした');
    } catch (e) { b.disabled = false; b.textContent = 'この内容で直す'; say('通信エラー：' + e.message); }
  });
  row.appendChild(p);
  setTimeout(() => p.querySelector('.e1').focus(), 60);
}
/* 🔴時間帯を読む（ブラウザ版 calHM と同じ約束：10:30 / 10時半 / 1030 を受ける） */
function tkHM4(s) {
  s = String(s == null ? '' : s).trim();
  if (!s) return '';
  let m = s.match(/^(\d{1,2})\s*[:：]\s*(\d{1,2})$/);
  if (m) return ('0' + m[1]).slice(-2) + ':' + ('0' + m[2]).slice(-2);
  m = s.match(/^(\d{1,2})\s*時\s*(半|\d{1,2}分?)?$/);
  if (m) {
    const mi = !m[2] ? 0 : (m[2] === '半' ? 30 : parseInt(m[2], 10));
    if (isNaN(mi) || mi > 59) return '';
    return ('0' + m[1]).slice(-2) + ':' + ('0' + mi).slice(-2);
  }
  m = s.match(/^(\d{1,2})(\d{2})$/);
  if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];
  return '';
}
/* 🔴2026-08-04：タスクをその場で予定に入れる／入れてあれば直す（ブラウザ版と同じ作法）。
 *   一覧に戻らずに済ませる＝頭から降ろす操作を1タップの距離に置く。 */
function tkCal4(t, row, btn) {
  const ex = row.querySelector('.tk-panel');
  if (ex && ex.dataset.k === 'cal') { ex.remove(); return; }
  document.querySelectorAll('.tk-panel').forEach(x => x.remove());
  const p = document.createElement('div'); p.className = 'tk-panel'; p.dataset.k = 'cal';
  p.innerHTML = '<div class="bxl q0" style="margin-bottom:2px">📅 この場で予定にする</div>' +
    '<label>内容</label><input class="q1">' +
    '<label>対象日</label><input type="date" class="q2">' +
    '<label>時間帯（1行に1枠＝そのまま複数登録できます）</label>' +
    '<textarea class="q3" rows="2" placeholder="10:30-11:00&#10;14:00-15:30"></textarea>' +
    '<button class="btn q5" style="margin-top:10px">この内容で登録する</button>' +
    '<div class="note q4" style="display:none"></div>';
  p.querySelector('.q1').value = t.title || '';
  p.querySelector('.q2').value = t.due || todayYmd();
  const say = (s, ng) => { const m = p.querySelector('.q4');
    m.style.display = 'block'; m.className = 'note q4' + (ng ? ' bad' : ''); m.textContent = s; };
  const label = () => p.dataset.edit === '1' ? 'この内容で直す' : 'この内容で登録する';
  p.querySelector('.q5').addEventListener('click', async () => {
    const ti = (p.querySelector('.q1').value || '').trim(), dt = p.querySelector('.q2').value;
    if (!ti) { say('内容を入れてください', true); return; }
    if (!dt) { say('対象日を選んでください', true); return; }
    const lines = (p.querySelector('.q3').value || '').split(/\n/).map(x => x.trim()).filter(Boolean);
    if (!lines.length) { say('時間帯を1行以上書いてください（例 10:30-11:00）', true); return; }
    const slots = [], bad = [];
    lines.forEach(ln => {
      const q = ln.split(/[-〜~～]/), a = tkHM4(q[0]), b2 = tkHM4(q[1]);
      if (!a || !b2 || a >= b2) { bad.push(ln); return; }
      slots.push({ start: a, end: b2 });
    });
    if (bad.length) { say('読めない時間帯があります：' + bad.join(' / '), true); return; }
    const b = p.querySelector('.q5'); b.disabled = true; b.textContent = '保存中…';
    try {
      const r = await api({ api: 'taskEvSave', t: { taskId: t.id, title: ti, date: dt, slots } });
      b.disabled = false; b.textContent = label();
      if (!(r && r.ok)) { say((r && r.msg) || '保存できませんでした', true); return; }
      say(r.msg || '保存しました'); showOk(r.msg || '保存しました');
      if (TK4 && TK4.ev) TK4.ev[t.id] = { t: '' };
      if (btn) btn.textContent = '📅 予定を編集';
      setTimeout(() => { p.remove(); tkLoad4(false); }, 1500);
    } catch (e) { b.disabled = false; b.textContent = label(); say('通信エラー：' + e.message, true); }
  });
  row.appendChild(p);
  /* 🔴既に予定があるなら中身を出して「直す」画面にする（作り直しにならない） */
  api({ api: 'taskEvGet', id: t.id }).then(r => {
    if (!(r && r.ok && r.has)) return;
    p.dataset.edit = '1';
    const h = p.querySelector('.q0'); if (h) h.textContent = '📅 この予定を直す';
    const b = p.querySelector('.q5'); if (b) b.textContent = 'この内容で直す';
    p.querySelector('.q1').value = String(r.events[0].title || '').replace(/^【タスク】/, '');
    p.querySelector('.q2').value = r.events[0].date;
    p.querySelector('.q3').value = r.events.map(e => e.time).join('\n');
  }).catch(() => {});
  setTimeout(() => p.querySelector('.q3').focus(), 60);
}
async function tkAdd4() {
  const t = ($('tkT').value || '').trim();
  if (!t) { showErr('やることを入れてください'); return; }
  /* 🔴2026-08-05：アクション期限は必須（いつ動くかの無いタスクを作らない） */
  if (!$('tkD').value) { showErr('アクション期限（自分が動く日）を入れてください'); return; }
  try {
    const r = await api({ api: 'taskSave', t: { title: t, due: $('tkD').value, due2: $('tkD2') ? $('tkD2').value : '' } });
    if (r && r.ok) { showOk(r.msg || '追加しました'); $('tkT').value = ''; $('tkD').value = ''; if ($('tkD2')) $('tkD2').value = ''; tkLoad4(false); }
    else showErr((r && r.msg) || '追加できません');
  } catch (e) { showErr(e.message); }
}

/* 起動時の配線（1回だけ・PWAは再初期化ループが無いので二重化しない） */
document.addEventListener('DOMContentLoaded', () => {
  const d = $('scD'); if (d) d.value = todayYmd();
  scCalLink4();
  const on = (id, f) => { const e = $(id); if (e) e.addEventListener('click', f); };
  on('scPrev', () => scDay4(-1));
  on('scNext', () => scDay4(1));
  on('scToday', () => { const e = $('scD'); if (e) e.value = todayYmd(); scGo4(); });
  const dd = $('scD'); if (dd) dd.addEventListener('change', scGo4);
  /* 📆b67：日⇄週セグメント＋前回表示の復元 */
  on('scVd4', () => scView4('day'));
  on('scVw4', () => scView4('week'));
  try { if (localStorage.getItem('cpScV4') === 'week') scView4('week'); } catch (e) {}
  /* 🗑b120：ここに `shushin4(); nd4Load(); oq4Load();` が在った（修身レイヤーの起動）。
   *   2026-08-20 松原「機能していないから」＝カードごと撤廃したので起動点も撤去。 */
  on('tkAddBtn', tkAdd4);
  const ti = $('tkT');
  if (ti) ti.addEventListener('keydown', ev => { if (ev.key === 'Enter') tkAdd4(); });
  on('tkDoneTgl', () => { TKDone4 = !TKDone4;
    const b = $('tkDoneTgl'); if (b) b.textContent = TKDone4 ? '✔ 未完了だけ' : '✔ 完了も見る';
    tkLoad4(true); });
  /* 🧠2026-08-04：脳を占めているものだけに絞る（画面側だけで完結＝即座に切り替わる） */
  on('tkBrainTgl', () => { TKBrain4 = !TKBrain4; tkDraw4(); });
  /* 🧠「なぜ？」＝既定は開。閉じたらその状態を覚える（毎日の画面を重くしない） */
  const wy = $('tkWhy'), wb = $('tkWhyB');
  const wSet = (open) => {
    if (wy) wy.hidden = !open;
    if (wb) wb.textContent = open ? '閉じる' : 'なぜ？';
  };
  let wOpen = true;
  try { const g = localStorage.getItem('cpTkWhy'); if (g !== null) wOpen = g === '1'; } catch (e) {}
  wSet(wOpen);
  on('tkWhyB', () => { wOpen = !wOpen; wSet(wOpen);
    try { localStorage.setItem('cpTkWhy', wOpen ? '1' : '0'); } catch (e) {} });
  const th = $('tkHead');
  if (th) th.addEventListener('click', () => {
    const b = $('tkBody'), c = $('tkChev'); if (!b) return;
    const open = b.style.display === 'none';
    b.style.display = open ? '' : 'none';
    if (c) c.style.transform = open ? '' : 'rotate(-90deg)';
    try { localStorage.setItem('cp_tk_open', open ? '1' : '0'); } catch (e) {}
  });
  try { if (localStorage.getItem('cp_tk_open') === '0') { $('tkBody').style.display = 'none';
    const c = $('tkChev'); if (c) c.style.transform = 'rotate(-90deg)'; } } catch (e) {}
  tkLoad4(false);
});
