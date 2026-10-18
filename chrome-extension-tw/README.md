# Bilibili CDN 台灣優化：Chrome 擴充功能版

這個資料夾把 Greasy Fork 上的「Bilibili CDN 台灣優化」（作者 jiyunshi，MIT 授權，Greasy Fork 腳本編號 579776）包成 Chrome / Edge 開發人員模式可以直接載入的擴充功能，不需要 Tampermonkey。

它跟倉庫裡的 `chrome-extension/`（SanJerry007 的「B站CDN优选」）是**兩套不同作者、不同做法的程式**。兩者都會改寫影片頁的播放地址，**請不要同時啟用**。

## 安裝

1. 下載本倉庫（`git clone`，或在 GitHub 上點 Code → Download ZIP 再解壓縮）
2. 打開 `chrome://extensions`（Edge 是 `edge://extensions`），開啟「開發人員模式」
3. 點「載入未封裝項目」，選 `chrome-extension-tw` 這個資料夾
4. 打開任一部 B站影片。要確認有在運作，可以按 F12 打開 Console，輸入 `BiliCDN.diag()`

需要 Chrome 或 Edge 111 以上。

## 跟 Tampermonkey 版的差別

- **設定和學習資料存在 B站網頁的 localStorage**，鍵名以 `BiliCDN_TW:` 開頭，不是 Tampermonkey 的儲存空間。所以清除 bilibili.com 的網站資料，會一併清掉腳本學到的節點狀態。B站頁面上的腳本也讀寫得到這些資料；不過它們本來就能控制整個頁面，所以這不算新增的風險，而腳本對「固定 CDN 只能是 `*.bilivideo.com` / `*.bilivideo.cn`」的檢查照樣有效。
- **沒有 Tampermonkey 選單。** 選單裡的功能在播放器的設定面板裡都有，也可以在 Console 用 `BiliCDN.reset()`、`BiliCDN.diag()`、`BiliCDN.bakeoff()`、`BiliCDN.verbose(true)`、`BiliCDN.httpdns()`。
- **不會自動更新。** 跑的永遠是你硬碟上這份。要更新：把 Greasy Fork 上的新版內容換進倉庫根目錄的 `bilibili-cdn-tw.user.js`，執行 `node tools/build-extension-tw.js`，再到擴充功能頁按重新載入。新版如果用到這裡沒有支援的權限（例如 `GM_xmlhttpRequest`、`@require`），建置會直接失敗並說明缺什麼，而不是做出一個執行時才壞掉的擴充功能。
- **想改設定**（例如把 `BlockWebRTC` 改成 `false`）：改根目錄的 `bilibili-cdn-tw.user.js` 再重新建置。直接改 `chrome-extension-tw/bilibili-cdn-tw.js` 也能用，但下次建置會被覆蓋。

## 為什麼不是直接複製一份腳本

Tampermonkey 會替腳本做兩件事，Chrome 擴充功能不會，所以 `bilibili-cdn-tw.js` 是由 `tools/build-extension-tw.js` 產生的：

1. **把整份腳本包在一個函式裡。** 這份腳本有大約 270 個寫在最外層的 `const` / `let` / `function`。直接放進網頁環境的話，這些名稱會變成網頁的全域變數。實測：B站頁面上任何一段在最外層宣告 `let log` 的程式，都會因為 `Identifier 'log' has already been declared` 而整段無法執行。
2. **提供 `GM_*` 函式。** `GM_getValue` / `GM_setValue` / `GM_deleteValue` 對應到 localStorage（兩者都是同步讀寫，行為一致），`GM_info` 帶入腳本版本，`unsafeWindow` 就是網頁的 `window`，`GM_registerMenuCommand` 不提供（腳本本身會檢查它存不存在，不存在就略過選單）。

原始腳本一字不改地放在產生出來的檔案中間，前後只多了這層包裝。`node tools/build-extension-tw.js --check` 會確認 `manifest.json` 和 `bilibili-cdn-tw.js` 跟根目錄的腳本一致，CI 每次 push 都會跑。

## 已驗證的部分

在 Chromium 裡載入這個擴充功能，用模擬的 B站影片頁測試（測試環境連不到真正的 B站）：

- 內聯 `__playinfo__`、`fetch`、`XHR` 三條路，都會把台灣已知不可用的節點換成可用的鏡像
- 透過 `BiliCDN.setCdn()` 固定的 CDN 會存進 localStorage，重新整理後仍然生效；非 B站網域會被拒絕
- WebRTC 已被停用，`BiliCDN` 主控台介面可用
- 網頁自己宣告同名的全域變數不會出錯，腳本內部的變數沒有外洩到網頁

還沒在真正的 B站上播放驗證過，播放器裡的設定面板也還沒實際看過。
