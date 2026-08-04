/**
 * build-html.cjs — converts the TypeScript/Vite sources into a dependency-free
 * plain-HTML build in ./html:
 *
 *   html/index.html        classic <script> tags, no bundler, no modules
 *   html/js/game.js        every src/*.ts concatenated + type-stripped
 *   html/lib/*.js          vendored Phaser / Howler / WebFontLoader UMD builds
 *   html/{sprites,sfx,fonts}
 *
 * Also emits html/stone-tycoon-offline.html — a true single-file build with
 * every script, style, image, font and sound inlined as data URIs so it runs
 * from file:// with zero network access.
 *
 * Run:  node tools/build-html.cjs
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'html');

/** Concatenation order — dependencies first (this is a flat single scope). */
const ORDER = [
  'src/assets.ts',
  'src/format.ts',
  'src/data.ts',
  'src/save.ts',
  'src/audio.ts',
  'src/ui.ts',
  'src/scenes/Game.ts',
  'src/scenes/Panel.ts',
  'src/scenes/Boot.ts',
  'src/scenes/Title.ts',
  'src/scenes/AdScene.ts',
  'src/scenes/MinersPanel.ts',
  'src/scenes/UpgradePanel.ts',
  'src/scenes/RewardsPanel.ts',
  'src/scenes/CashPanel.ts',
  'src/scenes/SettingsPanel.ts',
  'src/main.ts',
];

// Fail loudly if a source file was added to src/ but never listed in ORDER —
// a silently missing file produces a "X is not defined" crash at runtime.
(function verifyOrder() {
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = d + '/' + e.name;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.ts')) found.push(rel);
    }
  };
  walk('src');
  const missing = found.filter((f) => !ORDER.includes(f));
  if (missing.length) {
    console.error('ERROR: these sources are not in ORDER:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
  const ghosts = ORDER.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (ghosts.length) {
    console.error('ERROR: ORDER lists missing files:\n  ' + ghosts.join('\n  '));
    process.exit(1);
  }
  console.log('order check: ' + found.length + ' sources, all listed');
})();

/** Strip ES module syntax so everything can share one function scope. */
function demodule(src) {
  return (
    src
      // multi-line and single-line imports
      .replace(/^\s*import\s+[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
      // `export default X;` and bare re-exports
      .replace(/^\s*export\s+default\s+/gm, 'var __default = ')
      .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '')
      // `export const/class/function/interface/type/abstract class`
      .replace(/^(\s*)export\s+(?=(const|let|var|function|class|abstract|interface|type|enum)\b)/gm, '$1')
  );
}

function transpile(src, fileName) {
  return ts.transpileModule(src, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      removeComments: false,
      useDefineForClassFields: true,
    },
  }).outputText;
}

// ── 0. stage assets + vendored libs ──────────────────────────────────────────
// Runs first so the build works from a clean tree (html/ may not exist yet).
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

fs.mkdirSync(OUT, { recursive: true });

for (const dir of ['sprites', 'sfx', 'fonts']) {
  const from = path.join(ROOT, 'public', dir);
  if (!fs.existsSync(from)) {
    console.error(`ERROR: public/${dir} is missing`);
    process.exit(1);
  }
  copyDir(from, path.join(OUT, dir));
}
for (const f of ['thumbnail.png', 'favicon.svg']) {
  fs.copyFileSync(path.join(ROOT, 'public', f), path.join(OUT, f));
}

const LIBS = [
  ['node_modules/phaser/dist/phaser.min.js', 'phaser.min.js'],
  ['node_modules/howler/dist/howler.min.js', 'howler.min.js'],
  ['node_modules/webfontloader/webfontloader.js', 'webfontloader.js'],
];
fs.mkdirSync(path.join(OUT, 'lib'), { recursive: true });
for (const [src, name] of LIBS) {
  const from = path.join(ROOT, src);
  if (!fs.existsSync(from)) {
    console.error(`ERROR: vendored lib missing: ${src} (run npm install)`);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(OUT, 'lib', name));
}
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
for (const f of ['firebase-config.js', 'firebase-bridge.js']) {
  fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(OUT, 'js', f));
}
fs.copyFileSync(path.join(ROOT, 'tools', 'admin.html'), path.join(OUT, 'admin.html'));
fs.copyFileSync(path.join(ROOT, 'tools', 'admin.html'), path.join(OUT, 'admin-single.html'));
console.log('staged assets + 3 vendored libs + Firebase admin files');

