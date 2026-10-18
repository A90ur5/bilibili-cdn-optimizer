// Builds and checks chrome-extension/ and chrome-extension.zip in this folder.
//
//   node bilibili-cdn-optimizer/tools/build-extension.js           copy the userscript into chrome-extension/ and rewrite the zip
//   node bilibili-cdn-optimizer/tools/build-extension.js --check   fail if anything below does not hold
//
// chrome-extension/ ships a COPY of the userscript, and a copy can drift. Each check guards something that,
// if lost, breaks the extension without any error: a stale copy runs old code, and the wrong world or run_at
// makes every hook a silent no-op. manifest.json is hand-written (it differs from the userscript header on
// purpose: https only, and no login/payment subdomains), so it is checked, not generated.
const fs = require('fs');
const path = require('path');
const { zip } = require('../../tools/zip');

const DIR = path.join(__dirname, '..');
const SRC = path.join(DIR, 'bilibili-cdn-optimizer.user.js');
const EXT = path.join(DIR, 'chrome-extension');
const ZIP = path.join(DIR, 'chrome-extension.zip');

const src = fs.readFileSync(SRC, 'utf8');
const manifestText = fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText);
const cs = (manifest.content_scripts || [])[0] || {};
const js = (cs.js || [])[0] || '';
// the zip carries the README too, for anyone who downloads only the zip
const buildZip = () => zip([
  ['chrome-extension/manifest.json', manifestText],
  ['chrome-extension/' + js, src],
  ['README.md', fs.readFileSync(path.join(DIR, 'README.md'), 'utf8')],
]);

if (!process.argv.includes('--check')) {
  if (!js) { console.error('build-extension: manifest.json names no content script'); process.exit(1); }
  fs.writeFileSync(path.join(EXT, js), src);
  fs.writeFileSync(ZIP, buildZip());
  console.log('wrote bilibili-cdn-optimizer/chrome-extension/' + js + ' and bilibili-cdn-optimizer/chrome-extension.zip');
  process.exit(0);
}

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  <- ' + detail : '')); }
}

const copy = js && fs.existsSync(path.join(EXT, js)) ? fs.readFileSync(path.join(EXT, js), 'utf8') : null;
const userVersion = (src.match(/^\/\/ @version\s+(\S+)/m) || [])[1];
const zipOnDisk = fs.existsSync(ZIP) ? fs.readFileSync(ZIP) : null;

ok('manifest names exactly one content script file', (cs.js || []).length === 1, JSON.stringify(cs.js));
ok('extension copy is byte-identical to the userscript', copy === src,
  copy === null ? 'missing chrome-extension/' + js : 'run: node bilibili-cdn-optimizer/tools/build-extension.js');
ok('manifest version matches @version', manifest.version === userVersion, manifest.version + ' vs ' + userVersion);
// ISOLATED (the default) has its own window: hooking fetch/XHR/__playinfo__ there changes nothing the page sees
ok('runs in the MAIN world', cs.world === 'MAIN', String(cs.world));
// any later and B站's inline __playinfo__ has already been assigned before the setter exists
ok('runs at document_start', cs.run_at === 'document_start', String(cs.run_at));
// the userscript sets @noframes false on purpose: the embedded player path depends on it
ok('runs in all frames', cs.all_frames === true, String(cs.all_frames));
ok('chrome-extension.zip is up to date', !!zipOnDisk && zipOnDisk.equals(buildZip()),
  (zipOnDisk ? 'stale' : 'missing') + '; run: node bilibili-cdn-optimizer/tools/build-extension.js');

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
