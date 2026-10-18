# B站 CDN 優選 · Bilibili CDN Optimizer

> 在海外（包含台灣）看 B站影片不再卡：自動挑選比較快的 CDN 節點。repo 裡的兩個版本都能不裝 Tampermonkey，直接以 Chrome 擴充功能載入。
>
> Two tools that keep Bilibili videos from buffering outside mainland China, both loadable as Chrome extensions without Tampermonkey.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Userscript](https://img.shields.io/badge/type-userscript-00a1d6.svg)](./bilibili-cdn-optimizer/bilibili-cdn-optimizer.user.js)

本 repo fork 自 [SanJerry007/bilibili-cdn-optimizer](https://github.com/SanJerry007/bilibili-cdn-optimizer)，收錄兩個不同作者的版本，各放在一個資料夾裡。English version below.

---

## 兩個版本

| 資料夾 | 內容 | 來源 |
|---|---|---|
| [`bilibili-cdn-optimizer/`](./bilibili-cdn-optimizer/) | 「B站CDN優選」v3.3.1：油猴腳本、Chrome 擴充功能、zip | 上游 SanJerry007，腳本未修改；擴充功能由本 fork 打包 |
| [`bilibili-cdn-tw/`](./bilibili-cdn-tw/) | 「Bilibili CDN 台灣優化」v1.3.4：原始腳本、Chrome 擴充功能、zip | jiyunshi 發布於 [Greasy Fork](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)，本 fork 打包 |

兩者都會改寫播放網址，**一次只啟用一個**。

兩個版本都做過安全審查，沒有發現惡意行為：[B站CDN優選](./bilibili-cdn-optimizer/SECURITY-AUDIT.md)、[台灣優化](./bilibili-cdn-tw/SECURITY-AUDIT.md)。報告也列出各自要注意的地方，例如 Tampermonkey 版的自動更新。

## 該用哪一個？

| | B站CDN優選 | Bilibili CDN 台灣優化 |
|---|---|---|
| 做法 | 只在 B站回傳的鏡像之間實測，挑最快的 | B站有給 Akamai 時優先用 Akamai，否則改寫到內建的 B站鏡像清單；預設避開台灣連不到的節點，並停用 WebRTC（P2P / PCDN） |
| 畫面提示 | 右下角顯示目前使用的 CDN | 沒有彈出提示；狀態在播放器齒輪選單和 `BiliCDN.diag()` |
| 程式規模 | 約 760 行 | 約 5,500 行 |
| 說明 | [bilibili-cdn-optimizer/README.md](./bilibili-cdn-optimizer/README.md) | [bilibili-cdn-tw/README.md](./bilibili-cdn-tw/README.md) |
| 安全審查 | [SECURITY-AUDIT.md](./bilibili-cdn-optimizer/SECURITY-AUDIT.md) | [SECURITY-AUDIT.md](./bilibili-cdn-tw/SECURITY-AUDIT.md) |

## 快速安裝（Chrome 擴充功能）

1. 到 [Releases](https://github.com/A90ur5/bilibili-cdn-optimizer/releases) 下載要用的那個版本的 zip（檔名帶有版本號，說明裡附有 SHA-256 雜湊值可以核對），再解壓縮。也可以直接下載 repo 裡的：
   - B站CDN優選：[`bilibili-cdn-optimizer/chrome-extension.zip`](./bilibili-cdn-optimizer/chrome-extension.zip)
   - 台灣優化：[`bilibili-cdn-tw/chrome-extension-tw.zip`](./bilibili-cdn-tw/chrome-extension-tw.zip)
2. 打開 `chrome://extensions`（Edge 是 `edge://extensions`），開啟「開發人員模式」
3. 點「載入未封裝項目」，選解壓縮出來的 `chrome-extension`（或 `chrome-extension-tw`）資料夾

需要 Chrome 或 Edge 111 以上。用 Tampermonkey 安裝、確認有在運作、修改設定等，見各資料夾的 README。

## 根目錄的其他檔案

- `tools/zip.js`：兩個版本的建置腳本共用的 zip 產生器。同樣的輸入每次都產生完全相同的 zip，CI 才比對得出 zip 有沒有過期。
- `.github/workflows/selftest.yml`：CI，見下方「檢查」。
- `.github/workflows/release.yml`、`tools/release.js`：發布 release，見下方「發布新版」。
- `.githooks/`、`.dataclass.json`、`.pii-allow`：上游留下的提交前檢查設定，見下方「開發」。
- `LICENSE`

## 開發

### 複製這個 repo

```bash
git clone https://github.com/A90ur5/bilibili-cdn-optimizer.git
cd bilibili-cdn-optimizer
```

`.githooks/` 是上游留下的提交前檢查，會從 `git config fleet.guards` 和 `git config fleet.style` 指向的本機 fleet-guards、fleet-style checkout 執行個資掃描、資料邊界和破折號檢查。這些工具不在本 repo 裡，**兩項設定只要有一項沒設，提交就會被擋下**（這是刻意的 fail-closed 設計）。所以手邊沒有這兩套工具的話，不要執行 `git config core.hooksPath .githooks`，否則每次提交都會失敗。只想使用腳本或擴充功能的話，完全不需要它們。

### 檢查

在 repo 根目錄執行：

```bash
node bilibili-cdn-optimizer/tools/selftest.js                  # B站CDN優選：腳本的行為測試
node bilibili-cdn-optimizer/tools/build-extension.js --check   # B站CDN優選：擴充功能的複本、manifest、zip
node bilibili-cdn-tw/tools/build-extension-tw.js --check       # 台灣優化：擴充功能與 zip 跟原始腳本一致
```

CI 在每次 push 和 PR 都會跑這幾項，再加上腳本的語法檢查。各項檢查的細節見各資料夾的 README。修改腳本或 README 之後，執行同一支建置腳本但不加 `--check`，就會重新產生擴充功能和 zip。

### 發布新版

推送一個以 `v` 開頭的標籤，就會自動建立 release，並附上兩個 zip：

```bash
git tag v2026.10.18
git push origin v2026.10.18
```

也可以在 GitHub 的 Actions 頁面手動執行 `release` 工作流程，輸入標籤名稱。工作流程會先確認兩個 zip 跟原始碼一致，不一致就不發布；release 說明由 `tools/release.js` 產生，內容包含版本、安裝步驟、安全審查連結和檔案雜湊值。

## 授權

本 repo 依 [MIT](./LICENSE) 授權（LICENSE 檔的著作權人為 SanJerry007）。`bilibili-cdn-tw/` 裡的「Bilibili CDN 台灣優化」腳本及由它產生的檔案，著作權屬於 jiyunshi，依該腳本標頭宣告的 MIT 授權收錄。

---

## English

This repository is a fork of [SanJerry007/bilibili-cdn-optimizer](https://github.com/SanJerry007/bilibili-cdn-optimizer). It holds two independent tools that keep Bilibili videos from buffering outside mainland China, one per folder. Both rewrite playback URLs, so **enable only one at a time**.

| Folder | What | Source |
|---|---|---|
| [`bilibili-cdn-optimizer/`](./bilibili-cdn-optimizer/) | "B站CDN优选" v3.3.1: measures the mirrors Bilibili returns and promotes the fastest. Userscript, Chrome extension, zip | SanJerry007, script unmodified; the extension is this fork's packaging |
| [`bilibili-cdn-tw/`](./bilibili-cdn-tw/) | "Bilibili CDN 台灣優化" v1.3.4: tuned for Taiwan, prefers Akamai when Bilibili offers it and otherwise rewrites to a built-in list of Bilibili mirrors; blocks WebRTC (P2P/PCDN). Original script, Chrome extension, zip | jiyunshi on [Greasy Fork](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96), packaged by this fork |

### Quick install (Chrome extension)

1. Download a zip from [Releases](https://github.com/A90ur5/bilibili-cdn-optimizer/releases) (versioned file names, SHA-256 checksums in the notes), or [`bilibili-cdn-optimizer/chrome-extension.zip`](./bilibili-cdn-optimizer/chrome-extension.zip) / [`bilibili-cdn-tw/chrome-extension-tw.zip`](./bilibili-cdn-tw/chrome-extension-tw.zip) from the repo, and unzip it
2. Open `chrome://extensions` (`edge://extensions` in Edge) and turn on *Developer mode*
3. Click *Load unpacked* and pick the unzipped `chrome-extension` (or `chrome-extension-tw`) folder

Chrome or Edge 111+ is required. Each folder also has a security review, `SECURITY-AUDIT.md` (in Chinese); neither found malicious behaviour. The Tampermonkey route and everything else are in each folder's README; [bilibili-cdn-optimizer/README.md](./bilibili-cdn-optimizer/README.md) has an English section.

### Checks

```bash
node bilibili-cdn-optimizer/tools/selftest.js
node bilibili-cdn-optimizer/tools/build-extension.js --check
node bilibili-cdn-tw/tools/build-extension-tw.js --check
```

CI runs these, plus a syntax check of the userscript, on every push and pull request. Run a build script without `--check` to regenerate its extension and zip. `tools/zip.js` is the byte-stable zip writer both build scripts share.

Pushing a tag that starts with `v` (or running the `release` workflow by hand) publishes a GitHub release with both zips; the workflow refuses to release if either zip is stale, and `tools/release.js` writes the notes.

`.githooks/` comes from upstream and needs the upstream author's local fleet-guards and fleet-style tools; without them, do not set `core.hooksPath`, or every commit will be blocked.

### License

[MIT](./LICENSE) (copyright SanJerry007 in the LICENSE file). The "Bilibili CDN 台灣優化" script in `bilibili-cdn-tw/` and the files generated from it are jiyunshi's work, included under the MIT license declared in its header.
