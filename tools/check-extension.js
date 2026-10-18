// Gate for chrome-extension/: it ships a COPY of the userscript, and a copy can drift.
// Each check below guards something that, if lost, breaks the extension without any error:
// a stale copy runs old code, and the wrong world or run_at makes every hook a silent no-op.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'bilibili-cdn-optimizer.user.js');
const EXT = path.join(ROOT, 'chrome-extension');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  <- ' + detail : '')); }
}

const src = fs.readFileSync(SRC, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const cs = (manifest.content_scripts || [])[0] || {};
const js = (cs.js || [])[0] || '';
const copy = js && fs.existsSync(path.join(EXT, js)) ? fs.readFileSync(path.join(EXT, js), 'utf8') : null;
const userVersion = (src.match(/^\/\/ @version\s+(\S+)/m) || [])[1];

ok('manifest names exactly one content script file', (cs.js || []).length === 1, JSON.stringify(cs.js));
ok('extension copy is byte-identical to the userscript', copy === src,
  copy === null ? 'missing chrome-extension/' + js : 'run: cp bilibili-cdn-optimizer.user.js chrome-extension/');
ok('manifest version matches @version', manifest.version === userVersion, manifest.version + ' vs ' + userVersion);
// ISOLATED (the default) has its own window: hooking fetch/XHR/__playinfo__ there changes nothing the page sees
ok('runs in the MAIN world', cs.world === 'MAIN', String(cs.world));
// any later and B站's inline __playinfo__ has already been assigned before the setter exists
ok('runs at document_start', cs.run_at === 'document_start', String(cs.run_at));
// the userscript sets @noframes false on purpose: the embedded player path depends on it
ok('runs in all frames', cs.all_frames === true, String(cs.all_frames));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
