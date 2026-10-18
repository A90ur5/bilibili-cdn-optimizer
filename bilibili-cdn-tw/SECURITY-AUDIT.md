# 安全審查報告：Bilibili CDN 台灣優化 v1.3.4

| 項目 | 內容 |
|---|---|
| 審查日期 | 2026-10-18 |
| 審查對象 | `bilibili-cdn-tw.user.js` v1.3.4（jiyunshi，[Greasy Fork 腳本 579776](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)），以 repo 擁有者在 commit `a904d67` 複製進 repo 的內容為準；以及本 fork 新增的 `chrome-extension-tw/` 打包 |
| 審查方式 | 5,556 行原始碼分三段，由 AI 子代理逐行閱讀，關鍵段落再由審查者對照原始碼確認；搜尋高風險 API、所有出現過的網域和隱藏的 Unicode 控制字元；與「B站CDN優選」比對程式碼重疊。原始腳本沒有執行過；擴充功能版在 Chromium 以模擬的 B站頁面實際載入測試 |
| 審查者 | Claude（Anthropic 的 AI 助理），應 repo 擁有者要求進行。這不是專業資安公司的稽核 |

文中的行號都是指 `bilibili-cdn-tw.user.js`。

## 結論

沒有發現惡意行為，也沒有把資料送到 B站以外的地方。它是獨立寫成的程式，不是從「B站CDN優選」改出來的：5,556 行裡只有 `@run-at` 那一行相同。

它對網頁做的修改比「B站CDN優選」多很多，暴露給網頁呼叫的介面也多，但這些介面都沒辦法把影片導到 B站以外的主機。主要風險跟所有油猴腳本一樣，是 **Tampermonkey 版的自動更新**；本 fork 的擴充功能版不會自動更新。

## 權限與範圍

- **只在播放頁執行**：`@match` 只有 `https://www.bilibili.com` 底下的影片、番劇、清單等播放頁（第 10-26 行），不會在登入、付款等頁面執行。
- **權限**：`GM_getValue`、`GM_setValue`、`GM_deleteValue`、`GM_registerMenuCommand`、`GM_info`、`unsafeWindow`。沒有 `GM_xmlhttpRequest`、`@connect`、`@require`，所以不能繞過 CORS 去連其他網站。
- **出現過的網域**：只有 `bilibili.com`、`bilivideo.com` / `.cn`、`akamaized.net`、`hdslb.com`、`szbdyd.com`。

## 確認沒有問題的部分

- **連線對象只有 B站的伺服器。**
  - 延遲探測：對內建清單上的主機以 `no-cors` 請求 `/crossdomain.xml`，不帶 Cookie，也不帶 Referer（第 3177、3273 行）。
  - 測速：拿一個真實影片分段的網址，把主機換成清單上的鏡像，發出 Range 請求，不帶 Cookie（第 3396 行）。
  - preconnect / dns-prefetch：只加 `<link>` 標籤，不傳送資料。
  - 沒有遙測、沒有回報伺服器，沒有 `sendBeacon`、`WebSocket`。
- **改寫目標守得很嚴。**
  - 替換用的主機只能來自內建清單（第 139-157 行，全部是 `upos-*.bilivideo.com`）。
  - 使用者自訂的主機必須符合 `^[a-z0-9-]+\.bilivideo\.(com|cn)$`（第 174 行）。載入時（第 1057 行）和 `setCdn` 寫入時（第 4854 行）都會檢查。
  - 作者在第 164-171 行的註解明確考慮過「網頁上的惡意腳本呼叫 `setCdn`，把影片導到攻擊者的伺服器」這種情況，並擋掉了。
- **動態產生的 Worker 程式碼不會被注入**：插入的每個值都經過 `JSON.stringify`（第 2811-2815、3010、3016 行）。
- **`innerHTML` 沒有注入途徑**：`fromHTML`（第 3105-3108 行）只用於固定的標記；狀態面板（第 5434 行）寫入的只有固定文字、數字和主機名稱的第一段，主機名稱裡不可能有 `<`。
- **診斷報告不會自動送出**：內容有版本、頁面類型、User-Agent、設定值和節點狀態，不含影片 ID 或 Cookie（第 4560 行起）。只有按「複製診斷」（第 5444-5451 行）或呼叫 `BiliCDN.report()` 才會複製到剪貼簿或印到 Console，不會上傳。
- **沒有混淆**：沒有 `eval`、`new Function`、編碼字串或隱藏字元，註解跟程式碼的行為相符。

## 要注意的地方

