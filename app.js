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

/* ---- APIコア：body=JSON文字列 / Content-Type text/plain（プリフライト回避） ---- */
async function api(payload) {
  const k = localStorage.getItem(LS.KEY);
  if (!k) { showSetup(); throw new Error('合鍵が未設定です'); }
  let res;
  try {
    res = await fetch(gasUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ k }, payload)),
      redirect: 'follow'
    });
  } catch (e) {
    setOffline(true);
    throw new Error('通信できません（オフラインまたはURL不正）: ' + e.message);
  }
  setOffline(!navigator.onLine);
  if (!res.ok) throw new Error('サーバー応答エラー HTTP ' + res.status);
  let j;
  try { j = await res.json(); }
  catch (e) { throw new Error('応答がJSONではありません（URL/デプロイ設定を確認）'); }
  if (!j.ok) {
    if (j.error === 'auth') { showSetup('合鍵が一致しません。再入力してください。'); }
    if (j.error === 'unknown_api') {
      throw new Error('この機能はサーバー側が未開通です（GAS貼り替え＝doPost拡張の反映待ち）');
    }
    throw new Error('APIエラー: ' + (j.error || j.msg || '不明'));   // コックピットapi*は失敗時 msg で理由を返す＝黙殺しない
  }
  return j;
}

/* ---- エラー/オフライン表示 ---- */
function showErr(msg) {
  const b = $('errBox');
  if (!b) return;
  b.textContent = msg;
  b.classList.remove('hidden');
  clearTimeout(showErr._t);
  showErr._t = setTimeout(() => b.classList.add('hidden'), 8000);
}
function setOffline(off) {
  const b = $('offlineBanner');
  if (b) b.classList.toggle('hidden', !off);
}
window.addEventListener('online',  () => { setOffline(false); loadHome(); });
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
    if (btn.dataset.view === 'notif') loadNotifs();
    if (btn.dataset.view === 'home') loadHomeMonth();
    if (btn.dataset.view === 'gen' && !loadReelList._did) { loadReelList._did = true; loadReelList(); }
    if (btn.dataset.view === 'more' && !loadArchive._did) { loadArchive._did = true; loadArchive(); }
    if (btn.dataset.view === 'more' && !brBoardDone) brLoadBoard();   // 🧠作戦盤の自動読込（s9）
  });
});

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
  $('uriDetail').textContent = u.err
    ? '読取エラー: ' + u.err
    : (u.salarySet
      ? `給与差①${yen(u.diff1)}(${u.pct1 ?? '–'}%)｜差②${yen(u.diff2)}(${u.pct2 ?? '–'}%)`
      : '給与明細 未登録（「その他」タブから登録できます）');
}

function renderHome(d) {
  renderGauges(d);
  // スケジュール
  const ul = $('schedList');
  ul.innerHTML = '';
  const sched = d.sched || [];
  if (!sched.length) ul.innerHTML = '<li class="muted">今日の予定はありません</li>';
  sched.forEach(s => {
    const li = document.createElement('li');
    if (s.routine) li.classList.add('routine');
    const tag = s.tag
      ? `<span class="tag" style="background:${escAttr(s.tagColor || '#8e8e93')}">${esc(s.tag)}</span>` : '';
    li.innerHTML = `<span class="t">${esc(s.t || '')}</span><span class="title">${esc(s.title || '')}</span>${tag}`;
    ul.appendChild(li);
  });
  lastSched = sched;
  schedApply(schedOpen());   // 🆕開閉状態を再適用（閉時=ヘッダ右の「次の予定」を最新化）
  // 通知バッジ・更新時刻
  setBadge(d.notifUnread || 0);
  $('updatedAt').textContent = (d.updated ? '更新 ' + d.updated : '') + ' · s10';   // s10=シェル版数（更新の見える化）
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
    saveCache(LS.HOME, d);
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
  const lb = $('hmLabel');
  if (lb) lb.textContent = ymLabel(hmYm) + (hmYm === ymNow() ? '（当月）' : '');
  const nx = $('hmNext');
  if (nx) nx.disabled = hmYm >= ymNow();
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
    if (lb) lb.textContent = ymLabel(hmYm) + '（当月）';
    if (nx) nx.disabled = true;
    const cached = readCache(LS.HOME);
    if (cached) renderGauges(cached);
  } finally {
    if (seq === loadHomeMonth._seq) setSkeleton(false);
  }
}
if ($('hmPrev')) $('hmPrev').addEventListener('click', () => { hmYm = ymShift(hmYm, -1); loadHomeMonth(); });
if ($('hmNext')) $('hmNext').addEventListener('click', () => {
  if (hmYm >= ymNow()) return;
  hmYm = ymShift(hmYm, 1);
  loadHomeMonth();
});

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
  btn.disabled = true;
  try {
    if (btn.dataset.act === 'approve') await api({ api: 'approve', refTs: btn.dataset.ref });
    else await api({ api: 'notifRead', ts: btn.dataset.ts });
    await loadNotifs(true);
  } catch (e) { btn.disabled = false; showErr(e.message); }
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
  $('ktZhoTxt').textContent = zhoText(f);
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
    const d = await api({ api: 'zangyoReport', payload: zhoFields });
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
  return '@channel\nおはようございます！\nいつも有り難うございます🍀\n\n▼共有\n' + when + t + '出勤です🙋\n\nどうぞよろしくお願いいたします！';
}

