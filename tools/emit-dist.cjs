/**
 * emit-dist.cjs — publishes the plain-HTML build as the deployable site.
 *
 * dist/ becomes an exact copy of html/, so the thing that ships is the same
 * dependency-free HTML + JS the user can download and open locally. No module
 * bundle, no hashed asset names, no build step needed to run it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'html');
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(SRC)) {
  console.error('ERROR: html/ not found — run tools/build-html.cjs first');
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

let files = 0;
let bytes = 0;

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(a, b);
    } else {
      fs.copyFileSync(a, b);
      files++;
      bytes += fs.statSync(b).size;
    }
  }
}

copyDir(SRC, DIST);

// A tiny download hub so the plain-HTML files are grabbable from the live site.
// ── download hub ─────────────────────────────────────────────────────────────
// Lets anyone grab the dependency-free HTML build straight from the live site.
const offlineKB = Math.round(fs.statSync(path.join(DIST, 'stone-tycoon-offline.html')).size / 1024);
const gameKB = Math.round(fs.statSync(path.join(DIST, 'js', 'game.js')).size / 1024);
const folderMB = (bytes / 1024 / 1024).toFixed(1);

const dl = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Stone Tycoon — HTML Download</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg" />
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
    background:#05070d;
    background-image:
      radial-gradient(circle at 15% 5%,#1c2745 0%,transparent 50%),
      radial-gradient(circle at 85% 95%,#2b1436 0%,transparent 50%);
    color:#e8eefc;min-height:100vh;padding:36px 18px 80px;line-height:1.6;
  }
  .wrap{max-width:820px;margin:0 auto}
  .logo{font-size:13px;letter-spacing:5px;color:#ffc23d;text-align:center;margin-bottom:8px}
  h1{font-size:clamp(30px,7vw,46px);text-align:center;letter-spacing:1px;
     background:linear-gradient(180deg,#fff 30%,#ffc23d);-webkit-background-clip:text;
     background-clip:text;color:transparent;margin-bottom:10px}
  .sub{text-align:center;color:#8ea1c2;font-size:16px;margin-bottom:34px}
  .card{background:#111a2b;border:1px solid #2b3a5a;border-radius:20px;
        padding:26px;margin-bottom:20px}
  .card.hero{border-color:#2fd074;background:linear-gradient(160deg,#0f2a20,#111a2b 60%)}
  .badge{display:inline-block;font-size:11px;letter-spacing:2px;padding:5px 12px;
         border-radius:999px;margin-bottom:12px;font-weight:700}
  .badge.green{background:#2fd074;color:#04150c}
  .badge.blue{background:#3d8bff;color:#04122b}
  h2{font-size:23px;margin-bottom:6px}
  .meta{color:#7f92b5;font-size:14px;margin-bottom:16px}
  .btn{display:block;text-align:center;text-decoration:none;font-weight:700;
       padding:17px;border-radius:14px;font-size:17px;letter-spacing:.5px;
       transition:transform .12s ease,filter .12s ease}
  .btn:active{transform:translateY(2px)}
  .btn:hover{filter:brightness(1.1)}
  .btn.green{background:linear-gradient(180deg,#3ee089,#1b9c58);color:#04150c;
             box-shadow:0 5px 0 #12613a}
  .btn.blue{background:linear-gradient(180deg,#5ba0ff,#2264d6);color:#fff;
            box-shadow:0 5px 0 #16408c}
  ol,ul{margin:12px 0 0 20px}
  li{margin-bottom:7px;color:#c2d0e8}
  code{background:#0a0f1c;border:1px solid #26334d;padding:2px 8px;
       border-radius:6px;font-size:13.5px;color:#ffd76a;
       font-family:ui-monospace,'Cascadia Code',Menlo,monospace}
  pre{background:#0a0f1c;border:1px solid #26334d;border-radius:12px;
      padding:16px;overflow-x:auto;margin-top:12px;font-size:13.5px;
      color:#a9d8ff;font-family:ui-monospace,'Cascadia Code',Menlo,monospace;line-height:1.75}
  .tree{color:#8ea1c2;font-size:14px;line-height:2;
        font-family:ui-monospace,'Cascadia Code',Menlo,monospace}
  .tree b{color:#ffd76a}
  .note{background:#2a1c08;border:1px solid #6b4c12;border-radius:12px;
        padding:14px 16px;color:#ffd9a0;font-size:14px;margin-top:18px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
  @media(max-width:620px){.grid{grid-template-columns:1fr}}
  .stat{background:#0d1524;border:1px solid #24314c;border-radius:12px;padding:14px}
  .stat b{display:block;color:#fff;font-size:20px}
  .stat span{color:#7f92b5;font-size:13px}
  .back{display:block;text-align:center;margin-top:26px;color:#8ea1c2;font-size:15px}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">⛏ STONE TYCOON</div>
  <h1>HTML Download</h1>
  <p class="sub">Pure HTML + JavaScript · no npm, no build step, no bundler</p>

  <div class="card hero">
    <span class="badge green">SABSE AASAN</span>
    <h2>Single File — bas double-click</h2>
    <p class="meta">stone-tycoon-offline.html · ${offlineKB} KB · sab kuch andar</p>
    <a class="btn green" href="stone-tycoon-offline.html" download>⬇ DOWNLOAD SINGLE FILE</a>
    <ul>
      <li>Phaser, Howler, 19 sprites, 6 sounds, 2 fonts — sab is ek file me inline</li>
      <li>Internet ki zaroorat <b>nahi</b> · server ki zaroorat <b>nahi</b></li>
      <li>WhatsApp / email / pendrive se bhejo — kahin bhi chalega</li>
      <li>Double-click karo, game khul jayega</li>
    </ul>
  </div>

  <div class="card">
    <span class="badge blue">EDIT KARNE KE LIYE</span>
    <h2>Normal HTML Folder</h2>
    <p class="meta">${files} files · ${folderMB} MB · classic structure</p>
    <a class="btn blue" href="index.html">▶ OPEN THE GAME</a>
    <p style="margin-top:16px;color:#8ea1c2;font-size:14px">
      Ye poori site hi wahi plain-HTML build hai. Right-click → "Save page as"
      se ya niche wali files direct download karke folder bana lo:
    </p>
    <div class="tree" style="margin-top:12px">
      <b>index.html</b> &nbsp;— 4 simple &lt;script&gt; tags, koi module nahi<br>
      <b>js/game.js</b> &nbsp;— ${gameKB} KB plain JavaScript (edit kar sakte ho)<br>
      <b>css/style.css</b><br>
      <b>lib/</b> &nbsp;— phaser.min.js · howler.min.js · webfontloader.js<br>
      <b>sprites/</b> — 19 PNG &nbsp;·&nbsp; <b>sfx/</b> — 6 sounds &nbsp;·&nbsp; <b>fonts/</b> — 2 TTF
    </div>
  </div>

  <div class="card">
    <span class="badge blue">ADMIN PANEL</span>
    <h2>Firebase Admin Control</h2>
    <p style="color:#8ea1c2;font-size:15px">
      Users ka full data dekhna, coins/gems/cash/level edit karna, withdrawals approve/reject,
      aur reward/economy multipliers live control karna.
    </p>
    <a class="btn blue" href="admin.html">OPEN ADMIN PANEL</a>
    <a class="btn green" style="margin-top:12px" href="admin-single.html" download>⬇ DOWNLOAD ADMIN SINGLE HTML</a>
    <p style="margin-top:14px;color:#8ea1c2;font-size:14px">
      Pehle <code>js/firebase-config.js</code> me Firebase config paste karo aur
      Firebase Authentication + Firestore enable karo.
    </p>
  </div>

  <div class="card">
    <h2>Game kaise edit karein</h2>
    <p style="color:#8ea1c2;font-size:15px">
      <code>js/game.js</code> kisi bhi editor (Notepad bhi chalega) me kholo.
      Upar ki taraf saari tuning values hain:
    </p>
<pre>const MINERS = [ … ]        // naam, DPS, cost, kitne ads chahiye
const TIERS  = [ … ]        // 6 rock types
function rockMaxHp(level)   // rock kitna mota hai
function coinReward(level)  // kitne coins milte hain
const AMOUNTS = [5,10,25,50,100]   // withdrawal options
const MIN_WITHDRAW = 5      // minimum cash out
const PAYOUTS = [ … ]       // PayPal / UPI / Bank / Crypto</pre>
    <p style="margin-top:14px;color:#c2d0e8">
      Number badlo → <b>save</b> → browser <b>refresh</b>. Bas itna hi workflow hai.
    </p>
  </div>

  <div class="card">
    <h2>Game me kya hai</h2>
    <div class="grid">
      <div class="stat"><b>6</b><span>Rock tiers — Granite se Obsidian tak</span></div>
      <div class="stat"><b>6</b><span>Miners — ads dekh kar unlock</span></div>
      <div class="stat"><b>4</b><span>Payout methods — PayPal/UPI/Bank/Crypto</span></div>
      <div class="stat"><b>∞</b><span>Levels — har 10th par BOSS rock</span></div>
    </div>
    <div class="note">
      💡 Withdrawal system <b>demo</b> hai — koi asli paisa involve nahi hai.
      Progress browser ke localStorage me save hoti hai.
    </div>
  </div>

  <a class="back" href="index.html">← Wapas game par jaao</a>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, 'download.html'), dl);
files++;

console.log(
  `dist/ published from html/ — ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`
);