1. **Tampermonkey 版會自動從 Greasy Fork 更新。** 等於信任作者每次推送的新版，而 5,556 行的腳本每次更新都很難重新審查。
2. **`unsafeWindow.BiliCDN`（第 4609-4921 行）可以被網頁上的任何腳本呼叫。**
   - 最壞情況是干擾播放：排除所有鏡像、把 CDN 固定在一個壞掉的 `bilivideo` 主機上並存下來、或用 `bakeoff()` 反覆觸發測速。
   - 沒辦法把影片導到 B站以外的主機，因為上面的網域檢查依然有效。
   - Worker 收到的 `__biliCdnSetTarget` 訊息沒有驗證（第 2830 行），統計用的 MessagePort 也直接信任回報的主機和位元組數（第 3027 行起）。這些都只有已經在網頁裡執行的程式碼才送得進去。
   - 這些前提都是 B站頁面上已經有惡意程式在執行，而那種程式本來就能做更糟的事，所以屬於低風險。
3. **包裝了 `console.warn` / `console.error`**（第 3703-3712 行），用來偵測影片分段下載失敗。網頁程式印一則假的錯誤，就能讓腳本避開某個節點或多做幾次探測。
4. **會改變網頁行為的預設設定**，屬於功能取捨，不是漏洞：
   - **停用 WebRTC**（第 4988-4995 行）：關掉 B站的 P2P / PCDN 傳輸，同時讓這些頁面上任何用到 WebRTC 的功能失效。可以把開頭的 `BlockWebRTC` 改成 `false`。
   - **偽裝分頁永遠可見**，並攔截 `visibilitychange` 事件（第 5033-5069 行）：讓影片在背景繼續播放，副作用是 B站一直以為你在看這個分頁。
   - 擋掉 `httpdns.bilivideo.com` 的請求，回傳假的回應（第 2343 行起）；包裝 `history.pushState` / `replaceState`（第 5301 行起）；把 `video.preload` 設成 `auto`（第 5190 行）。
5. **縱深防禦上的小缺口**：狀態面板顯示的 HTTPDNS 分數（第 5511-5512 行）是從儲存空間讀出來（第 1411 行）、沒有驗證就寫進 `innerHTML`。在 Tampermonkey 版中，網頁腳本寫不到這個儲存空間；擴充功能版的情況見下一節。

## Chrome 擴充功能版（本 fork 新增）

`chrome-extension-tw/bilibili-cdn-tw.js` 由 `tools/build-extension-tw.js` 產生，原始腳本一字不改地放在中間，前後加上：

- **一層函式包裝**：原始腳本有大約 270 個寫在最外層的宣告。實測如果不包，B站頁面上任何在最外層宣告 `let log` 的程式都會報 `Identifier 'log' has already been declared` 而無法執行，腳本內部的變數也會外洩成網頁的全域變數。包裝後兩者都不會發生。
- **GM 相容層**：`GM_getValue` / `GM_setValue` / `GM_deleteValue` 改用網頁的 localStorage（鍵名以 `BiliCDN_TW:` 開頭）。這代表 **B站頁面上的腳本也讀寫得到這些設定**，上面第 5 點的缺口因此變成網頁碰得到。但網頁腳本本來就能控制整個頁面，所以這不算新增的風險；固定 CDN 的網域檢查在載入時照樣執行。
- **沒有選單**：不提供 `GM_registerMenuCommand`，腳本會自己略過選單。
- **沒有額外權限**：manifest 只有 `content_scripts`，`matches` 由腳本的 `@match` 產生。
- **不會自動更新**，上面第 1 點的風險不存在。
- **建置時把關**：新版如果用到相容層沒處理的 `@grant`，或用到 `@require`、`@connect` 等，建置會直接失敗，不會做出執行時才壞掉的擴充功能。`--check`（CI 每次都跑）確認擴充功能和 zip 跟原始腳本一致。
- **實測**：在 Chromium 以模擬的 B站頁面測試。
  - 內嵌 `__playinfo__`、`fetch`、XHR 三條路都會把台灣已知不可用的節點換掉。
  - `BiliCDN.setCdn()` 固定的 CDN 存進 localStorage，重新整理後仍然生效；非 B站網域被拒絕。
  - WebRTC 已停用，沒有變數外洩，也沒有 page error。
  - 對照組：不包函式的版本會讓網頁腳本報錯；不載入擴充功能時網址維持原樣。
- **錯誤頁的雜訊**：因為第 3 點的 console 包裝，Chrome 擴充功能頁的「錯誤」清單會出現 B站自己的錯誤訊息（例如 `[Mirror]: ... Script error.`），堆疊最上面是 `bilibili-cdn-tw.js` 的 `(wrapped)`。這不是擴充功能本身的錯誤。

## 建議

- 優先使用 Chrome 擴充功能版。如果要用 Tampermonkey，請關掉這個腳本的自動更新。
- 更新到新版時，先比對差異，再重新執行建置。建置會擋下新增的權限。
- 如果 B站頁面上有功能需要 WebRTC，把 `BlockWebRTC` 改成 `false`。

## 限制

- 審查環境連不到 Greasy Fork，無法確認 commit `a904d67` 的內容跟網站上目前的版本一致。
- 原始腳本只做了靜態閱讀，沒有在真實 B站上逐項驗證行為；擴充功能的實測使用模擬頁面。
- 只涵蓋上面列出的版本。腳本更新後需要重新審查。