function skPrev() {
  const box = $('skBox');
  if (!box) return;
  const dt = $('skDate').value, tm = skNorm($('skTime').value);
  if (!dt || !tm) { box.classList.add('hidden'); return; }
  $('skTxt').textContent = skTpl(dt, tm);
  const b = $('btnSkSend');
  if (b) { b.disabled = false; b.textContent = '✅ Slackへ出勤時間報告（@channel）'; }
  const r = $('skRes');
  if (r) { r.className = 'result'; r.textContent = ''; }
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
    const d = await api({ api: 'shukkinReport', date: dt, time: tm });
    res.className = 'result ok';
    res.textContent = '✅ ' + (d.msg || 'Slackへ送信しました');
    btn.textContent = '送信済み';
  } catch (e) {
    res.className = 'result ng';
    res.textContent = e.message;
    btn.disabled = false;   // 失敗時のみ再試行可
  }
});

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

if ($('btnPlPull')) $('btnPlPull').addEventListener('click', async () => {   // 📝s10 Plaud共有URL取込
  const u = $('plUrl').value.trim(), res = $('plRes');
  if (!u) { res.className = 'result ng'; res.textContent = 'Plaudの共有URL（web.plaud.ai/s/pub_…）を貼ってください'; return; }
  res.className = 'result';
  res.textContent = '⬇ 取込中…（要約＋全文文字起こしを取得→Notion議事録DBへ）';
  $('btnPlPull').disabled = true;
  try {
    const r = await api({ api: 'plaudPull', url: u });
    res.className = 'result ok';
    res.textContent = r.msg + '\n日付: ' + (r.date || '') + ' / 文字起こし ' + (r.segs || 0) + 'セグメント\n' + (r.note || '');
    $('plUrl').value = '';
  } catch (e) {
    res.className = 'result ng';
    res.textContent = e.message;
  } finally {
    $('btnPlPull').disabled = false;
  }
});

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

/* ==== 🆕アーカイブ（月セレクタ＋紹介/売上カード＝既存{api:'archive', ym}） ==== */
let arYm = ymNow();

async function loadArchive() {
  const lb = $('arLabel'), body = $('arBody');
  if (!lb || !body) return;
  lb.textContent = ymLabel(arYm) + (arYm === ymNow() ? '（当月）' : '');
  if ($('arNext')) $('arNext').disabled = arYm >= ymNow();
  body.innerHTML = '<div class="muted pad">読み込み中…</div>';
  try {
    const d = await api({ api: 'archive', ym: arYm });
    const r = d.refer || {}, u = d.uri || {};
    body.innerHTML =
      '<div class="cards">' +
      '<div class="card"><div class="card-label">紹介実績</div>' +
      '<div class="card-num">' + esc(r.pjt != null ? r.pjt : '–') + '<span class="card-goal">PJT</span></div>' +
      '<div class="card-detail">' + (r.err ? '読取エラー: ' + esc(r.err)
        : '総数' + esc(r.total ?? '–') + '｜自然' + esc(r.shizen ?? '–') + '・スタッフ' + esc(r.staff ?? '–') + '・巻き込み' + esc(r.maki ?? '–') + '%') + '</div></div>' +
      '<div class="card"><div class="card-label">売上報酬</div>' +
      '<div class="card-num" style="font-size:22px">' + esc(yen(u.gokei)) + '</div>' +
      '<div class="card-detail">' + (u.err ? '読取エラー: ' + esc(u.err)
        : '初診' + esc(yen(u.shoshin)) + '｜再診' + esc(yen(u.saishin)) +
          (u.salarySet ? '<br>給与差①' + esc(yen(u.diff1)) + '(' + esc(u.pct1 ?? '–') + '%)｜差②' + esc(yen(u.diff2)) + '(' + esc(u.pct2 ?? '–') + '%)' : '')) + '</div></div>' +
      '</div>';
  } catch (e) {
    body.innerHTML = '<div class="muted pad">取得失敗</div>';
    showErr(e.message);
  }
}
if ($('arPrev')) $('arPrev').addEventListener('click', () => { arYm = ymShift(arYm, -1); loadArchive(); });
if ($('arNext')) $('arNext').addEventListener('click', () => {
  if (arYm >= ymNow()) return;
  arYm = ymShift(arYm, 1);
  loadArchive();
});

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
  btn.disabled = true;
  try {
    await api({ api: 'intelStatus', ts: btn.dataset.ts, status: btn.dataset.int });
    const hit = intelItems.find(x => String(x.ts) === String(btn.dataset.ts));
    if (hit) hit.st = btn.dataset.int;
    renderIntel();
  } catch (e) { btn.disabled = false; showErr(e.message); }
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

