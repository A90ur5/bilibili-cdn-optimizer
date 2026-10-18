# B站 CDN 優選 · Bilibili CDN Optimizer

> 在海外（包含台灣）看 B站影片不再卡：自動挑選比較快的 CDN 節點。repo 裡的兩個工具都能不裝 Tampermonkey，直接以 Chrome 擴充功能載入。
>
> Two tools that keep Bilibili videos from buffering outside mainland China, both loadable as Chrome extensions without Tampermonkey.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Userscript](https://img.shields.io/badge/type-userscript-00a1d6.svg)](./bilibili-cdn-optimizer.user.js)

本 repo fork 自 [SanJerry007/bilibili-cdn-optimizer](https://github.com/SanJerry007/bilibili-cdn-optimizer)。除了上游的油猴腳本，另外收錄了 jiyunshi 的台灣優化腳本，兩者都打包成了 Chrome 擴充功能。English version below.

---

## 本 repo 內容

| 路徑 | 內容 | 來源 |
|---|---|---|
| `bilibili-cdn-optimizer.user.js` | 「B站CDN優選」v3.3.1 油猴腳本 | 上游 SanJerry007，未修改 |
| `chrome-extension/` | 同一份腳本的 Chrome 擴充功能 | 本 fork 新增，腳本是根目錄那份的逐位元組複本 |
| `bilibili-cdn-tw/` | 「Bilibili CDN 台灣優化」v1.3.4：原始腳本、Chrome 擴充功能、zip | jiyunshi 發布於 [Greasy Fork](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)，本 fork 打包 |
| `tools/` | `selftest.js`（上游的行為測試）、`check-extension.js` 與 `build-extension-tw.js`（本 fork 新增） | |

## 該用哪一個？

兩者都會改寫播放網址，**一次只啟用一個**。

| | B站CDN優選 | Bilibili CDN 台灣優化 |
|---|---|---|
| 做法 | 只在 B站回傳的鏡像之間實測，挑最快的 | B站有給 Akamai 時優先用 Akamai，否則改寫到內建的 B站鏡像清單；預設避開台灣連不到的節點，並停用 WebRTC（P2P / PCDN） |
| 畫面提示 | 右下角顯示目前使用的 CDN | 沒有彈出提示；狀態在播放器齒輪選單和 `BiliCDN.diag()` |
| 程式規模 | 約 760 行 | 約 5,500 行 |
| 說明 | 本頁下方 | [bilibili-cdn-tw/README.md](./bilibili-cdn-tw/README.md) |

---

## B站CDN優選（SanJerry007）

### 這是什麼問題？

在海外看 B站，網頁、封面、留言都很快，偏偏**影片卡成投影片**。原因不在你的網速，而在 B站的 **CDN 調度**：

B站每次播放會從多個 CDN 鏡像中分配一個給你。對海外 IP，這個分配幾乎是**隨機**的，可能落在：

- 🟢 **就近的海外節點**（例如遍布全球、自動就近的 Akamai）→ 飛快，上百 Mbps
- 🟡 較遠的海外節點（例如某地區的騰訊雲中繼）→ 普通，幾十 Mbps
- 🔴 **中國境內節點**（資料要跨太平洋，甚至繞道歐洲進中國）→ 災難，延遲 200ms 以上，反覆緩衝

抽到紅色那一檔，影片就卡。關鍵在於：**那個飛快的就近節點，其實一直都在 B站回傳的鏡像清單裡**，只是沒被排在第一位。

### 這個腳本怎麼解決？

腳本從兩個地方取得 B站給的播放網址清單，再從回傳的多個 CDN 鏡像中**挑一個最快的**交給播放器：一是頁面 HTML 裡內嵌的 `window.__playinfo__`（打開影片頁時，第一部影片走這條路），二是 `playurl` API 的回應（切換畫質、站內換頁時走這條路）。有兩種模式：

- **`auto` 實測擇優（預設，推薦）**：攔到播放網址後，**等播放器自己緩衝夠了**，才在背景**逐一**實測每個 CDN 鏡像的**持續吞吐量**，挑最快的。測速會丟掉開頭的 256KB 或 500ms（那一段是交握加 TCP 慢啟動，量到的是延遲而不是頻寬），之後才開始計時。測量窗口是「最多 1.2 秒或最多 4MB，先到者為準」；在快的線路上先到的一定是 4MB（約 26 Mbps 以上就由位元組數決定，200 Mbps 時實際窗口只有 150ms 左右），這是不想為了湊滿 1.2 秒而下載幾十 MB 的取捨。結果會**跨頁面保存** 10 分鐘，下次打開影片時第一個畫面就用上最佳來源，不必等測速。
- **`prefer` 固定優先（省流量）**：不測速，直接把指定的就近 CDN（預設是 Akamai 的 `akamaized.net`）排到第一位。

三層備援確保影片一定播得出來：**實測勝出者 → PREFER 就近節點 → B站原本的預設**。落選的鏡像仍留在 `backupUrl` 裡，播放器自己的故障切換照常運作。只有測速時硬失敗（403、CORS、逾時）的鏡像，才會被暫時列入黑名單 5 分鐘。

另外還有一層**播放健康看門狗**：它監聽 `video` 元素的 `waiting` 事件和緩衝領先量，在影片真的卡住時重新測一次。這時會得到兩種結論，兩種都有用：要嘛其他鏡像確實比較快，它會換好並提示你重新整理後生效；要嘛**每個鏡像都一樣慢**，它會直接說「不是選錯來源，是目前線路的狀況」，免得你以為是 CDN 沒選對而白忙一場。複測的流量預算只有平常的四分之一，因為這時播放器本來就吃不飽，不能再跟它搶頻寬。

- ✅ **不偽造、不竄改網址**：只在 B站*本來就給你的*合法鏡像之間挑選
- ✅ **不需要 VPN**：直連就能跑滿速
- ✅ **免設定，裝好就能用**
- ✅ 可與 Bilibili-Evolved、下載助手等其他腳本並存，各自獨立運作

> 為什麼需要它：B站的 CDN 調度是針對「中國大陸使用者 + 它自己的頻寬成本」最佳化的，對海外 IP 常預設給一個較慢的節點，把最快的就近節點放在備援位；而播放器只用第一個，不會自己比速度。這個腳本替播放器補上「挑選」這一步。

### 安裝（Tampermonkey）

1. 先安裝腳本管理器 [Tampermonkey](https://www.tampermonkey.net/)（Chrome、Edge、Firefox 都可以）
2. 點這裡安裝腳本 👉 **[bilibili-cdn-optimizer.user.js](https://raw.githubusercontent.com/SanJerry007/bilibili-cdn-optimizer/main/bilibili-cdn-optimizer.user.js)**
   Tampermonkey 會自動跳出安裝頁，按「安裝」即可。
3. 打開任一部 B站影片，右下角出現 `✅ CDN已优选: ...` 的提示就代表成功。第一次打開時還沒有實測結果，用的是備援來源；等它測完一輪，之後打開的影片就會直接顯示綠色的 `🏆 实测最快CDN: ...`。

> 這個連結指向上游 SanJerry007 的 repo，腳本裡的 `@updateURL` 也指向上游，所以 Tampermonkey 之後會**自動從上游更新**。不想讓別人的新版自動進來，請改用下面的 Chrome 擴充功能。

### 不裝 Tampermonkey：以 Chrome 擴充功能載入

腳本使用 `@grant none`，沒用到任何 Tampermonkey 專屬功能，所以 `chrome-extension/` 資料夾可以直接以未封裝擴充功能載入（Chrome / Edge 111 以上）：

1. 下載本 repo（`git clone`，或在 GitHub 上點 Code → Download ZIP 再解壓縮）
2. 打開 `chrome://extensions`（Edge 是 `edge://extensions`），開啟「開發人員模式」
3. 點「載入未封裝項目」，選 `chrome-extension` 這個資料夾
4. 打開任一部 B站影片，右下角出現跟上面一樣的提示就代表成功

跟 Tampermonkey 版的差別：

- **不會自動更新。** 執行的永遠是你硬碟上那份程式碼；要更新就重新下載，再到擴充功能頁按重新載入。這也是它比較安全的地方：沒有人能替你推一份新程式碼進來。
- **不在登入、帳號、付款頁面執行**（`passport`、`account`、`pay`、`member` 四個子網域）。腳本在這些頁面本來就不做任何事，排除掉只是少一處攔截。
- 只套用 `https://`。
- 想改 `CFG`，就改 `chrome-extension/bilibili-cdn-optimizer.user.js`，改完到擴充功能頁按重新載入。

`chrome-extension/` 裡的腳本是根目錄那份的**逐位元組複本**，不是另外寫的版本。要修改 repo 本身的話，改根目錄那份再 `cp` 過去。`node tools/check-extension.js` 會檢查兩份是否一致、版本號是否相同，以及兩個一旦寫錯就會**無聲失效**的設定：`"world": "MAIN"`（預設的隔離環境有自己的 `window`，在那裡攔截 fetch、XHR、`__playinfo__`，網頁完全看不到）和 `"run_at": "document_start"`（晚一步，B站內嵌的 `__playinfo__` 就已經賦值完了）。

### 確認有在運作

- 右下角的提示顯示的是**播放器此刻真正在用的 host**。綠色的 `🏆 实测最快CDN: xxx (123.4 Mbps)` 表示這個來源是實測選出來的，頻寬數字可以對照；藍色的 `⚠️ 用兜底CDN: ...` 表示還沒有實測結果，正在用 PREFER 備援。
- 按 F12 打開 Console，可以看到 `[B站CDN优选] 测速结果(持续吞吐):` 列出每個 CDN 的實測 Mbps，以及綠字 `最快 -> ...`。如果勝出者跟目前在用的不是同一個，會看到 `测速赢家是 X,但本次播放已在用 Y 且换不掉了。已存下,下个视频或刷新后生效`。播放途中是換不掉來源的（見 3.3 版的實測），**腳本不會在改不動的時候宣稱自己改了。**

（畫面提示和 Console 訊息是腳本內建的簡體中文，這裡照原文列出，方便對照。）

### 進階設定

編輯腳本開頭的 `CFG`：

```js
const CFG = {
  MODE: 'auto',                 // 'auto'=實測擇優(預設) | 'prefer'=固定優先,不測速省流量
  PREFER: ['akamaized.net'],    // 還沒有實測結果時的備援優先網域,依序退回
  WARMUP_BYTES: 262144,         // 測速時丟掉的暖身位元組數(交握+慢啟動,量到的是延遲不是頻寬)
  WARMUP_MS: 500,               // 暖身最長這麼久,與上一項先到者為準
  MEASURE_MS: 1200,             // 暖身之後真正計入速度的測量窗口(ms)
  MAX_BYTES: 4 * 1024 * 1024,   // 每個鏡像最多下載這麼多就停,快的線路上由它決定窗口長度
  MAX_MIRRORS: 3,               // 一輪最多測幾個鏡像,沒測到的會寫進 Console
  TEST_COOLDOWN: 60 * 1000,     // 兩輪測速的最小間隔,避免全部失敗時無限重測
  TEST_DELAY_MS: 2000,          // 最早等這麼久才開始檢查播放器緩衝
  TEST_BUFFER_AHEAD_S: 10,      // 緩衝領先這麼多秒,就認為播放器吃飽了,可以開始測
  TEST_DEFER_MAX_MS: 45000,     // 等不到緩衝也不要無限等
  HEALTH_WATCH: true,           // 播放卡頓時自動複測,見下文
  HEALTH_STALL_EVENTS: 3,       // 30 秒窗口內累積幾次 waiting 算卡住
  HEALTH_MIN_BUFFER_S: 3,       // 播放中緩衝領先低於這麼多秒算吃不飽
  HEALTH_LOW_SAMPLES: 5,        // 連續吃不飽這麼多秒才判定
  HEALTH_PROBE_BYTES: 1048576,  // 複測預算,刻意設小,別跟吃不飽的播放器搶頻寬
  HEALTH_MAX_CHECKS: 3,         // 每部影片最多複測幾次
  HEALTH_SEEK_GRACE_MS: 4000,   // 拖動進度條前後這段時間的卡頓不算(拖動一定會觸發 waiting)
  HEALTH_FIRST_FILL_MS: 20000,  // 開頭這段時間若還沒健康過就不判定卡住,但保護有期限
  TEST_TIMEOUT: 8000,           // 單一鏡像整體逾時(ms)
  CACHE_TTL: 10 * 60 * 1000,    // 實測結果快取時間(ms),跨頁面保存
  MIN_GAIN: 1.25,               // 要比目前使用的快這麼多倍才換,避免在雜訊上來回切換
  BAN_TTL: 5 * 60 * 1000,       // 測速硬失敗的鏡像暫時不選的時間(ms)
  SHOW_TOAST: true,             // 右下角提示,熟悉之後可以關掉
};
```

**這個探針分得出什麼、分不出什麼**（在一條海外直連線路上，對同一對鏡像連測兩輪的結果）：兩個都很快的來源之間，讀數會跳動，一輪 289.5 Mbps、下一輪 139.1 Mbps 都有可能，`MIN_GAIN` 壓不住這種兩倍等級的跳動，所以在兩個快來源之間選誰帶有一定隨機性。這沒關係，因為兩個都快。它真正要認出來的是**快來源和慢來源之間的數量級差距**（例如就近節點幾百 Mbps 對上境內節點的幾百 KB/s），那是幾十到上百倍的差距，任何一輪都分得出來。舊探針連前一種都分不出來：同一個來源兩輪讀到 17.3 和 40.1 Mbps，而實際值在 139 以上。

流量成本：每 10 分鐘最多測一輪，一輪最多 3 個鏡像，每個最多 4MB，所以上限是每 10 分鐘 12MB。嫌流量太多可以調小 `MAX_BYTES` 或 `MAX_MIRRORS`（在快的線路上調 `MEASURE_MS` 沒用，先到的是位元組上限），或乾脆改用 `prefer` 模式。

- 想省流量、不想每次測速：把 `MODE` 改成 `'prefer'`，它就只依 `PREFER` 固定挑選（對大多數海外地區來說，Akamai 已經是就近節點）。
- `auto` 模式下，`PREFER` 仍是測速完成前和測速失敗時的備援。

### 常見問題

- **會跟 Bilibili-Evolved 衝突嗎？** 不會。Bilibili-Evolved 沒有 CDN 挑選功能，這個腳本是獨立的補充。
- **會被封帳號嗎？** 風險很低：腳本只在 B站合法回傳的鏡像之間調整優先順序，不涉及任何越權或偽造的請求。
- **番劇、港澳台限定、4K 也有效嗎？** 有效。腳本同時處理 `dash`（一般影片、番劇）和 `durl`（舊格式）兩種回應。

### 版本紀錄

#### 3.3.1 修了什麼

3.3 那道「起播保護」只修了一半。`armed` 這個旗標只在緩衝取樣那條路上檢查，**`waiting` 事件那條路完全沒檢查**，而後者偏偏更容易觸發。在 3.3 上實測：影片剛開始填緩衝、緩衝只有 0.4 秒時，三次 `waiting` 就能讓它跑去測速、**把一個健康的來源列入黑名單**，還跳出重新整理提示。等於 3.2 修掉的「搶起播頻寬」又被我自己從後門放了回來。

順便把保護的寫法也改對了。原本是「沒健康過就不判定卡住」，這會留下更糟的盲點：一個從第一秒就壞掉的播放永遠不會健康，看門狗對最該管的情況反而完全失靈。現在改成**有期限的窗口**（`HEALTH_FIRST_FILL_MS`）：窗口內不判定，過了窗口即使從沒健康過也要檢查一次。

還有一處：`armed` 是全域的，換 `video` 元素時不會歸零。一個健康的片頭廣告播放器，會替正片的起播把看門狗提前啟動，然後在正片最需要頻寬的那幾秒開始測速。現在換元素就等於換一次播放，健康紀錄歸零重來。

#### 3.3 加了什麼

**一條來自實際播放的回饋。** 在這之前，腳本選完來源就放手不管：影片卡成投影片它也不知道，就這樣死守 10 分鐘等快取過期。但實測同一個鏡像的吞吐量可以在二十分鐘內從 24 Mbps 變成 196 Mbps，線路的變化比 `CACHE_TTL` 快得多，所以「測一次、守十分鐘」這個前提本身就不成立。

現在它監聽 `video` 的 `waiting` 事件和緩衝領先量，卡住了就用小預算複測，再分兩種情況處理，**兩種都會明確告訴你**：其他鏡像比較快，就換好並提示重新整理；每個來源都一樣慢，就說清楚問題不在選來源。後者同樣重要，不然你會一直以為是 CDN 沒挑對。

**判定「卡住」這件事，誤判的代價比漏判高**，因為誤判會在播放器最餓的時候去搶它的頻寬。所以設了四道關卡：開頭 20 秒內若還沒看過一次健康的緩衝，一律不判定卡住（否則影片剛開始填緩衝那幾秒緩衝本來就少，會被當成卡住，等於把 3.2 剛修掉的問題從後門放回來），兩條判定路徑都要通過這一關；拖動進度條前後 4 秒內的卡頓一律不算（拖動一定會觸發 `waiting`）；緩衝領先量要取**包含播放位置的那一段**，不能一律取最後一段，否則往回拖之後會算出很大的數字；影片快播完時緩衝領先量本來就接近 0，那不是吃不飽。最後兩條都是在真實瀏覽器實測時踩到的，不是想出來的。

腳本在 iframe 裡也會各自執行一份，實測一個影片頁跑出了 5 份。改寫網址每個 frame 都該做，但測速和看門狗只在最上層做一次，否則就是 5 套測速在搶同一條頻寬。

**同時修正了一句之前的過度承諾。** 3.1 和 3.2 在測速出結果後會印出「已改寫播放網址物件」。物件確實改了，但實測顯示**播放器根本不看**：把 21 個串流物件全部改寫成另一個主機、再強制跳轉，之後 20 秒內的 14 個分段仍然全部來自舊主機。播放器一開始就把主機定下來了。所以那句話雖然字面上沒錯，卻暗示了做不到的事。現在改成 `已存下,下个视频或刷新后生效`，而且這一檔的提示**可以點**，點了就重新整理。

#### 3.2 修了什麼

**測速不再在 `document-start` 開始。** 3.1 一攔到播放網址就馬上測速，而那正是播放器拚命填起播緩衝的時候，兩邊搶同一條對外頻寬。在真實瀏覽器實測：同一個 Akamai 鏡像，頁面載入時測出 **5.8 Mbps**，把影片暫停、緩衝滿了之後再測是 **195 到 281 Mbps**，差了四十倍。也就是說它既量不準，又剛好在最需要頻寬的那幾秒把頻寬搶走。現在改成等 `video` 元素的緩衝領先播放位置 10 秒以上才測，等不到就以 45 秒為上限。判斷依據用緩衝領先量而不是固定等一段時間，是因為 4K 和 360P 填滿緩衝所需的時間差了好幾個數量級。

晚點測不影響效果：勝出者本來就會跨頁面保存，這一輪測出的結果是給下一部影片用的。

#### 3.1 修了什麼

3.0 發布前又做了一輪對抗性複查，結果它自己犯了兩個跟 2.x 同類型的錯，還帶出幾個新的。

**剛修好的音訊覆蓋問題，在 `applyWinner()` 裡原封不動又犯了一次。** 它逐一處理所有改寫過的串流、讓最後一個說了算，而最後一個是音訊。於是右下角提示又變成回報音訊的 host。現在只認影片串流。

**它在改不動的時候宣稱自己改了。** `fetch` 和 XHR 兩條路在 `processData` 回傳後，會立刻把物件序列化成字串交給播放器，之後再改那個物件，播放器一個字都看不到，但程式照樣印出「已把播放網址改寫為」。這正是 2.x 那個「只回報意圖、不回報結果」的毛病換個地方重演。現在依「這份資料播放器還會不會再讀」分開處理，改不動就明說改不動。

**重複使用同一個 XHR 物件時，無關 API 的回應被改了值。** `open()` 到別的網址時，實例上的 getter 不會被拿掉，於是那個回應也被 `JSON.parse` + `JSON.stringify` 轉了一圈，而 B站的 aid、mid 超出 double 精度，轉一圈就變了：測試裡 `9007199254740993` 變成 `...992`。現在每次 `open()` 都會先拿掉。

**一段很短的影片來源，會讓所有健康的鏡像被列入黑名單。** 探針把「測不出來」和「硬失敗」都回傳 -1。現在分成三種狀態，只有硬失敗才列入黑名單。

**所有鏡像都失敗時會無限重測。** `pickBest` 在所有鏡像都被列入黑名單時會清空黑名單，清完下一個 playurl 回應又重測一輪，每個回應來一次。加了 `TEST_COOLDOWN`。

**快取裡存著別處的勝出者，會把測速壓住 10 分鐘。** 之前只看快取新不新，不看那個 host 這部影片到底有沒有提供。

還有兩個小地方：壞掉或缺欄位的快取會讓提示顯示 `NaN Mbps`，現在檢查後丟棄；其他腳本若把 `XMLHttpRequest` 換成子類別，原型描述子會是 `undefined`，之後每次讀屬性都會拋出例外、讓播放整個掛掉，現在拿不到就整個不攔截 XHR。

#### 3.0 修了什麼

2.x 在實測中被發現「提示說選了最佳來源，但播放器拿到的一直是備援來源」。根本原因有四個：

**測速結果從來沒被用上。** 選來源是同步完成的，測速是之後才非同步執行的，拿到結果後只寫進一個變數，沒有任何一行回頭改網址。更糟的是那個變數會隨頁面一起消失，所以每打開一個影片頁它都是空的，選來源永遠落到備援。現在勝出者存進 `localStorage` 跨頁面重複使用，而且測速一出結果就把目前這批網址再改寫一次。

**探針量的是延遲而不是頻寬。** 只下載 256KB，整個落在交握和 TCP 慢啟動裡。實測兩個來源分別讀到 3.1 和 16.4 Mbps，同一個來源換一輪又變成 5.5 和 36.3，十倍等級的雜訊，分不出高下。改成丟掉暖身段、只統計穩定段之後，同樣兩個來源讀到 148 和 266 Mbps，跟持續下載量到的數量級一致。

**正常播放會誤封好節點。** 舊的判斷依據是「15 秒內又來了一次 playurl，就代表上一個 CDN 播不動」，但內嵌的 `__playinfo__` 之後播放器本來就會再要一次，切換畫質、分P、站內換頁也都在這個時間窗口內。這條依據整個刪掉，只保留有證據的那種失敗。

**右下角提示回報的是音訊串流。** `dash.video` 之後還要處理 `audio`、`dolby`、`flac`，每個都覆蓋一次紀錄，所以提示和記錄回報的是最後那條音訊串流的 host。

另外，同一份 XHR 回應被讀第二次時會把整套邏輯重跑一遍，現在依原始字串只記一次結果；`fetch` 攔截重建回應時會帶著對不上的 `content-length`，現在刪掉了。

---

## Bilibili CDN 台灣優化（jiyunshi）

`bilibili-cdn-tw/` 收錄 jiyunshi 發布在 Greasy Fork 上的 [Bilibili CDN 台灣優化](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)，並打包成可以直接載入的 Chrome 擴充功能：

- `bilibili-cdn-tw.user.js`：原始腳本，一字未改
- `chrome-extension-tw/`：擴充功能本體，在開發人員模式下「載入未封裝項目」選這個資料夾
- `chrome-extension-tw.zip`：同一份擴充功能加上說明，可以單獨下載

它沒有彈出提示，狀態在播放器齒輪選單裡的「攔截修改影片 CDN」，或在 Console 輸入 `BiliCDN.diag()` 查看。安裝方式、跟 Tampermonkey 版的差別，以及擴充功能頁「錯誤」清單裡常見訊息的說明，見 [bilibili-cdn-tw/README.md](./bilibili-cdn-tw/README.md)。

---

## 開發

### 複製這個 repo

```bash
git clone https://github.com/A90ur5/bilibili-cdn-optimizer.git
cd bilibili-cdn-optimizer
```

`.githooks/` 是上游留下的提交前檢查，會從 `git config fleet.guards` 和 `git config fleet.style` 指向的本機 fleet-guards、fleet-style checkout 執行個資掃描、資料邊界和破折號檢查。這些工具不在本 repo 裡，**兩項設定只要有一項沒設，提交就會被擋下**（這是刻意的 fail-closed 設計）。所以手邊沒有這兩套工具的話，不要執行 `git config core.hooksPath .githooks`，否則每次提交都會失敗。只想使用腳本或擴充功能的話，完全不需要它們。

### 檢查

```bash
node tools/selftest.js                     # 「B站CDN優選」腳本的行為測試
node tools/check-extension.js              # chrome-extension/ 的複本與 manifest 沒有走樣
node tools/build-extension-tw.js --check   # bilibili-cdn-tw/ 的擴充功能與 zip 跟原始腳本一致
```

`selftest.js` 把真實的腳本檔載入一個模擬瀏覽器（假的 fetch、XHR、localStorage、時鐘），驗證的是行為而不是結構。80 項斷言中，有 53 項在 2.1 上會失敗、23 項在 3.2 上會失敗、3 項在 3.3 上會失敗，所以這道關卡不會對壞掉的版本亮綠燈。後兩項分別保護兩個擴充功能，細節見上面各自的說明。CI 在每次 push 和 PR 都會跑這三項。

修改 `bilibili-cdn-tw/bilibili-cdn-tw.user.js` 之後，執行 `node tools/build-extension-tw.js` 重新產生擴充功能和 zip。

## 授權

本 repo 依 [MIT](./LICENSE) 授權（LICENSE 檔的著作權人為 SanJerry007）。`bilibili-cdn-tw/` 裡的「Bilibili CDN 台灣優化」腳本及由它產生的檔案，著作權屬於 jiyunshi，依該腳本標頭宣告的 MIT 授權收錄。

---

## English

This repository is a fork of [SanJerry007/bilibili-cdn-optimizer](https://github.com/SanJerry007/bilibili-cdn-optimizer). It holds two independent tools that keep Bilibili videos from buffering outside mainland China. Both rewrite playback URLs, so **enable only one at a time**.

| Path | What | Source |
|---|---|---|
| `bilibili-cdn-optimizer.user.js`, `chrome-extension/` | "B站CDN优选" v3.3.1: measures the mirrors Bilibili returns and promotes the fastest | SanJerry007, unmodified; the extension is this fork's packaging |
| `bilibili-cdn-tw/` | "Bilibili CDN 台灣優化" v1.3.4: tuned for Taiwan, prefers Akamai when Bilibili offers it and otherwise rewrites to a built-in list of Bilibili mirrors; blocks WebRTC (P2P/PCDN) | jiyunshi on [Greasy Fork](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96), packaged by this fork. See [bilibili-cdn-tw/README.md](./bilibili-cdn-tw/README.md) |

The rest of this section covers "B站CDN优选".

### The problem

Watching Bilibili from overseas, everything loads fast **except the video itself**, which buffers endlessly. The bottleneck isn't your bandwidth; it's Bilibili's **CDN routing**.

For each playback, Bilibili hands your player one CDN mirror out of several. For overseas IPs the choice is effectively **random**, and you may land on:

- 🟢 a **nearby overseas edge** (e.g. Akamai, globally distributed, auto-routed) → hundreds of Mbps
- 🟡 a farther overseas relay → mediocre
- 🔴 a **mainland-China node** (data crosses the Pacific, sometimes via Europe) → 200ms+ latency, constant buffering

The key fact: **the fast nearby mirror is already in the list Bilibili returns**; it just isn't picked first.

### What this script does

It reads the mirror list from both the inline `window.__playinfo__` in the page HTML and the `playurl` API response, then **measures each mirror's sustained throughput and promotes the fastest one** to the top of the list, so the player uses it.

The measurement discards the first 256KB or 500ms of each transfer, because that window is handshake plus TCP slow start and reflects round-trip time rather than bandwidth. The window that follows is whichever comes first, 1.2 seconds or 4MB, and on fast links it is always the byte cap: above roughly 26 Mbps the window length is set by MAX_BYTES, so at 200 Mbps it is about 150ms. That is a deliberate trade, since honouring 1.2 seconds at those rates would mean downloading tens of megabytes per mirror. Mirrors are probed one at a time, since concurrent probes share the same uplink and would each measure only a fraction of it.

The probe does not start at document-start. It waits until the `video` element has buffered at least 10 seconds ahead, because a probe running while the player fills its first buffer competes for the same uplink: measured in a real browser, the same Akamai mirror read 5.8 Mbps during page load and 195 to 281 Mbps once the video was paused and buffered.

The winner is **persisted across page loads** for 10 minutes, so the next video you open uses it from the very first frame instead of waiting for a fresh measurement.

- ✅ No spoofing; only reorders the *legitimate* mirrors Bilibili already gave you
- ✅ No VPN required
- ✅ Zero-config out of the box
- ✅ Coexists with Bilibili-Evolved and other userscripts

### Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/)
2. **[Click to install the script](https://raw.githubusercontent.com/SanJerry007/bilibili-cdn-optimizer/main/bilibili-cdn-optimizer.user.js)**; Tampermonkey opens an install page; click *Install*.
3. Open any Bilibili video; a toast in the bottom-right confirms it works. The toast always names the host the player is **actually** using, so a green `🏆 实测最快CDN: host (123.4 Mbps)` means that host was measured and selected, while a blue `⚠️ 用兜底CDN: host` means no measurement exists yet and the fallback is in use.

The install link and the script's `@updateURL` both point at the upstream SanJerry007 repository, so Tampermonkey will auto-update from upstream. Use the Chrome extension below if you do not want that.

### Without Tampermonkey: load it as a Chrome extension

The script runs with `@grant none` and uses no Tampermonkey API, so `chrome-extension/` loads as an unpacked extension in Chrome or Edge 111+:

1. Download this repo (`git clone`, or Code → Download ZIP and unzip)
2. Open `chrome://extensions` (`edge://extensions` in Edge) and turn on *Developer mode*
3. Click *Load unpacked* and pick the `chrome-extension` folder

Differences from the userscript: it never auto-updates (it runs exactly the code on your disk), it does not run on the login, account and payment subdomains (`passport`, `account`, `pay`, `member`), and it matches `https://` only. The script in `chrome-extension/` is a byte-identical copy of the root one; `node tools/check-extension.js` fails if the copy drifts, if the versions differ, or if `"world": "MAIN"` or `"run_at": "document_start"` is lost, since either one turns every hook into a silent no-op.

### Customize

Edit the `CFG` block at the top of the script. The two you are most likely to touch:

```js
MODE: 'auto',                 // 'auto' = measure and pick | 'prefer' = fixed order, no measuring
PREFER: ['akamaized.net'],    // ordered fallback used until a measurement exists
```

### Run the checks

```bash
node tools/selftest.js                     # behaviour tests for the "B站CDN优选" script
node tools/check-extension.js              # chrome-extension/ copy and manifest
node tools/build-extension-tw.js --check   # bilibili-cdn-tw/ extension and zip match the original script
```

`selftest.js` loads the real userscript into a stubbed browser and asserts behaviour. Of the 80 assertions, 53 fail on 2.1, 23 on 3.2 and 3 on 3.3, which is what makes the gate meaningful. CI runs all three on every push and pull request.

`.githooks/` comes from upstream and needs the upstream author's local fleet-guards and fleet-style tools; without them, do not set `core.hooksPath`, or every commit will be blocked.

### License

[MIT](./LICENSE) (copyright SanJerry007 in the LICENSE file). The "Bilibili CDN 台灣優化" script in `bilibili-cdn-tw/` and the files generated from it are jiyunshi's work, included under the MIT license declared in its header.
