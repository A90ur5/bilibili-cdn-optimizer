// Stages a GitHub release: copies both committed extension zips into dist/ under versioned names and
// writes dist/title.txt and dist/notes.md. .github/workflows/release.yml runs it and uploads the result.
//
//   node tools/release.js <tag>
//
// It only packages what is committed. The workflow runs both build scripts with --check first, so a zip
// that no longer matches its source fails the release instead of shipping.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const tag = process.argv[2];
if (!tag) { console.error('usage: node tools/release.js <tag>'); process.exit(1); }
// links point at the tag, so the notes keep describing exactly what was released
const repo = process.env.GITHUB_REPOSITORY || 'A90ur5/bilibili-cdn-optimizer';
const blob = 'https://github.com/' + repo + '/blob/' + tag;

const VERSIONS = [
  {
    dir: 'bilibili-cdn-optimizer', ext: 'chrome-extension', zip: 'chrome-extension.zip',
    name: 'B站CDN優選', author: 'SanJerry007',
    blurb: '只在 B站回傳的鏡像之間實測，挑最快的；右下角顯示目前使用的 CDN',
  },
  {
    dir: 'bilibili-cdn-tw', ext: 'chrome-extension-tw', zip: 'chrome-extension-tw.zip',
    name: '台灣優化', author: 'jiyunshi',
    blurb: '針對台灣線路，預設避開台灣連不到的節點並停用 WebRTC；狀態在播放器齒輪選單',
  },
];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);
for (const v of VERSIONS) {
  v.version = JSON.parse(fs.readFileSync(path.join(ROOT, v.dir, v.ext, 'manifest.json'), 'utf8')).version;
  v.asset = v.dir + '-v' + v.version + '-chrome-extension.zip';
  const data = fs.readFileSync(path.join(ROOT, v.dir, v.zip));
  fs.writeFileSync(path.join(DIST, v.asset), data);
  v.sha256 = crypto.createHash('sha256').update(data).digest('hex');
}

const [a, b] = VERSIONS;
const title = tag + '：' + a.name + ' v' + a.version + ' + ' + b.name + ' v' + b.version;
const notes = `兩個版本的 Chrome 擴充功能，可以不裝 Tampermonkey，直接以開發人員模式載入。

## 下載

| 檔案 | 版本 | 做法 |
|---|---|---|
${VERSIONS.map(v => `| \`${v.asset}\` | ${v.name} v${v.version}（${v.author}） | ${v.blurb} |`).join('\n')}

兩者都會改寫播放網址，**一次只啟用一個**。該選哪一個，見 [README](${blob}/README.md#該用哪一個)。

## 安裝

1. 下載上面其中一個 zip，解壓縮
2. 打開 \`chrome://extensions\`（Edge 是 \`edge://extensions\`），開啟「開發人員模式」
3. 點「載入未封裝項目」，選解壓縮出來的 \`${a.ext}\`（或 \`${b.ext}\`）資料夾

需要 Chrome 或 Edge 111 以上。擴充功能不會自動更新，有新版時請回到 Releases 下載。

## 安全審查

兩個版本都做過安全審查，沒有發現惡意行為：${VERSIONS.map(v => `[${v.name}](${blob}/${v.dir}/SECURITY-AUDIT.md)`).join('、')}。

## 檔案雜湊（SHA-256）

\`\`\`
${VERSIONS.map(v => v.sha256 + '  ' + v.asset).join('\n')}
\`\`\`

zip 由 repo 裡的建置腳本產生；建立這個 release 前，CI 已確認兩個 zip 跟原始碼一致。
`;
fs.writeFileSync(path.join(DIST, 'title.txt'), title);
fs.writeFileSync(path.join(DIST, 'notes.md'), notes);
console.log('staged ' + VERSIONS.map(v => 'dist/' + v.asset).join(', ') + ', dist/title.txt, dist/notes.md');