/* ==== 🆕給与明細PDF（選択→base64→{api:'salaryPdf'}。額は画面に出さない） ==== */
let salB64 = null, salName = null;

if ($('salFile')) $('salFile').addEventListener('change', ev => {
  const f = ev.target.files[0];
  if (!f) return;
  if (f.size > 8 * 1024 * 1024) {
    $('salFileLabel').textContent = '📄 給与明細PDFを選択';
    showErr('PDFが大きすぎます（8MB以下に）');
    return;
  }
  const rd = new FileReader();
  rd.onload = () => {
    salB64 = String(rd.result || '');
    salName = f.name;
    $('salFileLabel').textContent = f.name + '（' + Math.max(1, Math.round(f.size / 1024)) + 'KB）';
    $('btnSalSend').disabled = false;
  };
  rd.onerror = () => showErr('PDFを読み込めませんでした');
  rd.readAsDataURL(f);
});

if ($('btnSalSend')) $('btnSalSend').addEventListener('click', async () => {
  if (!salB64) return;
  const out = $('salResult');
  out.className = 'result';
  out.textContent = '読み取り中…（AIが対象月と金額を抽出します）';
  $('btnSalSend').disabled = true;
  try {
    const d = await api({ api: 'salaryPdf', b64: salB64, name: salName });
    out.className = 'result ok';
    out.textContent = '✅ ' + (d.msg || '登録しました') +
      (d.months && d.months.length ? '｜登録済み月：' + d.months.join(', ') : '');
    salB64 = null;
    $('salFile').value = '';
    $('salFileLabel').textContent = '📄 給与明細PDFを選択';
  } catch (e) {
    out.className = 'result ng';
    out.textContent = e.message;
    $('btnSalSend').disabled = false;
  }
});

/* ==== 🆕動画生成（reel*）：URL受付→解析→候補→パッケージ→🎬発注/🏭工場解析＋履歴 ==== */
let reelTs = null;
const REEL_ST = {
  uploaded: '素材受付', analyzed: '解析済', done: 'パッケージ済',
  rendering: '🎬工場処理中', f_analyzing: '🏭工場解析中'
};
const reelBusyMsg = '進行中…（1〜4分かかることがあります。応答が無ければ数分後に「履歴」の更新から確認してください）';

function reelRes(msg, ng) {
  const out = $('reelWorkRes');
  if (!out) return;
  out.className = 'result' + (ng ? ' ng' : msg && msg.indexOf('✅') === 0 ? ' ok' : '');
  out.textContent = msg || '';
}

function renderReelWork(d) {
  if ($('reelWork')) $('reelWork').classList.remove('hidden');
  if ($('reelWorkName')) $('reelWorkName').textContent =
    (d.name ? d.name + '｜' : '') + (REEL_ST[d.status] || d.status || '');
  // 完成動画リンク（工場書戻しoutUrl）
  const hasOut = !!(d.outUrl);
  if ($('reelOut')) $('reelOut').classList.toggle('hidden', !hasOut);
  if (hasOut && $('reelOutLink')) $('reelOutLink').href = d.outUrl;
  renderReelAnalysis(d.analysis || null);
  renderReelPkgs(d.pkgs || null, d.secs || null);
}

