# 個人コックピット PWA殻（pwa_shell）

静的PWA（依存ゼロ・ビルド不要）。GAS WebApp「個人コックピット」の doPost(e) JSON API を叩くスマホ用シェル。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 全画面（ホーム/通知/勤怠/レシート＋初回セットアップ） |
| `app.js` | API呼び出し・描画・localStorageキャッシュ・画像縮小 |
| `style.css` | コックピット共通デザイン言語（#f5f5f7/カード28px/SF系/ダーク対応） |
| `manifest.webmanifest` | インストール可能PWA定義 |
| `sw.js` | Service Worker（シェルcache-first＋stale-while-revalidate） |
| `icon-192.png` / `icon-512.png` | モノグラム「創」アイコン（512はmaskable兼用） |

## セットアップ

1. このフォルダをHTTPSで静的配信（GitHub Pages / Cloudflare Pages 等。**SWはHTTPS必須**、localhostは可）。
2. スマホでURLを開く → 初回に**合鍵**を入力（GAS側 Script Property `CP_KEY` と同じ値）。合鍵は端末のlocalStorageのみに保存され、**リポジトリには一切含まれない**。
3. 「ホーム画面に追加」でインストール。

接続先GAS URLの既定値は `app.js` の `CONFIG.GAS_URL`。初回セットアップ画面の「接続先URLを変更する」からも端末単位で上書き可能（localStorage `cp_url`）。

## API契約（コックピット doPost(e)・3班共通）

- リクエスト = `fetch(URL, {method:'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({k, api, ...})})`
  → **text/plain なので CORS プリフライトが発生しない**。
- `k` が Script Property `CP_KEY` と不一致 → `{ok:false,error:'auth'}` → 合鍵再入力画面。
- 使用API: `home` / `notifs` / `notifRead` / `notifReadAll` / `approve` / `kintai` / `receipt`（`archive` は契約済・v1画面では未使用）。

## 動作仕様

- **オフライン**: シェルはSWキャッシュで即起動。home/notifs の最終取得データを localStorage（`cp_cache_home` / `cp_cache_notifs`）に保存し、まずキャッシュを即描画→裏で最新取得。通信不能時はオレンジのオフラインバナー表示。
- **エラー表示**: fetch失敗/HTTPエラー/非JSON応答/APIエラーを理由付きで画面上部に表示（8秒で自動消滅）。
- **レシート**: カメラ/画像選択 → canvasで長辺1600px・JPEG品質0.8に縮小 → base64で `{api:'receipt', b64, name, target:'keihi'|'card'}` 送信。
- **勤怠**: 出勤/退勤ボタン＋残業記述テキスト＋「残業なし」チェック → `{api:'kintai', kind, text, none}`。
- **通知**: 一覧/個別既読/すべて既読/承認（`needAction` のみ承認ボタン表示）。未読数はタブバッジ。
- **フル機能はブラウザ版へ**: ホーム最下部リンク（GAS WebApp本体を開く）。

## 更新時の注意

- シェル資産（HTML/CSS/JS/アイコン）を変更したら `sw.js` の `CACHE = 'cp-shell-v1'` の版数を上げる（旧キャッシュはactivate時に自動削除）。
- アイコン再生成: System.Drawing を使うPowerShellスクリプトで生成（グラデ背景＋アクセントリング＋「創」）。日本語文字は文字コード指定（`[char]0x5275`）でBOM問題を回避。

## サイズ

合計 約51KB（アイコン2枚含む）。外部依存・外部フォント・CDN読み込みなし。
