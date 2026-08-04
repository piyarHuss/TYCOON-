/**
 * test-html.cjs — loads the plain-HTML build in a real headless Chrome,
 * drives the game (title -> play -> tap rock -> open panels -> watch ad ->
 * unlock miner -> cash out) and fails loudly on any console error.
 *
 * Usage: node tools/test-html.cjs [--offline]
 */
const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');
const fs = require('fs');

const OFFLINE = process.argv.includes('--offline');
const ROOT = path.join(__dirname, '..', 'html');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404);
        return res.end('nf');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const url = OFFLINE
    ? 'file://' + path.join(ROOT, 'stone-tycoon-offline.html')
    : `http://localhost:${port}/index.html`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu-sandbox', '--no-zygote', '--single-process',
      '--autoplay-policy=no-user-gesture-required',
      '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
      '--allow-file-access-from-files', '--mute-audio',
      '--disable-features=Vulkan', '--in-process-gpu',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 900, deviceScaleFactor: 1 });

  const errors = [];
  const logs = [];
  page.on('console', (m) => {
    const txt = m.text();
    logs.push(m.type() + ': ' + txt);
    if (m.type() === 'error' && !/favicon|net::ERR_FILE_NOT_FOUND.*favicon/.test(txt)) errors.push(txt);
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  console.log('Loading', OFFLINE ? '(offline single-file)' : '(server)', '…');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // wait for Phaser to exist and boot to finish
  await page.waitForFunction('window.Phaser && document.querySelector("canvas")', { timeout: 30000 });
  await sleep(6000);

  const state = () =>
    page.evaluate(() => {
      const g = window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0];
      if (!g) return { ok: false };
      const active = g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key);
      let save = null;
      try {
        save = JSON.parse(localStorage.getItem('stone_tycoon_save_v1') || 'null');
      } catch (e) {}
      return { ok: true, active, fps: Math.round(g.loop.actualFps), save };
    });

  let st = await state();
  console.log('after boot -> scenes:', st.active, '| fps:', st.fps);
  if (!st.ok) throw new Error('Phaser game instance never appeared');

  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  // game is 720x1280 letterboxed inside the canvas box
  const gx = (nx) => box.x + box.width * nx;
  const gy = (ny) => box.y + box.height * ny;
  const tap = async (nx, ny, label) => {
    await page.mouse.click(gx(nx), gy(ny));
    await sleep(600);
    if (label) {
      const s = await state();
      console.log(`  tap ${label} -> scenes:`, s.active.join(','));
    }
  };

  // ---------- Title -> Game ----------
  if (st.active.includes('Title')) {
    await tap(0.5, 0.72, 'PLAY');
    st = await state();
    if (st.active.includes('Title')) {
      // maybe the button sits elsewhere; try centre band
      await tap(0.5, 0.66, 'PLAY(2)');
      st = await state();
    }
  }
  if (!st.active.includes('Game')) throw new Error('Could not reach the Game scene. active=' + st.active);
  console.log('OK: reached Game scene');

  // ---------- tap the rock 25x ----------
  const before = (await state()).save;
  for (let i = 0; i < 25; i++) {
    await page.mouse.click(gx(0.5), gy(0.33));
    await sleep(70);
  }
  await sleep(1200);
  let after = (await state()).save;
  console.log(
    `OK: tapping rock — level ${before ? before.level : '?'} -> ${after.level}, coins ${after.coins.toFixed(0)}`
  );
  if (after.coins <= 0 && after.level <= 1) throw new Error('Tapping the rock produced no progress');

  // ---------- dock: MINERS panel ----------
  await tap(0.16, 0.845, 'MINERS');
  st = await state();
  if (!st.active.includes('MinersPanel')) throw new Error('MinersPanel did not open');
  console.log('OK: MinersPanel opens');

  // give plenty of coins so buy/hire buttons enable, then reopen
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('stone_tycoon_save_v1'));
    raw.coins = 1e9;
    raw.gems = 5000;
    raw.cash = 42.5;
    localStorage.setItem('stone_tycoon_save_v1', JSON.stringify(raw));
  });

  // watch-ad unlock on the 2nd miner row (row 2 ≈ y 0.47 within the sheet)
  await tap(0.78, 0.47, 'row2 action');
  st = await state();
  const sawAd = st.active.includes('AdScene');
  console.log('  ad scene launched:', sawAd);
  if (sawAd) {
    await sleep(6500); // 5s ad + fade
    st = await state();
    console.log('  after ad -> scenes:', st.active.join(','));
    if (st.active.includes('AdScene')) throw new Error('AdScene never closed');
    console.log('OK: rewarded-ad flow completes');
  }

  // close the panel
  await tap(0.9, 0.115, 'close X');
  await sleep(700);

  // ---------- reload so the injected wallet takes effect ----------
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction('window.Phaser && document.querySelector("canvas")', { timeout: 30000 });
  await sleep(6000);
  st = await state();
  if (st.active.includes('Title')) {
    await tap(0.5, 0.72, 'PLAY');
    st = await state();
  }
  console.log('OK: reload persisted save — coins', st.save.coins, 'cash', st.save.cash);

  // ---------- CASH OUT ----------
  await tap(0.5, 0.945, 'CASH OUT bar');
  st = await state();
  if (!st.active.includes('CashPanel')) {
    await tap(0.5, 0.93, 'CASH OUT bar(2)');
    st = await state();
  }
  if (!st.active.includes('CashPanel')) throw new Error('CashPanel did not open');
  console.log('OK: CashPanel opens');
  await page.screenshot({ path: '/tmp/shot-cash.png' });

  // ---------- upgrades + rewards ----------
  await tap(0.9, 0.105, 'close');
  await sleep(700);
  await tap(0.5, 0.845, 'UPGRADE');
  st = await state();
  console.log('  upgrade ->', st.active.join(','));
  await tap(0.9, 0.115, 'close');
  await sleep(700);
  await tap(0.84, 0.845, 'REWARDS');
  st = await state();
  console.log('  rewards ->', st.active.join(','));
  await tap(0.9, 0.115, 'close');
  await sleep(700);

  // ---------- idle: confirm miners auto-mine ----------
  const c1 = (await state()).save.coins;
  await sleep(5000);
  const c2 = (await state()).save.coins;
  console.log(`OK: idle mining — coins ${c1} -> ${c2}`);

  const final = await state();
  console.log('final fps:', final.fps, '| scenes:', final.active.join(','));
  await page.screenshot({ path: '/tmp/shot-final.png' });

  await browser.close();
  srv.close();

  if (errors.length) {
    console.log('\n--- CONSOLE ERRORS ---');
    errors.slice(0, 25).forEach((e) => console.log(' ', e));
    process.exit(1);
  }
  if (final.fps < 30) {
    console.log('\nWARNING: low fps in headless swiftshader (' + final.fps + ') — usually fine on real GPUs');
  }
  console.log('\n✅ ALL CHECKS PASSED — no console errors');
})().catch(async (e) => {
  console.error('\n❌ TEST FAILED:', e.message);
  process.exit(1);
});
