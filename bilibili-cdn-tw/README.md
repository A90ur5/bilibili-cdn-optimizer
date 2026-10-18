# Bilibili CDN 台灣優化：Chrome 擴充功能版

這個資料夾把 Greasy Fork 上的「Bilibili CDN 台灣優化」（作者 jiyunshi，MIT 授權，[Greasy Fork 腳本編號 579776](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)）包成 Chrome / Edge 開發人員模式可以直接載入的擴充功能，不需要 Tampermonkey。

它跟倉庫裡的 `chrome-extension/`（SanJerry007 的「B站CDN优选」）是**兩套不同作者、不同做法的程式**。兩者都會改寫影片頁的播放地址，**請不要同時啟用**。

## 這個資料夾裡有什麼

| 檔案 | 說明 |
|---|---|
| `bilibili-cdn-tw.user.js` | Greasy Fork 上的原始腳本，一字未改。要更新或改設定就改這份 |
| `chrome-extension-tw/` | 擴充功能本體，Chrome 載入的就是這個資料夾。由建置腳本產生，不要手動改 |
| `chrome-extension-tw.zip` | 同一份擴充功能加上這份說明打包成 zip，方便只下載一個檔案 |

## 安裝

1. 取得擴充功能，二選一：
   - 只下載 `chrome-extension-tw.zip` 再解壓縮
   - 下載整個倉庫（`git clone`，或在 GitHub 上點 Code → Download ZIP 再解壓縮）
2. 打開 `chrome://extensions`（Edge 是 `edge://extensions`），開啟「開發人員模式」
3. 點「載入未封裝項目」，選 `chrome-extension-tw` 這個資料夾
4. 打開任一部 B站影片。要確認有在運作，看下面「怎麼看它選了哪個 CDN」

需要 Chrome 或 Edge 111 以上。

## 怎麼看它選了哪個 CDN

這份腳本**不會在畫面上跳出提示**，這是原作者的設計，不是沒在運作。它的資訊都放在播放器裡：

- **播放器設定選單**：點播放器控制列上的齒輪（設定），裡面會多一段「攔截修改影片 CDN」（瀏覽器語言不是中文時顯示 `CDN Switcher (TW)`）。裡面有：
  - 開關：取消勾選就停用整個腳本
  - 白名單：目前可用的節點，排在最前面的就是優先使用的
  - 緩衝進度、黑名單和已知壞掉的節點、這次播放失敗過的節點、改寫次數、HTTPDNS 狀態
  - 「複製診斷」：把狀態複製到剪貼簿，回報問題時用
- **Console**：按 F12 打開 Console，輸入 `BiliCDN.diag()` 看完整狀態。背景記錄預設是關的，要看每一步的選擇可以輸入 `BiliCDN.verbose(true)` 後重新整理。

## 跟 Tampermonkey 版的差別

- **設定和學習資料存在 B站網頁的 localStorage**，鍵名以 `BiliCDN_TW:` 開頭，不是 Tampermonkey 的儲存空間。所以清除 bilibili.com 的網站資料，會一併清掉腳本學到的節點狀態。B站頁面上的腳本也讀寫得到這些資料；不過它們本來就能控制整個頁面，所以這不算新增的風險，而腳本對「固定 CDN 只能是 `*.bilivideo.com` / `*.bilivideo.cn`」的檢查照樣有效。
- **沒有 Tampermonkey 選單。** 選單裡的功能在播放器的設定面板裡都有，也可以在 Console 用 `BiliCDN.reset()`、`BiliCDN.diag()`、`BiliCDN.bakeoff()`、`BiliCDN.verbose(true)`、`BiliCDN.httpdns()`。
- **不會自動更新。** 跑的永遠是你硬碟上這份。要更新：把 Greasy Fork 上的新版內容換進這個資料夾的 `bilibili-cdn-tw.user.js`，在倉庫根目錄執行 `node tools/build-extension-tw.js`（會同時更新 `chrome-extension-tw/` 和 zip），再到擴充功能頁按重新載入。新版如果用到這裡沒有支援的權限（例如 `GM_xmlhttpRequest`、`@require`），建置會直接失敗並說明缺什麼，而不是做出一個執行時才壞掉的擴充功能。
- **想改設定**（例如把 `BlockWebRTC` 改成 `false`）：改 `bilibili-cdn-tw.user.js` 再重新建置。直接改 `chrome-extension-tw/bilibili-cdn-tw.js` 也能用，但下次建置會被覆蓋。