function renderReelAnalysis(an) {
  const box = $('reelAnBox'), cands = $('reelCands');
  if (!box || !cands) return;
  cands.innerHTML = '';
  if (!an) { box.classList.add('hidden'); return; }
  $('reelAnSummary').innerHTML =
    esc(an.summary || '') +
    (an.layout ? '<br><span class="muted">レイアウト: ' + esc(an.layout) + '</span>' : '') +
    (an.notes ? '<br><span class="muted">' + esc(an.notes) + '</span>' : '');
  box.classList.remove('hidden');
  const cs = an.candidates || [];
  cs.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'cand';
    div.innerHTML =
      '<div class="notif-title">候補' + (i + 1) + '｜' + esc(c.start || '?') + '〜' + esc(c.end || '?') + '｜' + esc(c.theme || '') + '</div>' +
      '<div class="notif-body">' + esc(c.why || '') + (c.hookSeed ? '<br>黄パンチ種: ' + esc(c.hookSeed) : '') + '</div>' +
      '<div class="notif-actions">' +
      '<button class="btn btn-small" data-reel="pkg" data-ci="' + i + '">② パッケージ</button>' +
      '<button class="btn btn-small btn-approve" data-reel="render" data-ci="' + i + '">🎬 発注</button>' +
      '</div>';
    cands.appendChild(div);
  });
  if (!cs.length) cands.innerHTML = '<div class="muted pad">切り抜き候補なし（3分以下の素材は「② 全体パッケージ」へ）</div>';
}

function renderReelPkgs(pkgs, secs) {
  const box = $('reelPkgBox'), body = $('reelPkgSecs');
  if (!box || !body) return;
  const show = (secs && secs.length) || (pkgs && pkgs.length);
  box.classList.toggle('hidden', !show);
  if (!show) return;
  body.innerHTML = '';
  if (pkgs && pkgs.length) {
    const info = document.createElement('div');
    info.className = 'muted';
    info.style.fontSize = '12px';
    info.textContent = '生成済み: ' + pkgs.map(p =>
      (Number(p.ci) >= 0 ? '候補' + (Number(p.ci) + 1) : '全体') + '（' + (p.d || '') + '）').join('｜');
    body.appendChild(info);
  }
  (secs || (pkgs && pkgs[0] && pkgs[0].secs) || []).forEach(s => {
    const div = document.createElement('div');
    div.className = 'pkg-sec';
    div.innerHTML = '<div class="notif-title">' + esc(s.title || '') + '</div>' +
      '<pre class="draft-pre">' + esc(s.body || '') + '</pre>';
    body.appendChild(div);
  });
}

if ($('btnReelUrl')) $('btnReelUrl').addEventListener('click', async () => {
  const out = $('reelUrlRes');
  const url = $('reelUrl') ? $('reelUrl').value.trim() : '';
  if (!url) { out.className = 'result ng'; out.textContent = 'YouTube URLを入れてください'; return; }
  out.className = 'result';
  out.textContent = '受付中…';
  $('btnReelUrl').disabled = true;
  try {
    const d = await api({ api: 'reelFromUrl', url });
    reelTs = d.ts || null;
    out.className = 'result ok';
    out.textContent = '✅ ' + (d.msg || '受け付けました') + '。次は「① 解析」';
    $('reelUrl').value = '';
    renderReelWork({ name: d.name || 'YT素材', status: 'uploaded' });
    reelRes('');
    loadReelList();
  } catch (e) {
    out.className = 'result ng';
    out.textContent = e.message;
  } finally {
    $('btnReelUrl').disabled = false;
  }
});

async function reelStep(payload, btn, after) {
  if (!reelTs) { reelRes('先に🔗URL受付、または履歴から案件を選んでください', true); return; }
  if (btn) btn.disabled = true;
  reelRes(reelBusyMsg);
  try {
    const d = await api(Object.assign({ ts: reelTs }, payload));
    after(d);
  } catch (e) { reelRes(e.message, true); }
  finally { if (btn) btn.disabled = false; }
}

if ($('btnReelAnalyze')) $('btnReelAnalyze').addEventListener('click', () =>
  reelStep({ api: 'reelAnalyze' }, $('btnReelAnalyze'), d => {
    reelRes(d.retry ? (d.msg || '処理中。もう一度お試しを') : '✅ 解析完了。候補から②パッケージへ');
    if (d.analysis) renderReelAnalysis(d.analysis);
  }));

async function reelPkg(ci, btn) {
  await reelStep({ api: 'reelPackage', candIdx: ci }, btn, d => {
    reelRes('✅ パッケージ生成完了');
    renderReelPkgs(d.pkgs || null, d.secs || null);
  });
}
if ($('btnReelPkgAll')) $('btnReelPkgAll').addEventListener('click', () => reelPkg(-1, $('btnReelPkgAll')));