// ── 1. build js/game.js ───────────────────────────────────────────────────────
const parts = [];
for (const rel of ORDER) {
  const abs = path.join(ROOT, rel);
  const raw = fs.readFileSync(abs, 'utf8');
  const js = transpile(demodule(raw), rel);
  parts.push(`/* ==== ${rel} ${'='.repeat(Math.max(0, 60 - rel.length))} */\n${js.trim()}\n`);
}

const banner = `/*!
 * STONE TYCOON — Idle Mining Empire
 * Plain-HTML build. No bundler, no modules, no build step required.
 * Requires: lib/phaser.min.js, lib/howler.min.js, lib/webfontloader.js
 */`;

const gameJs = `${banner}
(function () {
'use strict';
var Phaser = window.Phaser;
var Howl = window.Howl, Howler = window.Howler;
var WebFont = window.WebFont;

${parts.join('\n')}
})();
`;

fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'js', 'game.js'), gameJs);
console.log('js/game.js       ', (gameJs.length / 1024).toFixed(0) + ' KB');

// ── 2. css ────────────────────────────────────────────────────────────────────
const css = fs
  .readFileSync(path.join(ROOT, 'src/style.css'), 'utf8')
  .replace(/url\('\/fonts\//g, "url('fonts/");
fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'css', 'style.css'), css);

// ── 3. index.html ─────────────────────────────────────────────────────────────
const head = `  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#05070d" />
  <meta name="description" content="Stone Tycoon — tap the rock, hire miners, watch ads to unlock legendary characters, and cash out your earnings." />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Stone Tycoon — Idle Mining Empire" />
  <meta property="og:description" content="Tap the rock. Hire 6 miners. Unlock characters with ads. Cash out your balance." />
  <meta property="og:image" content="thumbnail.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="thumbnail.png" />
  <title>Stone Tycoon — Idle Mining Empire</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />`;

const body = `  <div id="game"></div>
  <div id="boot-splash">
    <div class="ring"></div>
    <div>STONE TYCOON</div>
  </div>`;

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${head}
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
${body}

  <script src="lib/phaser.min.js"><\/script>
  <script src="lib/howler.min.js"><\/script>
  <script src="lib/webfontloader.js"><\/script>
  <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js"><\/script>
  <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js"><\/script>
  <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore-compat.js"><\/script>
  <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-analytics-compat.js"><\/script>
  <script src="js/firebase-config.js"><\/script>
  <script src="js/firebase-bridge.js"><\/script>
  <script src="js/game.js"><\/script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);
console.log('index.html       ', (indexHtml.length / 1024).toFixed(1) + ' KB');

// ── 3b. README for the downloadable folder ───────────────────────────────────
fs.copyFileSync(path.join(ROOT, 'tools/readme.md.txt'), path.join(OUT, 'README.md'));

// ── 4. single-file offline build ──────────────────────────────────────────────
const MIME = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
};

function dataUri(abs) {
  const ext = path.extname(abs).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
}

/** Map of runtime asset path -> data URI, injected as window.ST_ASSETS. */
const assetMap = {};
for (const dir of ['sprites', 'sfx']) {
  for (const f of fs.readdirSync(path.join(OUT, dir))) {
    assetMap['/' + dir + '/' + f] = dataUri(path.join(OUT, dir, f));
  }
}

// fonts get inlined straight into @font-face
let offlineCss = css;
for (const f of fs.readdirSync(path.join(OUT, 'fonts'))) {
  if (!f.endsWith('.ttf')) continue;
  offlineCss = offlineCss.replace(
    new RegExp(`url\\('fonts/${f}'\\)`, 'g'),
    `url('${dataUri(path.join(OUT, 'fonts', f))}')`
  );
}

const read = (p) => fs.readFileSync(path.join(OUT, p), 'utf8');

const offlineHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${head.replace(/\n.*(og:image|twitter:image|rel="icon").*/g, '')}
  <style>
${offlineCss}
  </style>
</head>
<body>
${body}

<script>window.ST_ASSETS = ${JSON.stringify(assetMap)};<\/script>
<script>${read('lib/phaser.min.js')}<\/script>
<script>${read('lib/howler.min.js')}<\/script>
<script>${read('lib/webfontloader.js')}<\/script>
<script>${read('js/game.js')}<\/script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'stone-tycoon-offline.html'), offlineHtml);
console.log('offline single-file', (offlineHtml.length / 1024 / 1024).toFixed(2) + ' MB');
console.log('\nDone. Open html/index.html (server) or html/stone-tycoon-offline.html (file://).');