## 為什麼不是直接複製一份腳本

Tampermonkey 會替腳本做兩件事，Chrome 擴充功能不會，所以 `bilibili-cdn-tw.js` 是由 `tools/build-extension-tw.js` 產生的：

1. **把整份腳本包在一個函式裡。** 這份腳本有大約 270 個寫在最外層的 `const` / `let` / `function`。直接放進網頁環境的話，這些名稱會變成網頁的全域變數。實測：B站頁面上任何一段在最外層宣告 `let log` 的程式，都會因為 `Identifier 'log' has already been declared` 而整段無法執行。
2. **提供 `GM_*` 函式。** `GM_getValue` / `GM_setValue` / `GM_deleteValue` 對應到 localStorage（兩者都是同步讀寫，行為一致），`GM_info` 帶入腳本版本，`unsafeWindow` 就是網頁的 `window`，`GM_registerMenuCommand` 不提供（腳本本身會檢查它存不存在，不存在就略過選單）。

原始腳本一字不改地放在產生出來的檔案中間，前後只多了這層包裝。`node tools/build-extension-tw.js --check` 會確認 `manifest.json`、`bilibili-cdn-tw.js` 和 zip 都跟 `bilibili-cdn-tw.user.js` 一致，CI 每次 push 都會跑。zip 不壓縮、時間戳固定，所以同樣的輸入每次都產生完全相同的檔案，才比對得出有沒有過期。

## 已驗證的部分

在 Chromium 裡載入這個擴充功能，用模擬的 B站影片頁測試（測試環境連不到真正的 B站）：

- 內聯 `__playinfo__`、`fetch`、`XHR` 三條路，都會把台灣已知不可用的節點換成可用的鏡像
- 透過 `BiliCDN.setCdn()` 固定的 CDN 會存進 localStorage，重新整理後仍然生效；非 B站網域會被拒絕
- WebRTC 已被停用，`BiliCDN` 主控台介面可用
- 網頁自己宣告同名的全域變數不會出錯，腳本內部的變數沒有外洩到網頁

還沒在真正的 B站上確認過完整的運作情形。

## 擴充功能頁出現「錯誤」按鈕

以開發人員模式載入時，Chrome 會把擴充功能程式碼印出的 `console.warn` / `console.error` 收進擴充功能頁的「錯誤」清單。用 Tampermonkey 時這些訊息只會出現在 F12 Console，所以以前看不到。常見的兩種都不是故障：

- **`[BiliCDN_TW_v1.3.4]: 這個頁面的網址取不到影片識別碼（...）`**：原作者刻意留的提示，不是錯誤。腳本認不出這個網址是哪一部影片，例如「稍後再看」的清單頁 `/watchlater/list`。訊息本身寫明 CDN 改寫不受影響；只有在這種頁面裡連續切換影片時，下一部可能不會重新挑選節點。
- **`[Mirror]: ...`、`Script error.` 之類**：這是 B站自己的錯誤回報程式印的。腳本為了偵測影片分段下載失敗，包裝了 `console.warn` / `console.error`，所以 B站自己印的錯誤在 Chrome 看來也像是從擴充功能發出的，堆疊最上面會是 `bilibili-cdn-tw.js` 的 `(wrapped)`。

真正由擴充功能拋出的錯誤會以 `Uncaught TypeError` 之類的標題單獨列出。