if ($('btnReelFactory')) $('btnReelFactory').addEventListener('click', () =>
  reelStep({ api: 'reelFactoryAnalyze' }, $('btnReelFactory'), d => {
    reelRes('✅ ' + (d.msg || '工場が解析中（目安10-20分）。完了は🔔へ。結果は履歴の更新から'));
  }));

if ($('reelCands')) $('reelCands').addEventListener('click', ev => {
  const btn = ev.target.closest('button[data-reel]');
  if (!btn) return;
  const ci = parseInt(btn.dataset.ci, 10);
  if (btn.dataset.reel === 'pkg') reelPkg(ci, btn);
  else reelStep({ api: 'reelRender', candIdx: ci }, btn, d => {
    reelRes('✅ ' + (d.msg || '🏭工場起動。完成は🔔とメールへ（目安15分）'));
    loadReelList();
  });
});

async function loadReelList() {
  const box = $('reelList');
  if (!box) return;
  box.innerHTML = '<div class="muted pad">読み込み中…</div>';
  try {
    const d = await api({ api: 'reelList' });
    const items = d.items || [];
    if (!items.length) { box.innerHTML = '<div class="muted pad">履歴はまだありません</div>'; return; }
    box.innerHTML = '';
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'notif reel-item';
      div.dataset.ts = it.ts || '';
      div.innerHTML =
        '<div class="notif-head"><span>' + esc(it.date || '') + '</span>' +
        '<span class="pill">' + esc(REEL_ST[it.status] || it.status || '') + '</span></div>' +
        '<div class="notif-title">' + esc(it.name || '') + '</div>';
      box.appendChild(div);
    });
  } catch (e) {
    box.innerHTML = '<div class="muted pad">取得失敗</div>';
    showErr(e.message);
  }
}
if ($('btnReelReload')) $('btnReelReload').addEventListener('click', loadReelList);

if ($('reelList')) $('reelList').addEventListener('click', async ev => {
  const item = ev.target.closest('.reel-item');
  if (!item || !item.dataset.ts) return;
  reelTs = item.dataset.ts;
  renderReelWork({ name: '', status: '' });
  reelRes('読み込み中…');
  try {
    const d = await api({ api: 'reelGet', ts: reelTs });
    renderReelWork(d);
    reelRes(d.analysisRaw ? '解析結果の一部を表示できませんでした（形式不明）' : '');
    if ($('reelWork') && $('reelWork').scrollIntoView) $('reelWork').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { reelRes(e.message, true); }
});

/* ==== 初回セットアップ（合鍵） ==== */
function showSetup(msg) {
  $('setup').classList.remove('hidden');
  $('setupUrl').value = localStorage.getItem(LS.URL) || '';
  if (msg) { $('setupErr').className = 'result ng'; $('setupErr').textContent = msg; }
}
$('setupSave').addEventListener('click', () => {
  const k = $('setupKey').value.trim();
  if (!k) { $('setupErr').className = 'result ng'; $('setupErr').textContent = '合鍵を入力してください'; return; }
  localStorage.setItem(LS.KEY, k);
  const u = $('setupUrl').value.trim();
  if (u) localStorage.setItem(LS.URL, u); else localStorage.removeItem(LS.URL);
  setBrowserLinks();
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
function setBrowserLinks() {
  if ($('browserLink')) $('browserLink').href = gasUrl();
  if ($('browserLink2')) $('browserLink2').href = gasUrl();
}

/* ==== 起動 ==== */
setBrowserLinks();
if ('serviceWorker' in navigator) {
  // 起動毎に更新チェック＋新版が制御を取ったら1回だけ自動リロード＝「開き直し2回」問題の根絶
  navigator.serviceWorker.register('sw.js').then(reg => { try { reg.update(); } catch (e) {} }).catch(() => {});
  let _swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swReloaded) return; _swReloaded = true; location.reload();
  });
}
setOffline(!navigator.onLine);
schedApply(schedOpen());   // 🆕起動時にスケジュール開閉状態を復元（既定=開）
if ($('hmLabel')) $('hmLabel').textContent = ymLabel(hmYm) + '（当月）';
if ($('hmNext')) $('hmNext').disabled = true;   // 起動時=当月（未来月へは進めない）
if (!localStorage.getItem(LS.KEY)) showSetup();
else loadHome();
