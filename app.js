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
  ['view-shokai', 'view-gijiroku', 'view-slotf', 'view-cal'].forEach(id => { const s = document.getElementById(id); if (s) frag.appendChild(s); });
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
  $('updatedAt').textContent = (d.updated ? '更新 ' + d.updated : '') + ' · s19';   // s19=シェル版数（更新の見える化）
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
      abd.textContent = x.advice || '';
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
  const free = $('calTx') ? $('calTx').closest('.card') : null;
  const freeBits = ['calTx', 'btnCalParse'];
  freeBits.forEach(id => { const e = $(id); if (e) e.classList.toggle('hidden', m !== 'free'); });
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
