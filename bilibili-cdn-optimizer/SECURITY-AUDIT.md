# 安全審查報告：B站CDN優選 v3.3.1

| 項目 | 內容 |
|---|---|
| 審查日期 | 2026-10-18 |
| 審查對象 | `bilibili-cdn-optimizer.user.js` v3.3.1（SanJerry007，上游 commit `58ac0cd` 時的版本，本 repo 未修改），以及本 fork 新增的 `chrome-extension/` |
| 審查方式 | 完整閱讀 764 行原始碼的靜態分析；搜尋高風險 API 與隱藏的 Unicode 控制字元；檢查 git 歷史、CI 和 git hooks；執行上游的 `tools/selftest.js`（80 項通過）。擴充功能另外在 Chromium 以模擬的 B站頁面實際載入測試 |
| 審查者 | Claude（Anthropic 的 AI 助理），應 repo 擁有者要求進行。這不是專業資安公司的稽核 |

文中的行號都是指 `bilibili-cdn-optimizer.user.js`。

## 結論

程式碼是明碼、可讀，沒有混淆，沒有發現惡意行為。它只做說明裡寫的事：在 B站回傳的 CDN 鏡像之間挑一個最快的。

主要風險不在目前的程式碼，而在 **Tampermonkey 版的自動更新**：之後推送的新版沒有人審查過。本 fork 的 Chrome 擴充功能版不會自動更新，也縮小了執行範圍，可以避開這個風險。

## 確認沒有問題的部分

- **沒有額外權限**：`@grant none`（第 15 行），沒有 `GM_xmlhttpRequest`、`@require`、`@connect`。腳本做不到網頁本身做不到的事，也不能跨網域繞過 CORS。
- **不會把資料送到第三方**：唯一的對外請求是測速用的 `fetch`（第 182 行），目標是 B站 `playurl` 回應裡本來就有的 CDN 網址。沒有遙測，沒有回報伺服器。這些 CDN 跟 B站不同源，測速請求不會帶上登入 Cookie。
- **不會被塞入別的網址**：`pickBest`（第 312-327 行）只從這次回應的候選網址裡挑。即使 localStorage 被竄改，也只能影響「選哪一個」，加不進新網址。讀取快取時也有型別檢查（第 105-117 行）。
- **沒有 XSS 途徑**：右下角提示用 `textContent`（第 748 行）。全檔沒有 `eval`、`new Function`、`innerHTML`、`document.write`，也沒有隱藏的 Unicode 控制字元。
- **改寫範圍很窄**：`fetch` 和 XHR 的攔截只處理路徑是 `/playurl` 的請求（第 625-629 行），其他請求原樣放行。
- **只存一筆本機資料**：localStorage 裡的 `bcdn:winner:v3`，內容是 `{host, kbps, ts}`。不寫檔、不上傳。

## 要注意的地方（由重到輕）

1. **Tampermonkey 版會自動從上游更新。** `@updateURL` 和 `@downloadURL`（第 10-11 行）指向上游 SanJerry007 repo 的 `main` 分支。上游只要提高 `@version` 推送一次，Tampermonkey 就會自動換上新程式碼，沒有任何雜湊校驗。等於信任上游作者，以及他帳號的安全。
2. **執行範圍太廣，而且在網頁環境執行。** `@match *://*.bilibili.com/*`（第 13 行）包含 `passport`（登入）、`pay`（付款）、`account`、`member` 等子網域，腳本在這些頁面其實什麼都不做。`@grant none` 代表程式碼跑在網頁本身的 JS 環境裡。目前的程式碼沒問題，但如果將來某次更新是惡意的，就能以你登入的身分呼叫 B站 API。這一點會放大第 1 點的風險。
3. **流量消耗。** `auto` 模式每 10 分鐘最多下載約 12MB 測速資料，播放卡頓時還會額外複測。不算安全問題，但用行動網路或計量網路時要注意。
4. **帳號風險：低，但無法保證。** 程式只在 B站給的合法鏡像之間調整順序，沒有偽造請求。但測速時會對多個鏡像發出中途中斷的下載，B站看得到這種流量模式。沒有證據顯示會因此被處罰，只是程式碼本身無法保證。
5. **只影響參與開發的人。** `.githooks/` 不會自動啟用，啟用後會執行本機另外設定路徑的外部檢查工具。CI 沒有使用任何 secrets，GitHub Actions 以主版本標籤釘選（`@v4`），沒有釘到 commit SHA。只是安裝使用的話，這些都不會執行。

## Chrome 擴充功能版（本 fork 新增）

`chrome-extension/` 是同一份腳本的逐位元組複本，搭配一份手寫的 `manifest.json`：

- **執行環境跟 Tampermonkey 相同**：`"world": "MAIN"`、`"run_at": "document_start"`、`"all_frames": true`。
- **沒有額外權限**：manifest 只有 `content_scripts`，沒有 `permissions` 或 `host_permissions`。
- **不會自動更新**：執行的永遠是硬碟上那份。上面第 1 點的風險不存在。
- **縮小範圍**：只套用 `https://`，並以 `exclude_matches` 排除 `passport`、`account`、`pay`、`member` 四個子網域，緩解上面第 2 點。
- **防止走樣**：`tools/build-extension.js --check`（CI 每次都跑）會檢查複本與原腳本一致、版本號一致、zip 最新，以及 `world` 和 `run_at` 沒被改掉。這兩個設定一旦改錯，所有攔截會無聲失效。
- **實測**：在 Chromium 載入，以路由模擬 B站頁面。內嵌 `__playinfo__`、`fetch`、XHR 三條路都會改選鏡像，內嵌播放器 iframe 也有生效，`passport.bilibili.com` 上沒有注入。對照組（不載入擴充功能、或改成預設的 ISOLATED world）三條路都維持原網址。

## 建議

- 優先使用 Chrome 擴充功能版。如果要用 Tampermonkey，請關掉這個腳本的自動更新，每次更新前先看過差異。
- 使用計量網路時，把 `CFG.MODE` 改成 `'prefer'`，不做測速。

## 限制

- 這是靜態閱讀，沒有在真實 B站上逐項驗證行為。擴充功能的實測使用模擬頁面，因為審查環境連不到 B站。
- 只涵蓋上面列出的版本。腳本更新後需要重新審查。
