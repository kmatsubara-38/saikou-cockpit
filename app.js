/* ===== 個人コックピット PWA app.js（依存ゼロ） ===== */
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
    throw new Error('APIエラー: ' + (j.error || j.msg || '不明'));   // コックピットapi*は失敗時 msg で理由を返す＝黙殺しない
  }
  return j;
}

/* ---- エラー/オフライン表示 ---- */
function showErr(msg) {
  const b = $('errBox');
  b.textContent = msg;
  b.classList.remove('hidden');
  clearTimeout(showErr._t);
  showErr._t = setTimeout(() => b.classList.add('hidden'), 8000);
}
function setOffline(off) {
  $('offlineBanner').classList.toggle('hidden', !off);
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

/* ---- タブ切替 ---- */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    $('view-' + btn.dataset.view).classList.remove('hidden');
    if (btn.dataset.view === 'notif') loadNotifs();
    if (btn.dataset.view === 'home') loadHome();
  });
});

/* ==== ホーム計器 ==== */
const yen = n => (n == null ? '–' : '¥' + Number(n).toLocaleString('ja-JP'));

function renderHome(d) {
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
  $('mtgGoal').textContent = m.goal != null ? m.goal : '–';
  $('mtgBar').style.width = Math.min(100, (m.n || 0) / (m.goal || 1) * 100) + '%';
  $('mtgDetail').textContent = m.err ? '読取エラー: ' + m.err : `実施済 ${m.done ?? '–'}`;
  // 売上報酬
  const u = d.uri || {};
  $('uriShoshin').textContent = yen(u.shoshin);
  $('uriSaishin').textContent = yen(u.saishin);
  $('uriGokei').textContent  = yen(u.gokei);
  $('uriDetail').textContent = u.err
    ? '読取エラー: ' + u.err
    : (u.salarySet
      ? `給与差①${yen(u.diff1)}(${u.pct1 ?? '–'}%)｜差②${yen(u.diff2)}(${u.pct2 ?? '–'}%)`
      : '給与明細 未登録（登録はブラウザ版コックピットから）');
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
  // 通知バッジ・更新時刻
  setBadge(d.notifUnread || 0);
  $('updatedAt').textContent = d.updated ? '更新 ' + d.updated : '';
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
  }
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
  $('browserLink').href = gasUrl();
  $('setup').classList.add('hidden');
  loadHome();
});

/* ==== util ==== */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escAttr(s) { return esc(s); }

/* ==== 起動 ==== */
$('browserLink').href = gasUrl();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
setOffline(!navigator.onLine);
if (!localStorage.getItem(LS.KEY)) showSetup();
else loadHome();
