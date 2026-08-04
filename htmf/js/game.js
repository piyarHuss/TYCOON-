/*!
 * STONE TYCOON — Idle Mining Empire
 * Plain-HTML build. No bundler, no modules, no build step required.
 * Requires: lib/phaser.min.js, lib/howler.min.js, lib/webfontloader.js
 */
(function () {
'use strict';
var Phaser = window.Phaser;
var Howl = window.Howl, Howler = window.Howler;
var WebFont = window.WebFont;

/* ==== src/assets.ts =============================================== */
function asset(p) {
    const map = typeof window !== 'undefined' ? window.ST_ASSETS : undefined;
    if (map && map[p])
        return map[p];
    // strip the leading slash so relative hosting (file server sub-folder) works
    return p.replace(/^\//, '');
}

/* ==== src/format.ts =============================================== */
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];
/** Compact idle-game number formatting: 1.23K / 45.6M / 7.89B */
function fmt(n) {
    if (!isFinite(n))
        return '\u221e';
    if (n < 0)
        return '-' + fmt(-n);
    if (n < 1000) {
        if (n < 10 && Math.floor(n) !== n)
            return n.toFixed(1);
        return String(Math.floor(n));
    }
    let i = 0;
    let v = n;
    while (v >= 1000 && i < SUF.length - 1) {
        v /= 1000;
        i++;
    }
    const s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.floor(v));
    return s + SUF[i];
}
/** $1,234.56 */
function money(n) {
    const neg = n < 0;
    const s = Math.abs(n).toFixed(2);
    const parts = s.split('.');
    const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + whole + '.' + parts[1];
}
function gold(n) {
    return fmt(n) + ' GOLD';
}
function goldFull(n) {
    const whole = Math.floor(Math.max(0, n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return whole + ' GOLD';
}
function pad2(n) {
    return n < 10 ? '0' + n : String(n);
}
function clock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
}
function dateStr(ts) {
    const d = new Date(ts);
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${pad2(d.getDate())} ${M[d.getMonth()]} ${d.getFullYear()} \u00b7 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function mask(s) {
    if (!s)
        return '\u2014';
    if (s.length <= 6)
        return s;
    return s.slice(0, 3) + '\u2022'.repeat(Math.min(8, s.length - 5)) + s.slice(-3);
}
function txnId() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 10; i++)
        out += c[Math.floor(Math.random() * c.length)];
    return 'STX-' + out.slice(0, 4) + '-' + out.slice(4, 10);
}

/* ==== src/data.ts ================================================= */
const ADMIN_CONFIG_KEY = 'stone_tycoon_admin_config_v1';
const DEFAULT_ADMIN_CONFIG = {
    enabled: true,
    rockHpMultiplier: 1,
    coinRewardMultiplier: 1,
    cashRewardMultiplier: 1,
    tapDamageMultiplier: 1,
    minerDpsMultiplier: 1,
    minerCostMultiplier: 1,
    adCashReward: 75,
    adGemReward: 12,
    boostSeconds: 60,
    minWithdraw: 1230,
    bossTime: 30,
};
function adminConfig() {
    try {
        const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
        if (!raw)
            return { ...DEFAULT_ADMIN_CONFIG };
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_ADMIN_CONFIG, ...(parsed || {}) };
    }
    catch {
        return { ...DEFAULT_ADMIN_CONFIG };
    }
}
function num(v, fallback, min = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, n) : fallback;
}
function applyAdminConfig(cfg) {
    const clean = { ...(cfg || {}) };
    clean.rockHpMultiplier = num(clean.rockHpMultiplier, 1, 0.05);
    clean.coinRewardMultiplier = num(clean.coinRewardMultiplier, 1, 0);
    clean.cashRewardMultiplier = num(clean.cashRewardMultiplier, 1, 0);
    clean.tapDamageMultiplier = num(clean.tapDamageMultiplier, 1, 0.05);
    clean.minerDpsMultiplier = num(clean.minerDpsMultiplier, 1, 0.05);
    clean.minerCostMultiplier = num(clean.minerCostMultiplier, 1, 0);
    clean.adCashReward = num(clean.adCashReward, 0.75, 0);
    clean.adGemReward = num(clean.adGemReward, 12, 0);
    clean.boostSeconds = num(clean.boostSeconds, 60, 1);
    clean.minWithdraw = num(clean.minWithdraw, 5, 0);
    clean.bossTime = num(clean.bossTime, 30, 5);
    if (Array.isArray(clean.miners)) {
        clean.miners.forEach((m, i) => {
            if (!m || !MINERS[i])
                return;
            const patch = {};
            if (typeof m.name === 'string' && m.name.trim())
                patch.name = m.name.trim();
            if (typeof m.title === 'string' && m.title.trim())
                patch.title = m.title.trim();
            if (m.baseDps != null)
                patch.baseDps = num(m.baseDps, MINERS[i].baseDps, 0);
            if (m.baseCost != null)
                patch.baseCost = num(m.baseCost, MINERS[i].baseCost, 0);
            if (m.adsRequired != null)
                patch.adsRequired = Math.floor(num(m.adsRequired, MINERS[i].adsRequired, 0));
            if (m.gemCost != null)
                patch.gemCost = Math.floor(num(m.gemCost, MINERS[i].gemCost, 0));
            if (m.swing != null)
                patch.swing = Math.floor(num(m.swing, MINERS[i].swing, 100));
            Object.assign(MINERS[i], patch);
            clean.miners[i] = { ...clean.miners[i], ...patch };
        });
    }
    try {
        localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(clean));
    }
    catch {
        // ignore quota/private-mode failures
    }
}
function getAdCashReward() { return adminConfig().adCashReward; }
function getAdGemReward() { return Math.floor(adminConfig().adGemReward); }
function getBoostSeconds() { return Math.floor(adminConfig().boostSeconds); }
function getMinWithdraw() { return adminConfig().minWithdraw; }
function getBossTime() { return Math.floor(adminConfig().bossTime); }
const MINERS = [
    { id: 0, name: 'PICKY', title: 'Rookie Miner', key: 'miner1', baseDps: 1.4, baseCost: 60, adsRequired: 0, gemCost: 0, tint: 0x4ea8ff, swing: 900 },
    { id: 1, name: 'BRUNO', title: 'Veteran Digger', key: 'miner2', baseDps: 6, baseCost: 520, adsRequired: 1, gemCost: 25, tint: 0xffa43d, swing: 1000 },
    { id: 2, name: 'GRIMM', title: 'Forge Dwarf', key: 'miner3', baseDps: 27, baseCost: 4400, adsRequired: 2, gemCost: 60, tint: 0xff5d5d, swing: 1150 },
    { id: 3, name: 'DRIL-9', title: 'Mining Droid', key: 'miner4', baseDps: 120, baseCost: 36000, adsRequired: 3, gemCost: 140, tint: 0x3ddc97, swing: 700 },
    { id: 4, name: 'NOVA', title: 'Plasma Cutter', key: 'miner5', baseDps: 540, baseCost: 290000, adsRequired: 4, gemCost: 320, tint: 0xc46bff, swing: 820 },
    { id: 5, name: 'MIDAS', title: 'The Gold King', key: 'miner6', baseDps: 2400, baseCost: 2500000, adsRequired: 5, gemCost: 750, tint: 0xffd23d, swing: 1000 },
];
const TIERS = [
    { name: 'GRANITE', key: 'rock_stone', color: 0x9aa3b0, glow: 0xc8d2e0, css: '#c8d2e0' },
    { name: 'COPPER', key: 'rock_copper', color: 0xd07a3a, glow: 0xffb072, css: '#ffb072' },
    { name: 'IRON', key: 'rock_iron', color: 0x8f9bab, glow: 0xd7e2f0, css: '#d7e2f0' },
    { name: 'GOLD', key: 'rock_gold', color: 0xe8b52c, glow: 0xffe680, css: '#ffe680' },
    { name: 'DIAMOND', key: 'rock_diamond', color: 0x3fc6f0, glow: 0x9df2ff, css: '#9df2ff' },
    { name: 'OBSIDIAN', key: 'rock_obsidian', color: 0xa03df0, glow: 0xf07dff, css: '#f07dff' },
];
function tierFor(level) {
    return TIERS[Math.floor((level - 1) / 5) % TIERS.length];
}
function zoneName(level) {
    const z = Math.floor((level - 1) / 10) + 1;
    return 'DEPTH ' + z;
}
function isBoss(level) {
    return level % 10 === 0;
}
const BOSS_TIME = 30; // fallback seconds
function rockMaxHp(level) {
    const base = 10 * Math.pow(1.152, level - 1) + level * 5;
    return Math.max(8, Math.floor((isBoss(level) ? base * 6.5 : base) * adminConfig().rockHpMultiplier));
}
function coinReward(level) {
    const base = 14 * Math.pow(1.146, level - 1) + level * 3;
    return Math.max(4, Math.floor((isBoss(level) ? base * 9 : base) * adminConfig().coinRewardMultiplier));
}
function cashReward(level) {
    // Withdrawable GOLD. Early levels give visible gold, but the game slows
    // gold earnings after the player has 600+ gold (applied in Game.breakRock).
    const base = 22 + level * 4.5 + Math.pow(1.08, level) * 3;
    return (isBoss(level) ? base * 5 : base) * adminConfig().cashRewardMultiplier;
}
// ---- Global upgrades ----
function tapCost(lv) {
    return Math.floor(30 * Math.pow(1.3, lv - 1));
}
function goldCost(lv) {
    return Math.floor(320 * Math.pow(1.42, lv));
}
function luckCost(lv) {
    return Math.floor(850 * Math.pow(1.48, lv));
}
function minerCost(i, level) {
    return Math.floor(MINERS[i].baseCost * Math.pow(1.185, Math.max(0, level)) * adminConfig().minerCostMultiplier);
}
function minerDps(i, level) {
    if (level <= 0)
        return 0;
    return MINERS[i].baseDps * level * (1 + 0.022 * level) * adminConfig().minerDpsMultiplier;
}
const PAYOUTS = [
    { id: 'paypal', name: 'PayPal', short: 'PP', color: 0x0b7ec4, hint: 'PayPal e-mail address', placeholder: 'you@email.com', eta: 'within 24 hours', fee: 0 },
    { id: 'upi', name: 'UPI', short: 'UPI', color: 0x12a05c, hint: 'UPI ID / VPA', placeholder: 'name@okbank', eta: 'within 2 hours', fee: 0 },
    { id: 'bank', name: 'Bank', short: 'BNK', color: 0x5b6bd6, hint: 'Bank account number', placeholder: '0000 0000 0000', eta: '3 - 5 business days', fee: 0.5 },
    { id: 'crypto', name: 'Crypto', short: 'USDT', color: 0xd98014, hint: 'USDT (TRC-20) wallet', placeholder: 'TX9f\u2026wallet', eta: 'within 1 hour', fee: 1 },
];
const AMOUNTS = [1230, 4230, 7230, 10000, 20000];
const MIN_WITHDRAW = 1230;
const AD_CASH_REWARD = 75; // GOLD reward from ads
const AD_GEM_REWARD = 12;
const BOOST_SECONDS = 60;
const FAKE_ADS = [
    { app: 'COIN MASTER RUSH', tag: 'Spin \u00b7 Raid \u00b7 Build your empire', sprite: 'cash', c1: 0xff8a3d, c2: 0xd6215f, cta: 'INSTALL', rating: '4.7 \u2605  \u00b7  50M+ installs' },
    { app: 'GEM LEGENDS SAGA', tag: 'Match 3 gems \u00b7 5000 levels free', sprite: 'gem', c1: 0x7a3dff, c2: 0x1fb6ff, cta: 'PLAY FREE', rating: '4.9 \u2605  \u00b7  120M+ installs' },
    { app: 'ROBO WARS 3D', tag: 'Build. Battle. Dominate the arena.', sprite: 'miner4', c1: 0x1470d6, c2: 0x00c39a, cta: 'DOWNLOAD', rating: '4.5 \u2605  \u00b7  8M+ installs' },
    { app: 'DIAMOND DIGGER PRO', tag: 'Dig deep \u00b7 Get rich \u00b7 Cash out daily', sprite: 'rock_diamond', c1: 0x00a6e0, c2: 0x2b3df0, cta: 'GET NOW', rating: '4.8 \u2605  \u00b7  22M+ installs' },
];

/* ==== src/save.ts ================================================= */
const KEY = 'stone_tycoon_save_v1';
function fresh() {
    return {
        coins: 0,
        gems: 0,
        cash: 0,
        level: 1,
        hp: rockMaxHp(1),
        maxHp: rockMaxHp(1),
        lucky: false,
        bossTime: 0,
        tapLv: 1,
        goldLv: 0,
        luckLv: 0,
        minerLevel: [1, 0, 0, 0, 0, 0],
        unlocked: [true, false, false, false, false, false],
        adProgress: [0, 0, 0, 0, 0, 0],
        adsWatched: 0,
        totalBroken: 0,
        bestLevel: 1,
        totalCoins: 0,
        boostUntil: 0,
        muted: false,
        account: {},
        lastMethod: 'paypal',
        withdrawals: [],
        lastSeen: Date.now(),
        intro: false,
    };
}
function load() {
    const base = fresh();
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return base;
        const p = JSON.parse(raw);
        const s = { ...base, ...p };
        // array integrity
        s.minerLevel = MINERS.map((_, i) => (Array.isArray(p.minerLevel) ? Number(p.minerLevel[i]) || 0 : base.minerLevel[i]));
        s.unlocked = MINERS.map((_, i) => (Array.isArray(p.unlocked) ? !!p.unlocked[i] : base.unlocked[i]));
        s.adProgress = MINERS.map((_, i) => (Array.isArray(p.adProgress) ? Number(p.adProgress[i]) || 0 : 0));
        s.unlocked[0] = true;
        if (s.minerLevel[0] < 1)
            s.minerLevel[0] = 1;
        s.withdrawals = Array.isArray(p.withdrawals) ? p.withdrawals.slice(0, 30) : [];
        s.account = typeof p.account === 'object' && p.account ? p.account : {};
        s.level = Math.max(1, Math.floor(s.level));
        s.maxHp = rockMaxHp(s.level);
        if (!isFinite(s.hp) || s.hp <= 0 || s.hp > s.maxHp)
            s.hp = s.maxHp;
        s.coins = Math.max(0, s.coins || 0);
        s.gems = Math.max(0, s.gems || 0);
        s.cash = Math.max(0, s.cash || 0);
        return s;
    }
    catch {
        return base;
    }
}
const S = load();
function save() {
    try {
        S.lastSeen = Date.now();
        localStorage.setItem(KEY, JSON.stringify(S));
    }
    catch {
        /* quota / private mode */
    }
}
function resetSave() {
    try {
        localStorage.removeItem(KEY);
    }
    catch {
        /* noop */
    }
    Object.assign(S, fresh());
}

/* ==== src/audio.ts ================================================ */
const DEFS = {
    click: { src: [asset('/sfx/click.wav')], vol: 0.45 },
    hit: { src: [asset('/sfx/hit.ogg')], vol: 0.5 },
    coin: { src: [asset('/sfx/coin.ogg')], vol: 0.4 },
    break: { src: [asset('/sfx/break.ogg')], vol: 0.55 },
    unlock: { src: [asset('/sfx/unlock.wav')], vol: 0.6 },
    confirm: { src: [asset('/sfx/confirm.wav')], vol: 0.55 },
};
const pool = {};
let ready = false;
let muted = false;
/** Must be called from inside a user-gesture handler. */
function initAudio() {
    if (ready)
        return;
    ready = true;
    Object.keys(DEFS).forEach((k) => {
        const ext = DEFS[k].src[0].indexOf('data:audio/wav') === 0 || /\.wav($|\?)/.test(DEFS[k].src[0]) ? 'wav' : 'ogg';
        pool[k] = new Howl({ src: DEFS[k].src, format: [ext], volume: DEFS[k].vol, preload: true, html5: false });
    });
    Howler.volume(0.9);
    Howler.mute(muted);
}
function sfx(key, rate = 1, volScale = 1) {
    if (!ready || muted)
        return;
    const h = pool[key];
    if (!h)
        return;
    try {
        const id = h.play();
        h.rate(Math.max(0.5, Math.min(3, rate)), id);
        h.volume(DEFS[key].vol * volScale, id);
    }
    catch {
        /* audio best-effort */
    }
}
function setMuted(m) {
    muted = m;
    if (ready)
        Howler.mute(m);
}
function isAudioReady() {
    return ready;
}

/* ==== src/ui.ts =================================================== */
const FONT = 'RussoOne';
const FONT_D = 'Bangers';
const C = {
    bg: 0x070a12,
    panel: 0x161f33,
    panelDark: 0x0d1424,
    panelLite: 0x22304d,
    stroke: 0x33456b,
    gold: 0xffc23d,
    goldDk: 0xb87914,
    green: 0x2fd074,
    greenDk: 0x158a4a,
    blue: 0x3d8bff,
    blueDk: 0x1c50b0,
    purple: 0xa86bff,
    purpleDk: 0x6a34c0,
    red: 0xff5a5a,
    redDk: 0xb32d2d,
    cyan: 0x38dcf0,
    grey: 0x3a4763,
    greyDk: 0x232e46,
};
const TXT = {
    light: '#eaf1ff',
    dim: '#8ea1c2',
    gold: '#ffd76a',
    green: '#7bf0ae',
    red: '#ff8b8b',
    dark: '#0b1020',
};
function t(size, color = TXT.light, family = FONT) {
    return { fontFamily: family, fontSize: `${size}px`, color };
}
function rr(g, x, y, w, h, r, color, alpha = 1) {
    g.fillStyle(color, alpha);
    g.fillRoundedRect(x, y, w, h, Math.max(0, Math.min(r, Math.min(w, h) / 2)));
}
function rrs(g, x, y, w, h, r, color, width = 2, alpha = 1) {
    g.lineStyle(width, color, alpha);
    g.strokeRoundedRect(x, y, w, h, Math.max(0, Math.min(r, Math.min(w, h) / 2)));
}
/** Card with bevel + border, drawn centred on (0,0) of its own graphics. */
function card(scene, x, y, w, h, opts = {}) {
    const g = scene.add.graphics({ x, y });
    const fill = opts.fill ?? C.panel;
    const st = opts.stroke ?? C.stroke;
    const r = opts.radius ?? 20;
    rr(g, -w / 2, -h / 2, w, h, r, fill, opts.alpha ?? 1);
    rr(g, -w / 2 + 3, -h / 2 + 3, w - 6, h * 0.42, r - 4, 0xffffff, 0.045);
    rrs(g, -w / 2, -h / 2, w, h, r, st, 2, 0.9);
    return g;
}
class Btn extends Phaser.GameObjects.Container {
    constructor(scene, x, y, o) {
        super(scene, x, y);
        Object.defineProperty(this, "g", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "face", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "subText", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "iconImg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "o", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "downY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "downX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "pressed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.o = o;
        const w = o.w;
        const h = o.h;
        this.g = scene.add.graphics();
        this.face = scene.add.container(0, 0);
        this.add(this.g);
        this.add(this.face);
        const fs = o.fontSize ?? Math.round(h * 0.36);
        const hasSub = !!o.sub;
        const labelY = hasSub ? -h * 0.13 : 0;
        this.label = scene.add
            .text(0, labelY, o.label, t(fs, o.textColor ?? TXT.light))
            .setOrigin(0.5)
            .setShadow(0, 2, '#00000066', 2);
        this.face.add(this.label);
        if (hasSub) {
            this.subText = scene.add
                .text(0, h * 0.24, o.sub, t(o.subSize ?? Math.round(h * 0.21), o.subColor ?? TXT.dim))
                .setOrigin(0.5);
            this.face.add(this.subText);
        }
        if (o.icon) {
            const s = o.iconSize ?? h * 0.5;
            this.iconImg = scene.add.image(0, 0, o.icon).setDisplaySize(s, s);
            this.face.add(this.iconImg);
            this.layoutIcon();
        }
        this.setSize(w, h);
        this.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
        this.on('pointerdown', (p) => {
            if (!this.enabled)
                return;
            this.downY = p.y;
            this.downX = p.x;
            this.pressed = true;
            this.face.setY(4);
            this.redraw(true);
        });
        this.on('pointerup', (p) => {
            if (!this.pressed)
                return;
            this.pressed = false;
            this.face.setY(0);
            this.redraw(false);
            if (!this.enabled)
                return;
            if (Math.abs(p.y - this.downY) > 16 || Math.abs(p.x - this.downX) > 16)
                return;
            if (o.sound !== false)
                sfx('click', 1 + (Math.random() * 0.1 - 0.05));
            o.onClick();
        });
        this.on('pointerout', () => {
            if (!this.pressed)
                return;
            this.pressed = false;
            this.face.setY(0);
            this.redraw(false);
        });
        this.setEnabled(o.enabled !== false);
        scene.add.existing(this);
    }
    layoutIcon() {
        if (!this.iconImg)
            return;
        const lw = this.label.width;
        const s = this.iconImg.displayWidth;
        const total = lw + s + 14;
        this.iconImg.setX(-total / 2 + s / 2);
        this.label.setX(total / 2 - lw / 2);
    }
    redraw(down) {
        const { w, h } = this.o;
        const r = this.o.radius ?? Math.round(h * 0.3);
        const base = this.enabled ? this.o.color ?? C.blue : C.greyDk;
        const sh = this.enabled ? this.o.shadow ?? darken(base, 0.45) : 0x161d2c;
        const depth = 7;
        this.g.clear();
        rr(this.g, -w / 2, -h / 2 + depth, w, h - depth + 2, r, sh, 1);
        const fy = -h / 2 + (down ? 4 : 0);
        rr(this.g, -w / 2, fy, w, h - depth, r, base, 1);
        rr(this.g, -w / 2 + 4, fy + 3, w - 8, (h - depth) * 0.44, r - 3, 0xffffff, this.enabled ? 0.16 : 0.05);
        rrs(this.g, -w / 2, fy, w, h - depth, r, lighten(base, 0.25), 2, this.enabled ? 0.65 : 0.2);
    }
    setEnabled(v) {
        this.enabled = v;
        this.label.setAlpha(v ? 1 : 0.45);
        this.subText?.setAlpha(v ? 1 : 0.4);
        this.iconImg?.setAlpha(v ? 1 : 0.35);
        this.redraw(false);
        return this;
    }
    isEnabled() {
        return this.enabled;
    }
    setLabel(s) {
        this.label.setText(s);
        this.layoutIcon();
        return this;
    }
    setSub(s) {
        if (this.subText)
            this.subText.setText(s);
        return this;
    }
    setColorTheme(color) {
        this.o.color = color;
        this.redraw(false);
        return this;
    }
    pop(scale = 1.07) {
        this.scene.tweens.add({
            targets: this,
            scaleX: scale,
            scaleY: scale,
            duration: 90,
            yoyo: true,
            ease: 'Quad.easeOut',
        });
        return this;
    }
}
function darken(c, f) {
    const r = Math.max(0, Math.floor(((c >> 16) & 255) * (1 - f)));
    const g = Math.max(0, Math.floor(((c >> 8) & 255) * (1 - f)));
    const b = Math.max(0, Math.floor((c & 255) * (1 - f)));
    return (r << 16) | (g << 8) | b;
}
function lighten(c, f) {
    const r = Math.min(255, Math.floor(((c >> 16) & 255) + 255 * f));
    const g = Math.min(255, Math.floor(((c >> 8) & 255) + 255 * f));
    const b = Math.min(255, Math.floor((c & 255) + 255 * f));
    return (r << 16) | (g << 8) | b;
}
function hex(c) {
    return '#' + c.toString(16).padStart(6, '0');
}
/** Rounded progress bar. */
class Bar {
    constructor(scene, x, y, w, h, color, bgColor = 0x0a1120) {
        Object.defineProperty(this, "x", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: x
        });
        Object.defineProperty(this, "y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: y
        });
        Object.defineProperty(this, "w", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: w
        });
        Object.defineProperty(this, "h", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: h
        });
        Object.defineProperty(this, "color", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: color
        });
        Object.defineProperty(this, "bgColor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: bgColor
        });
        Object.defineProperty(this, "g", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ratio", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "shown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.g = scene.add.graphics();
    }
    setColor(c) {
        this.color = c;
    }
    set(r, instant = false) {
        this.ratio = Phaser.Math.Clamp(r, 0, 1);
        if (instant)
            this.shown = this.ratio;
    }
    get gfx() {
        return this.g;
    }
    setPos(x, y) {
        this.x = x;
        this.y = y;
    }
    tick(dt) {
        this.shown += (this.ratio - this.shown) * Math.min(1, dt * 0.014);
        if (Math.abs(this.ratio - this.shown) < 0.0015)
            this.shown = this.ratio;
        this.draw();
    }
    draw() {
        const { x, y, w, h } = this;
        const r = h / 2;
        this.g.clear();
        rr(this.g, x, y, w, h, r, this.bgColor, 1);
        const fw = Math.max(0, (w - 6) * this.shown);
        if (fw > 2) {
            rr(this.g, x + 3, y + 3, fw, h - 6, Math.max(1, r - 3), this.color, 1);
            rr(this.g, x + 5, y + 5, Math.max(0, fw - 4), (h - 6) * 0.4, Math.max(1, r - 5), 0xffffff, 0.28);
        }
        rrs(this.g, x, y, w, h, r, lighten(this.color, 0.18), 2, 0.5);
    }
    destroy() {
        this.g.destroy();
    }
}
function toast(scene, msg, color = C.gold) {
    const cam = scene.cameras.main;
    const cx = cam.width / 2;
    const y = cam.height * 0.30;
    const cont = scene.add.container(cx, y).setDepth(9000);
    const txt = scene.add.text(0, 0, msg, t(26, TXT.light)).setOrigin(0.5);
    const w = Math.max(240, txt.width + 60);
    const g = scene.add.graphics();
    rr(g, -w / 2, -30, w, 60, 18, 0x0b1223, 0.96);
    rrs(g, -w / 2, -30, w, 60, 18, color, 2, 0.95);
    cont.add([g, txt]);
    cont.setAlpha(0).setScale(0.9);
    scene.tweens.add({ targets: cont, alpha: 1, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.easeOut' });
    scene.tweens.add({
        targets: cont,
        alpha: 0,
        y: y - 46,
        delay: 1250,
        duration: 320,
        ease: 'Quad.easeIn',
        onComplete: () => cont.destroy(),
    });
}
/** Vertical drag-scroll for a container within a viewport rect. */
function attachScroll(scene, container, vx, vy, vw, vh, contentH) {
    const shape = scene.make.graphics({});
    shape.fillStyle(0xffffff);
    shape.fillRoundedRect(vx, vy, vw, vh, 16);
    container.setMask(shape.createGeometryMask());
    const top = container.y;
    const min = top - Math.max(0, contentH - vh);
    let dragging = false;
    let last = 0;
    let vel = 0;
    const blocked = () => scene.data.get('modal') === true;
    const inside = (p) => p.x >= vx && p.x <= vx + vw && p.y >= vy && p.y <= vy + vh;
    scene.input.on('pointerdown', (p) => {
        if (blocked() || !inside(p))
            return;
        dragging = true;
        last = p.y;
        vel = 0;
    });
    scene.input.on('pointerup', () => {
        dragging = false;
    });
    scene.input.on('pointerupoutside', () => {
        dragging = false;
    });
    scene.input.on('pointermove', (p) => {
        if (!dragging || !p.isDown)
            return;
        const dy = p.y - last;
        last = p.y;
        vel = dy;
        container.y = Phaser.Math.Clamp(container.y + dy, min, top);
    });
    scene.input.on('wheel', (p, _o, _dx, dy) => {
        if (blocked() || !inside(p))
            return;
        container.y = Phaser.Math.Clamp(container.y - dy * 0.6, min, top);
    });
    scene.events.on('update', () => {
        if (dragging || Math.abs(vel) < 0.4)
            return;
        vel *= 0.9;
        container.y = Phaser.Math.Clamp(container.y + vel, min, top);
    });
    scene.events.once('shutdown', () => shape.destroy());
}

/* ==== src/scenes/Game.ts ========================================== */
const DW = 720;
const DH = 1280;
function tapDamage() {
    return 0; // finger tap does not break stones; miners do the mining
}
function totalDps() {
    let d = 0;
    for (let i = 0; i < MINERS.length; i++)
        if (S.unlocked[i])
            d += minerDps(i, S.minerLevel[i]);
    return d * (boostActive() ? 2 : 1);
}
function goldMult() {
    return 1 + S.goldLv * 0.14;
}
function critChance() {
    return Math.min(0.6, 0.04 + S.luckLv * 0.022);
}
function luckyChance() {
    return Math.min(0.4, 0.05 + S.luckLv * 0.018);
}
function boostActive() {
    return Date.now() < S.boostUntil;
}
class Game extends Phaser.Scene {
    constructor() {
        super('Game');
        // hud
        Object.defineProperty(this, "coinTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "gemTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cashTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "levelTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "zoneTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tierTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dpsTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hpTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hpBar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "coinPillPos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Phaser.Math.Vector2(0, 0)
        });
        Object.defineProperty(this, "cashBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // rock
        Object.defineProperty(this, "rock", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rockPivot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rockGlow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cracks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rockShadow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rockBaseScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "luckyAura", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // boss
        Object.defineProperty(this, "bossBanner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bossTimerTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bossBar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // miners
        Object.defineProperty(this, "minerSprites", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "minerLocks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "minerLvTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "swingAcc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        // combo / boost
        Object.defineProperty(this, "combo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "comboTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "comboTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "comboRing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "boostTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "boostBg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // fx
        Object.defineProperty(this, "dust", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shards", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sparkle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "displayCoins", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "saveAcc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "panelOpen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "hitSoundAcc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // ────────────────────────────────────────────── rock
        Object.defineProperty(this, "ROCK_Y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 428
        });
        // ────────────────────────────────────────────── miner row
        Object.defineProperty(this, "MINER_Y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 742
        });
    }
    create() {
        this.displayCoins = S.coins;
        this.swingAcc = MINERS.map(() => Math.random() * 0.6);
        this.buildBackground();
        this.buildRock();
        this.buildMinerRow();
        this.buildHud();
        this.buildDock();
        this.buildFx();
        this.refreshRock(true);
        this.refreshMiners();
        this.refreshHud();
        this.offlineEarnings();
        this.events.on('resume', () => this.onPanelClosed());
        this.game.events.on('panel-closed', this.onPanelClosed, this);
        this.events.once('shutdown', () => {
            this.game.events.off('panel-closed', this.onPanelClosed, this);
        });
        this.cameras.main.fadeIn(320, 0, 0, 0);
        window.addEventListener('beforeunload', () => save());
    }
    // ────────────────────────────────────────────── background
    buildBackground() {
        const bg = this.add.image(DW / 2, DH / 2, 'bg_mine');
        const sc = Math.max(DW / bg.width, DH / bg.height);
        bg.setScale(sc).setTint(0x9fb0d4).setDepth(-100);
        const shade = this.add.graphics().setDepth(-99);
        shade.fillStyle(0x060a14, 0.45);
        shade.fillRect(0, 0, DW, DH);
        // light shafts
        for (let i = 0; i < 3; i++) {
            const s = this.add
                .image(140 + i * 220, 150, 'glow')
                .setDisplaySize(220, 520)
                .setTint(0xffd98a)
                .setAlpha(0.06)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(-98);
            this.tweens.add({ targets: s, alpha: 0.12, duration: 2600 + i * 700, yoyo: true, repeat: -1 });
        }
        // floor
        const floorTop = 806;
        const fg = this.add.graphics().setDepth(-90);
        fg.fillStyle(0x0a0f1c, 0.92);
        fg.fillRect(0, floorTop, DW, DH - floorTop);
        fg.fillStyle(0x141d33, 1);
        fg.fillRect(0, floorTop, DW, 8);
        fg.lineStyle(3, 0x2a3a5c, 0.7);
        fg.lineBetween(0, floorTop, DW, floorTop);
        // drifting dust motes
        for (let i = 0; i < 18; i++) {
            const d = this.add
                .image(Phaser.Math.Between(0, DW), Phaser.Math.Between(120, 780), 'glow')
                .setDisplaySize(Phaser.Math.Between(4, 10), Phaser.Math.Between(4, 10))
                .setTint(0xffe1a3)
                .setAlpha(Phaser.Math.FloatBetween(0.06, 0.22))
                .setDepth(-95);
            this.tweens.add({
                targets: d,
                y: d.y - Phaser.Math.Between(90, 240),
                x: d.x + Phaser.Math.Between(-50, 50),
                alpha: 0,
                duration: Phaser.Math.Between(6000, 12000),
                repeat: -1,
                delay: Phaser.Math.Between(0, 5000),
                onRepeat: () => d.setPosition(Phaser.Math.Between(0, DW), 800).setAlpha(Phaser.Math.FloatBetween(0.06, 0.22)),
            });
        }
    }
    buildRock() {
        this.rockShadow = this.add.ellipse(DW / 2, this.ROCK_Y + 178, 300, 46, 0x000000, 0.4).setDepth(4);
        this.rockGlow = this.add
            .image(DW / 2, this.ROCK_Y, 'glow')
            .setDisplaySize(620, 620)
            .setAlpha(0.24)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(3);
        // The pivot owns the idle bob so squash/recoil tweens on the rock itself
        // can be killed freely without ever stopping the bob.
        this.rockPivot = this.add.container(DW / 2, this.ROCK_Y).setDepth(6);
        this.rock = this.add.image(0, 0, 'rock_stone');
        this.rock.setInteractive({ useHandCursor: true, pixelPerfect: false });
        this.rock.on('pointerdown', (p) => this.onTap(p.worldX, p.worldY));
        this.cracks = this.add.graphics();
        this.rockPivot.add([this.rock, this.cracks]);
        // big tap zone so the whole upper area registers taps
        const zone = this.add.zone(DW / 2, this.ROCK_Y, DW, 470).setInteractive();
        zone.setDepth(5);
        zone.on('pointerdown', (p) => this.onTap(p.worldX, p.worldY));
        this.tweens.add({
            targets: this.rockPivot,
            y: this.ROCK_Y + 8,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        // boss banner
        this.bossBanner = this.add.container(DW / 2, 214).setDepth(20).setVisible(false);
        const bg = this.add.graphics();
        rr(bg, -160, -26, 320, 52, 16, 0x2a0810, 0.95);
        rrs(bg, -160, -26, 320, 52, 16, C.red, 3, 1);
        const bt = this.add.text(-118, 0, 'BOSS ROCK', t(24, '#ff8b8b')).setOrigin(0, 0.5);
        this.bossTimerTxt = this.add.text(140, 0, '00:30', t(24, TXT.light)).setOrigin(1, 0.5);
        this.bossBanner.add([bg, bt, this.bossTimerTxt]);
        this.bossBar = new Bar(this, DW / 2 - 160, 244, 320, 10, C.red, 0x1a0509);
        this.bossBar.gfx.setDepth(20).setVisible(false);
    }
    refreshRock(instant = false) {
        const tier = tierFor(S.level);
        this.rock.setTexture(tier.key);
        const target = isBoss(S.level) ? 400 : 340;
        const scale = target / Math.max(this.rock.width, this.rock.height);
        this.rockBaseScale = scale;
        this.rock.setScale(scale);
        this.rockGlow.setTint(tier.glow).setDisplaySize(target * 1.9, target * 1.9);
        this.rockShadow.setSize(target * 0.85, 46);
        this.rockShadow.width = target * 0.85;
        if (S.lucky) {
            if (!this.luckyAura) {
                this.luckyAura = this.add
                    .image(DW / 2, this.ROCK_Y, 'glow')
                    .setDisplaySize(560, 560)
                    .setTint(0xffe066)
                    .setAlpha(0)
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(5);
                this.tweens.add({ targets: this.luckyAura, alpha: 0.42, duration: 700, yoyo: true, repeat: -1 });
            }
            this.luckyAura.setVisible(true);
        }
        else {
            this.luckyAura?.setVisible(false);
        }
        const boss = isBoss(S.level);
        this.bossBanner.setVisible(boss);
        this.bossBar.gfx.setVisible(boss);
        if (boss) {
            this.rock.setTint(0xffb0b0);
        }
        else {
            this.rock.clearTint();
        }
        this.hpBar.setColor(boss ? C.red : tier.color);
        this.hpBar.set(S.hp / S.maxHp, instant);
        this.tierTxt.setText(tier.name + (S.lucky ? '  \u2726 LUCKY' : ''));
        this.tierTxt.setColor(S.lucky ? '#ffe066' : tier.css);
        this.levelTxt.setText('LEVEL ' + S.level);
        this.zoneTxt.setText(zoneName(S.level));
        this.drawCracks();
    }
    drawCracks() {
        this.cracks.clear();
        const dmg = 1 - S.hp / S.maxHp;
        if (dmg < 0.14)
            return;
        const n = Math.floor(dmg * 7);
        const r = (this.rock.displayWidth / 2) * 0.72;
        const cx = this.rock.x;
        const cy = 0;
        this.cracks.lineStyle(4, 0x120a06, 0.55 + dmg * 0.35);
        const rng = new Phaser.Math.RandomDataGenerator([String(S.level)]);
        for (let i = 0; i < n; i++) {
            const a = rng.frac() * Math.PI * 2;
            let x = cx + Math.cos(a) * r * 0.15;
            let y = cy + Math.sin(a) * r * 0.15;
            this.cracks.beginPath();
            this.cracks.moveTo(x, y);
            const segs = 4;
            for (let s2 = 0; s2 < segs; s2++) {
                const aa = a + (rng.frac() - 0.5) * 1.1;
                x += Math.cos(aa) * (r / segs) * (0.6 + dmg * 0.7);
                y += Math.sin(aa) * (r / segs) * (0.6 + dmg * 0.7);
                this.cracks.lineTo(x, y);
            }
            this.cracks.strokePath();
        }
    }
    buildMinerRow() {
        const slotW = DW / MINERS.length;
        for (let i = 0; i < MINERS.length; i++) {
            const x = slotW * (i + 0.5);
            const plate = this.add.graphics().setDepth(8);
            rr(plate, x - slotW / 2 + 5, 690, slotW - 10, 130, 14, 0x0b1120, 0.35);
            rrs(plate, x - slotW / 2 + 5, 690, slotW - 10, 130, 14, 0x263450, 2, 0.5);
            const sp = this.add.image(x, this.MINER_Y, MINERS[i].key).setDepth(10);
            const s = 120 / Math.max(sp.width, sp.height);
            sp.setScale(s);
            sp.setOrigin(0.5, 0.62);
            this.minerSprites.push(sp);
            const lv = this.add.text(x, 806, '', t(15, TXT.gold)).setOrigin(0.5).setDepth(12);
            this.minerLvTxt.push(lv);
            // lock overlay
            const lock = this.add.container(x, this.MINER_Y - 6).setDepth(11);
            const lg = this.add.graphics();
            rr(lg, -slotW / 2 + 6, -52, slotW - 12, 118, 14, 0x05080f, 0.72);
            const licon = this.add.text(0, -18, '\ud83d\udd12', { fontSize: '34px' }).setOrigin(0.5);
            const ltxt = this.add.text(0, 26, '', t(14, '#9fb0d0')).setOrigin(0.5);
            lock.add([lg, licon, ltxt]);
            lock.setData('txt', ltxt);
            this.minerLocks.push(lock);
            const hit = this.add.zone(x, 750, slotW, 140).setInteractive({ useHandCursor: true });
            hit.setDepth(13);
            hit.on('pointerdown', () => {
                sfx('click');
                this.openPanel('MinersPanel', { focus: i });
            });
        }
    }
    refreshMiners() {
        for (let i = 0; i < MINERS.length; i++) {
            const sp = this.minerSprites[i];
            const lock = this.minerLocks[i];
            const lv = this.minerLvTxt[i];
            const unlocked = S.unlocked[i];
            const hired = unlocked && S.minerLevel[i] > 0;
            sp.setVisible(true);
            if (hired) {
                sp.clearTint().setAlpha(1);
                lock.setVisible(false);
                lv.setText('Lv ' + S.minerLevel[i]).setColor(TXT.gold);
            }
            else if (unlocked) {
                sp.setTint(0x50607f).setAlpha(0.7);
                lock.setVisible(false);
                lv.setText('HIRE').setColor('#7bf0ae');
            }
            else {
                sp.setTint(0x0a0f1a).setAlpha(0.85);
                lock.setVisible(true);
                const txt = lock.getData('txt');
                txt.setText(`${S.adProgress[i]}/${MINERS[i].adsRequired} AD`);
                lv.setText('LOCKED').setColor('#6d7c99');
            }
        }
    }
    // ────────────────────────────────────────────── HUD
    buildHud() {
        const g = this.add.graphics().setDepth(40);
        rr(g, 0, -30, DW, 148, 26, 0x080d18, 0.93);
        g.lineStyle(2, 0x2a3a5c, 0.85);
        g.lineBetween(0, 118, DW, 118);
        // coin pill
        const cp = this.pill(16, 26, 268, 64, 0x1b1405, C.gold);
        cp.g.setDepth(41);
        this.add.image(52, 58, 'coin').setDisplaySize(46, 46).setDepth(42);
        this.coinTxt = this.add.text(84, 58, '0', t(28, TXT.gold)).setOrigin(0, 0.5).setDepth(42);
        this.coinPillPos.set(52, 58);
        // gem pill
        this.pill(298, 26, 190, 64, 0x061a18, C.cyan).g.setDepth(41);
        this.add.image(332, 58, 'gem').setDisplaySize(42, 42).setDepth(42);
        this.gemTxt = this.add.text(362, 58, '0', t(26, '#8ef0ff')).setOrigin(0, 0.5).setDepth(42);
        // cash mini + settings
        this.pill(500, 26, 150, 64, 0x04170d, C.green).g.setDepth(41);
        this.cashTxt = this.add.text(575, 58, '0 GOLD', t(20, TXT.gold)).setOrigin(0.5).setDepth(42);
        const gear = this.add.container(684, 58).setDepth(42);
        const gg = this.add.graphics();
        rr(gg, -26, -26, 52, 52, 15, 0x1a2540, 1);
        rrs(gg, -26, -26, 52, 52, 15, C.stroke, 2, 1);
        gear.add(gg);
        gear.add(this.add.text(0, 0, '\u2699', { fontFamily: FONT, fontSize: '30px', color: '#b9c8e4' }).setOrigin(0.5));
        gear.setSize(56, 56).setInteractive({ useHandCursor: true });
        gear.on('pointerdown', () => {
            sfx('click');
            this.openPanel('SettingsPanel');
        });
        // level strip
        this.zoneTxt = this.add.text(DW / 2, 140, 'DEPTH 1', t(15, TXT.dim)).setOrigin(0.5).setDepth(41);
        this.levelTxt = this.add
            .text(DW / 2, 176, 'LEVEL 1', { fontFamily: FONT_D, fontSize: '44px', color: '#ffffff' })
            .setOrigin(0.5)
            .setDepth(41)
            .setStroke('#0b1020', 6);
        this.tierTxt = this.add.text(DW / 2, 208, 'GRANITE', t(19, TXT.dim)).setOrigin(0.5).setDepth(41);
        // hp bar
        this.hpBar = new Bar(this, 90, 616, 540, 42, C.gold, 0x080d18);
        this.hpBar.gfx.setDepth(30);
        const frame = this.add.graphics().setDepth(31);
        rrs(frame, 90, 616, 540, 42, 21, 0x3d4d70, 3, 1);
        this.hpTxt = this.add.text(DW / 2, 637, '', t(21, TXT.light)).setOrigin(0.5).setDepth(32).setShadow(0, 2, '#000000cc', 3);
        this.dpsTxt = this.add.text(DW / 2, 676, '', t(18, TXT.dim)).setOrigin(0.5).setDepth(32);
        // combo indicator
        this.comboRing = this.add.graphics().setDepth(33);
        this.comboTxt = this.add
            .text(628, 480, '', { fontFamily: FONT_D, fontSize: '40px', color: '#ffd76a' })
            .setOrigin(0.5)
            .setDepth(34)
            .setStroke('#3a1f02', 6)
            .setVisible(false);
        // boost indicator
        this.boostBg = this.add.graphics().setDepth(33).setVisible(false);
        rr(this.boostBg, 18, 250, 150, 46, 14, 0x2a1140, 0.94);
        rrs(this.boostBg, 18, 250, 150, 46, 14, C.purple, 2, 1);
        this.boostTxt = this.add.text(93, 273, '', t(18, '#e2b6ff')).setOrigin(0.5).setDepth(34).setVisible(false);
    }
    pill(x, y, w, h, fill, stroke) {
        const g = this.add.graphics();
        rr(g, x, y, w, h, h / 2, fill, 0.95);
        rr(g, x + 3, y + 3, w - 6, h * 0.4, h / 2, 0xffffff, 0.06);
        rrs(g, x, y, w, h, h / 2, stroke, 2, 0.85);
        return { g };
    }
    // ────────────────────────────────────────────── bottom dock
    buildDock() {
        const top = 848;
        const g = this.add.graphics().setDepth(40);
        rr(g, -10, top, DW + 20, DH - top + 20, 30, 0x080d18, 0.97);
        g.lineStyle(3, 0x2a3a5c, 0.9);
        g.lineBetween(0, top, DW, top);
        rr(g, 0, top, DW, 6, 3, 0x1c2a45, 0.6);
        const tabs = [
            ['MINERS', 'Hire & upgrade', C.blue, 'tools'],
            ['UPGRADES', 'Boost power', C.purple, 'gem'],
            ['FREE\u2009+', 'Watch \u00b7 Earn', C.gold, 'coin'],
        ];
        const tw = 224;
        tabs.forEach((tb, i) => {
            const x = 16 + tw / 2 + i * (tw + 8);
            const b = new Btn(this, x, top + 78, {
                w: tw,
                h: 116,
                label: tb[0],
                sub: tb[1],
                color: tb[2],
                fontSize: 25,
                subSize: 15,
                radius: 22,
                onClick: () => {
                    if (i === 0)
                        this.openPanel('MinersPanel');
                    else if (i === 1)
                        this.openPanel('UpgradePanel');
                    else
                        this.openPanel('RewardsPanel');
                },
            });
            b.setDepth(42);
        });
        // ---- big CASH OUT button ----
        this.cashBtn = new Btn(this, DW / 2, top + 216, {
            w: 688,
            h: 132,
            label: 'WITHDRAW GOLD',
            sub: '0 GOLD available',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 42,
            subSize: 20,
            subColor: '#c9ffe0',
            textColor: '#ffffff',
            radius: 28,
            onClick: () => this.openPanel('CashPanel'),
        });
        this.cashBtn.setDepth(42);
        this.tweens.add({
            targets: this.cashBtn,
            scaleX: 1.018,
            scaleY: 1.018,
            duration: 1300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        this.add.image(96, top + 216, 'gold').setDisplaySize(84, 84).setDepth(43);
        this.add
            .text(DW / 2, DH - 34, 'Demo gold withdrawals \u00b7 simulated rewarded ads', t(13, '#5d6b88'))
            .setOrigin(0.5)
            .setDepth(42);
    }
    // ────────────────────────────────────────────── fx
    buildFx() {
        this.dust = this.add.particles(0, 0, 'particle', {
            speed: { min: 60, max: 260 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.14, end: 0 },
            alpha: { start: 0.9, end: 0 },
            lifespan: { min: 260, max: 620 },
            quantity: 4,
            blendMode: 'ADD',
            emitting: false,
        });
        this.dust.setDepth(15);
        this.shards = this.add.particles(0, 0, 'debris', {
            speed: { min: 140, max: 520 },
            angle: { min: 200, max: 340 },
            gravityY: 900,
            scale: { start: 0.16, end: 0.05 },
            rotate: { min: -360, max: 360 },
            alpha: { start: 1, end: 0.2 },
            lifespan: { min: 500, max: 1100 },
            quantity: 10,
            emitting: false,
        });
        this.shards.setDepth(16);
        this.sparkle = this.add.particles(0, 0, 'spark', {
            speed: { min: 80, max: 340 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 380, max: 800 },
            quantity: 8,
            blendMode: 'ADD',
            tint: [0xffe066, 0xfff5c2, 0xffb02a],
            emitting: false,
        });
        this.sparkle.setDepth(17);
    }
    // ────────────────────────────────────────────── input
    onTap(x, y) {
        if (this.panelOpen)
            return;
        this.comboTimer = 1500;
        this.combo = Math.min(50, this.combo + 1);
        this.dust.setParticleTint(0xffd76a);
        this.dust.emitParticleAt(x, y, 4);
        const msg = this.add
            .text(x, y - 20, 'MINERS ONLY', { fontFamily: FONT_D, fontSize: '30px', color: '#ffd76a' })
            .setOrigin(0.5)
            .setDepth(60)
            .setStroke('#0b1020', 5);
        this.tweens.add({ targets: msg, y: y - 92, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => msg.destroy() });
    }
    hitRock(dmg, crit, x, y, isTap) {
        S.hp -= dmg;
        const tier = tierFor(S.level);
        this.dust.setParticleTint(tier.glow);
        this.dust.emitParticleAt(x, y, isTap ? 8 : 4);
        if (crit)
            this.sparkle.emitParticleAt(x, y, 12);
        // rock squash
        this.tweens.killTweensOf(this.rock);
        this.rock.setScale(this.rockBaseScale * (crit ? 1.12 : 1.06), this.rockBaseScale * (crit ? 0.9 : 0.95));
        this.tweens.add({
            targets: this.rock,
            scaleX: this.rockBaseScale,
            scaleY: this.rockBaseScale,
            duration: crit ? 240 : 150,
            ease: 'Back.easeOut',
        });
        this.rock.x = Phaser.Math.Between(-5, 5);
        this.tweens.add({ targets: this.rock, x: 0, duration: 130, ease: 'Sine.easeOut' });
        if (crit)
            this.cameras.main.shake(120, 0.006);
        else if (isTap)
            this.cameras.main.shake(50, 0.0022);
        this.floatDamage(x, y, dmg, crit);
        if (isTap) {
            this.hitSoundAcc++;
            if (this.hitSoundAcc % 2 === 0 || crit)
                sfx('hit', crit ? 0.75 : Phaser.Math.FloatBetween(0.9, 1.35), crit ? 1 : 0.7);
        }
        this.drawCracks();
        this.hpBar.set(Math.max(0, S.hp) / S.maxHp);
        if (S.hp <= 0)
            this.breakRock();
    }
    floatDamage(x, y, dmg, crit) {
        const txt = this.add
            .text(x + Phaser.Math.Between(-24, 24), y - 10, (crit ? 'CRIT ' : '') + fmt(dmg), {
            fontFamily: FONT_D,
            fontSize: crit ? '46px' : '32px',
            color: crit ? '#ff6f6f' : '#ffffff',
        })
            .setOrigin(0.5)
            .setDepth(60)
            .setStroke('#0b1020', crit ? 7 : 5);
        this.tweens.add({
            targets: txt,
            y: y - (crit ? 130 : 90),
            alpha: 0,
            scaleX: crit ? 1.2 : 1,
            scaleY: crit ? 1.2 : 1,
            duration: crit ? 800 : 620,
            ease: 'Quad.easeOut',
            onComplete: () => txt.destroy(),
        });
    }
    // ────────────────────────────────────────────── break & rewards
    breakRock() {
        const lvl = S.level;
        const boss = isBoss(lvl);
        const luckMul = S.lucky ? 3 : 1;
        const coins = Math.floor(coinReward(lvl) * goldMult() * luckMul);
        let cash = cashReward(lvl) * luckMul;
        if (S.cash >= 600)
            cash *= 0.45; // after 600 GOLD, gold earning slows down
        const gems = boss ? 5 + Math.floor(lvl / 10) : Math.random() < 0.12 ? 1 : 0;
        S.coins += coins;
        S.totalCoins += coins;
        S.cash += cash;
        S.gems += gems;
        S.totalBroken++;
        S.level++;
        S.bestLevel = Math.max(S.bestLevel, S.level);
        S.maxHp = rockMaxHp(S.level);
        S.hp = S.maxHp;
        S.lucky = Math.random() < luckyChance();
        S.bossTime = isBoss(S.level) ? getBossTime() : 0;
        save();
        sfx('break', boss ? 0.7 : Phaser.Math.FloatBetween(0.95, 1.15));
        sfx('coin', 1.1, 0.8);
        this.cameras.main.shake(boss ? 380 : 180, boss ? 0.014 : 0.006);
        this.cameras.main.flash(boss ? 200 : 90, 255, 230, 150, false);
        this.shards.emitParticleAt(DW / 2, this.ROCK_Y, boss ? 26 : 14);
        this.sparkle.emitParticleAt(DW / 2, this.ROCK_Y, boss ? 30 : 16);
        // rock pop-out
        this.tweens.killTweensOf(this.rock);
        const ghost = this.add
            .image(DW / 2, this.rockPivot.y, this.rock.texture.key)
            .setScale(this.rock.scaleX, this.rock.scaleY)
            .setDepth(6);
        this.tweens.add({
            targets: ghost,
            scaleX: this.rockBaseScale * 1.5,
            scaleY: this.rockBaseScale * 1.5,
            alpha: 0,
            angle: Phaser.Math.Between(-30, 30),
            duration: 360,
            ease: 'Quad.easeOut',
            onComplete: () => ghost.destroy(),
        });
        // Only the squash/flash tweens are killed above — the persistent bob tween
        // from buildRock() keeps running, so it must NOT be re-added here.
        this.rock.setAlpha(0).setScale(this.rockBaseScale * 0.4);
        this.refreshRock(true);
        this.tweens.add({
            targets: this.rock,
            alpha: 1,
            scaleX: this.rockBaseScale,
            scaleY: this.rockBaseScale,
            duration: 420,
            delay: 130,
            ease: 'Back.easeOut',
        });
        this.coinBurst(coins);
        this.rewardBanner(coins, cash, gems, boss, luckMul > 1);
        this.refreshHud();
    }
    coinBurst(coins) {
        const n = Math.min(14, 6 + Math.floor(Math.log10(Math.max(10, coins))) * 2);
        for (let i = 0; i < n; i++) {
            const c2 = this.add
                .image(DW / 2 + Phaser.Math.Between(-70, 70), this.ROCK_Y + Phaser.Math.Between(-60, 60), 'coin')
                .setDisplaySize(50, 50)
                .setDepth(70);
            const midX = c2.x + Phaser.Math.Between(-90, 90);
            const midY = c2.y - Phaser.Math.Between(70, 180);
            this.tweens.chain({
                targets: c2,
                tweens: [
                    { x: midX, y: midY, scaleX: c2.scaleX * 1.25, scaleY: c2.scaleY * 1.25, duration: 300, ease: 'Quad.easeOut' },
                    {
                        x: this.coinPillPos.x,
                        y: this.coinPillPos.y,
                        scaleX: c2.scaleX * 0.45,
                        scaleY: c2.scaleY * 0.45,
                        duration: 380 + i * 22,
                        ease: 'Quad.easeIn',
                    },
                ],
                onComplete: () => {
                    c2.destroy();
                    this.tweens.add({
                        targets: this.coinTxt,
                        scaleX: 1.16,
                        scaleY: 1.16,
                        duration: 70,
                        yoyo: true,
                    });
                },
            });
        }
    }
    rewardBanner(coins, cash, gems, boss, lucky) {
        const y = 300;
        const cont = this.add.container(DW / 2, y).setDepth(80);
        const label = boss ? 'BOSS DEFEATED!' : lucky ? 'LUCKY ROCK!' : 'ROCK SMASHED!';
        const col = boss ? '#ff8b8b' : lucky ? '#ffe066' : '#7bf0ae';
        const title = this.add
            .text(0, -34, label, { fontFamily: FONT_D, fontSize: '40px', color: col })
            .setOrigin(0.5)
            .setStroke('#0b1020', 7);
        let line = `+${fmt(coins)} coins   +${goldFull(cash)}`;
        if (gems > 0)
            line += `   +${gems} \ud83d\udc8e`;
        const sub = this.add.text(0, 8, line, t(24, TXT.light)).setOrigin(0.5).setShadow(0, 3, '#000000cc', 4);
        cont.add([title, sub]);
        cont.setScale(0.7).setAlpha(0);
        this.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
        this.tweens.add({
            targets: cont,
            y: y - 60,
            alpha: 0,
            delay: 900,
            duration: 400,
            ease: 'Quad.easeIn',
            onComplete: () => cont.destroy(),
        });
    }
    // ────────────────────────────────────────────── offline
    offlineEarnings() {
        const away = (Date.now() - S.lastSeen) / 1000;
        if (away < 90)
            return;
        const dps = totalDps() / (boostActive() ? 2 : 1);
        if (dps <= 0)
            return;
        const capped = Math.min(away, 4 * 3600);
        // convert damage to approximate rocks broken -> coins
        const dmgTotal = dps * capped * 0.5;
        const perRock = rockMaxHp(S.level);
        const rocks = Math.floor(dmgTotal / Math.max(1, perRock));
        if (rocks < 1)
            return;
        const coins = Math.floor(coinReward(S.level) * goldMult() * rocks * 0.7);
        if (coins < 1)
            return;
        this.time.delayedCall(600, () => {
            S.coins += coins;
            S.totalCoins += coins;
            save();
            this.refreshHud();
            this.showOfflinePopup(capped, coins);
        });
    }
    showOfflinePopup(sec, coins) {
        const layer = this.add.container(0, 0).setDepth(3000);
        const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x03060e, 0.8).setInteractive();
        layer.add(shade);
        const g = this.add.graphics();
        rr(g, DW / 2 - 300, DH / 2 - 190, 600, 380, 28, 0x101827, 0.99);
        rrs(g, DW / 2 - 300, DH / 2 - 190, 600, 380, 28, C.gold, 3, 0.9);
        layer.add(g);
        layer.add(this.add.text(DW / 2, DH / 2 - 140, 'WELCOME BACK!', { fontFamily: FONT_D, fontSize: '46px', color: '#ffd76a' }).setOrigin(0.5));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        layer.add(this.add
            .text(DW / 2, DH / 2 - 88, `Your miners worked for ${h > 0 ? h + 'h ' : ''}${m}m`, t(21, TXT.dim))
            .setOrigin(0.5));
        layer.add(this.add.image(DW / 2 - 90, DH / 2 - 4, 'coin').setDisplaySize(78, 78));
        layer.add(this.add.text(DW / 2 + 20, DH / 2 - 4, '+' + fmt(coins), t(46, TXT.gold)).setOrigin(0.5));
        const b = new Btn(this, DW / 2, DH / 2 + 110, {
            w: 480,
            h: 84,
            label: 'COLLECT',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 30,
            radius: 22,
            onClick: () => {
                sfx('coin');
                layer.destroy();
            },
        });
        layer.add(b);
        layer.setAlpha(0);
        this.tweens.add({ targets: layer, alpha: 1, duration: 240 });
    }
    // ────────────────────────────────────────────── panels
    openPanel(key, data) {
        if (this.panelOpen)
            return;
        this.panelOpen = true;
        this.input.enabled = false;
        this.scene.launch(key, data ?? {});
        this.scene.bringToTop(key);
    }
    onPanelClosed() {
        this.panelOpen = false;
        this.input.enabled = true;
        this.refreshMiners();
        this.refreshHud();
        this.refreshRock();
    }
    refreshHud() {
        this.gemTxt.setText(fmt(S.gems));
        this.cashTxt.setText(goldFull(S.cash));
        this.cashBtn?.setSub(S.cash >= 1230 ? `${goldFull(S.cash)} \u00b7 ready` : `${goldFull(S.cash)} available`);
    }
    // ────────────────────────────────────────────── loop
    update(_time, delta) {
        const dt = delta / 1000;
        // animated coin counter
        if (this.displayCoins !== S.coins) {
            const diff = S.coins - this.displayCoins;
            this.displayCoins += diff * Math.min(1, dt * 8);
            if (Math.abs(S.coins - this.displayCoins) < 1)
                this.displayCoins = S.coins;
        }
        this.coinTxt.setText(fmt(this.displayCoins));
        this.hpBar.tick(delta);
        this.hpTxt.setText(fmt(Math.max(0, S.hp)) + ' / ' + fmt(S.maxHp));
        const dps = totalDps();
        this.dpsTxt.setText(`\u26a1 ${fmt(dps)} DPS    MINERS MINE ONLY` + (boostActive() ? '    \u00d72 BOOST' : ''));
        // ---- miner auto-swings ----
        if (!this.panelOpen) {
            for (let i = 0; i < MINERS.length; i++) {
                if (!S.unlocked[i] || S.minerLevel[i] <= 0)
                    continue;
                this.swingAcc[i] += dt;
                const period = MINERS[i].swing / 1000;
                if (this.swingAcc[i] >= period) {
                    this.swingAcc[i] -= period;
                    this.doSwing(i, period);
                }
            }
        }
        // ---- boss timer ----
        if (isBoss(S.level)) {
            S.bossTime -= dt;
            const r = Phaser.Math.Clamp(S.bossTime / getBossTime(), 0, 1);
            this.bossBar.set(r, true);
            this.bossBar.tick(delta);
            this.bossTimerTxt.setText(clock(S.bossTime));
            this.bossTimerTxt.setColor(S.bossTime < 8 ? '#ff5a5a' : '#eaf1ff');
            if (S.bossTime <= 0)
                this.bossFail();
        }
        // ---- combo ----
        if (this.comboTimer > 0) {
            this.comboTimer -= delta;
            if (this.comboTimer <= 0) {
                this.combo = 0;
                this.comboTxt.setVisible(false);
                this.comboRing.clear();
            }
        }
        if (this.combo > 3) {
            this.comboTxt.setVisible(true).setText('x' + this.combo);
            const r = Phaser.Math.Clamp(this.comboTimer / 1500, 0, 1);
            this.comboRing.clear();
            this.comboRing.lineStyle(6, 0x3a2a08, 0.8);
            this.comboRing.strokeCircle(628, 480, 42);
            this.comboRing.lineStyle(6, 0xffc23d, 1);
            this.comboRing.beginPath();
            this.comboRing.arc(628, 480, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r, false);
            this.comboRing.strokePath();
        }
        // ---- boost ----
        if (boostActive()) {
            this.boostBg.setVisible(true);
            this.boostTxt.setVisible(true).setText('\u26a1x2  ' + clock((S.boostUntil - Date.now()) / 1000));
        }
        else {
            this.boostBg.setVisible(false);
            this.boostTxt.setVisible(false);
        }
        // ---- autosave ----
        this.saveAcc += dt;
        if (this.saveAcc > 6) {
            this.saveAcc = 0;
            save();
        }
    }
    doSwing(i, period) {
        const sp = this.minerSprites[i];
        if (!sp)
            return;
        this.tweens.killTweensOf(sp);
        sp.setAngle(0);
        this.tweens.add({
            targets: sp,
            angle: -22,
            duration: Math.min(160, period * 400),
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
        this.tweens.add({
            targets: sp,
            scaleY: sp.scaleY * 1.06,
            duration: Math.min(130, period * 350),
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
        const dmg = minerDps(i, S.minerLevel[i]) * period * (boostActive() ? 2 : 1);
        if (dmg <= 0)
            return;
        // small strike arc toward rock
        const tier = tierFor(S.level);
        const p = this.add
            .image(sp.x, sp.y - 30, 'spark')
            .setDisplaySize(20, 20)
            .setTint(MINERS[i].tint)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(18);
        this.tweens.add({
            targets: p,
            x: DW / 2 + Phaser.Math.Between(-90, 90),
            y: this.ROCK_Y + Phaser.Math.Between(-40, 90),
            scaleX: 0.4,
            scaleY: 0.4,
            alpha: 0.2,
            duration: 200,
            ease: 'Quad.easeIn',
            onComplete: () => {
                const hx = p.x;
                const hy = p.y;
                p.destroy();
                if (this.panelOpen)
                    return;
                this.dust.setParticleTint(tier.glow);
                this.dust.emitParticleAt(hx, hy, 3);
                this.applyMinerDamage(dmg, hx, hy);
            },
        });
    }
    applyMinerDamage(dmg, x, y) {
        S.hp -= dmg;
        this.hpBar.set(Math.max(0, S.hp) / S.maxHp);
        if (Math.random() < 0.35)
            this.floatDamage(x, y, dmg, false);
        this.rock.setScale(this.rockBaseScale * 1.02, this.rockBaseScale * 0.985);
        this.tweens.add({
            targets: this.rock,
            scaleX: this.rockBaseScale,
            scaleY: this.rockBaseScale,
            duration: 110,
            ease: 'Sine.easeOut',
        });
        this.drawCracks();
        if (S.hp <= 0)
            this.breakRock();
    }
    bossFail() {
        S.bossTime = getBossTime();
        S.hp = S.maxHp;
        this.hpBar.set(1);
        this.drawCracks();
        save();
        this.cameras.main.shake(300, 0.01);
        this.cameras.main.flash(180, 200, 40, 40, false);
        toast(this, 'BOSS RECOVERED! Try again', C.red);
        sfx('break', 0.55);
    }
}

/* ==== src/scenes/Panel.ts ========================================= */
/**
 * Base for every full-screen sheet panel (Miners / Upgrades / Rewards /
 * Cash-out / Settings). Handles the slide-up sheet, header, currency strip,
 * dimmer, and close plumbing back to the Game scene.
 */
class Panel extends Phaser.Scene {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "sheet", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "head", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shade", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "headerColor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: C.blue
        });
        Object.defineProperty(this, "sheetTop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 150
        });
        Object.defineProperty(this, "titleText", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PANEL'
        });
        Object.defineProperty(this, "subtitleText", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "showWallet", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "coinTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "gemTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cashTxtHud", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "closing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    /** Content area top (below header + wallet strip). */
    get contentTop() {
        return this.sheetTop + (this.showWallet ? 168 : 104);
    }
    buildChrome() {
        this.shade = this.add
            .rectangle(DW / 2, DH / 2, DW, DH, 0x02040a, 0)
            .setInteractive()
            .setDepth(0);
        this.shade.on('pointerdown', (p) => {
            if (p.y < this.sheetTop - 10)
                this.close();
        });
        this.tweens.add({ targets: this.shade, fillAlpha: 0.78, duration: 200 });
        // Body sits BELOW the scrolled content (depth 2); header sits ABOVE it so
        // masked-off rows can never be tapped through the chrome.
        this.sheet = this.add.container(0, DH).setDepth(1);
        this.head = this.add.container(0, DH).setDepth(10);
        const h = DH - this.sheetTop + 40;
        const g = this.add.graphics();
        rr(g, 0, this.sheetTop, DW, h, 34, 0x0c1322, 1);
        rrs(g, 0, this.sheetTop, DW, h, 34, this.headerColor, 3, 0.55);
        this.sheet.add(g);
        const hb = this.contentTop - this.sheetTop;
        const hg = this.add.graphics();
        rr(hg, 0, this.sheetTop, DW, Math.max(hb, 108), 34, 0x0c1322, 1);
        // header band
        rr(hg, 0, this.sheetTop, DW, 104, 34, this.headerColor, 1);
        hg.fillStyle(this.headerColor, 1);
        hg.fillRect(0, this.sheetTop + 60, DW, 44);
        rr(hg, 6, this.sheetTop + 6, DW - 12, 42, 22, 0xffffff, 0.14);
        hg.fillStyle(0x000000, 0.22);
        hg.fillRect(0, this.sheetTop + 98, DW, 6);
        this.head.add(hg);
        // grab handle
        const handle = this.add.graphics();
        rr(handle, DW / 2 - 46, this.sheetTop - 22, 92, 8, 4, 0xffffff, 0.5);
        this.head.add(handle);
        const title = this.add
            .text(36, this.sheetTop + (this.subtitleText ? 38 : 52), this.titleText, {
            fontFamily: FONT_D,
            fontSize: '40px',
            color: '#ffffff',
        })
            .setOrigin(0, 0.5)
            .setStroke('#00000055', 5);
        this.head.add(title);
        if (this.subtitleText) {
            this.head.add(this.add
                .text(38, this.sheetTop + 70, this.subtitleText, t(17, '#ffffffcc'))
                .setOrigin(0, 0.5));
        }
        // close X
        const x = this.add.container(DW - 58, this.sheetTop + 52);
        const xg = this.add.graphics();
        rr(xg, -28, -28, 56, 56, 16, 0x000000, 0.28);
        rrs(xg, -28, -28, 56, 56, 16, 0xffffff, 2, 0.4);
        x.add(xg);
        x.add(this.add.text(0, -2, '\u2715', { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5));
        x.setSize(60, 60).setInteractive({ useHandCursor: true });
        x.on('pointerdown', () => {
            sfx('click');
            this.close();
        });
        this.head.add(x);
        if (this.showWallet)
            this.buildWallet();
        // Swallows taps that land on the chrome so masked-off scroll rows underneath
        // can never be activated through the header/wallet strip.
        const blocker = this.add
            .rectangle(DW / 2, this.sheetTop + hb / 2, DW, hb, 0x000000, 0.001)
            .setInteractive();
        this.head.addAt(blocker, 0);
        this.tweens.add({ targets: [this.sheet, this.head], y: 0, duration: 340, ease: 'Cubic.easeOut' });
    }
    buildWallet() {
        const y = this.sheetTop + 134;
        const g = this.add.graphics();
        const items = [
            [20, 220, C.gold],
            [252, 200, C.cyan],
            [464, 236, C.green],
        ];
        items.forEach(([x, w, col]) => {
            rr(g, x, y - 28, w, 56, 28, 0x121a2c, 1);
            rrs(g, x, y - 28, w, 56, 28, col, 2, 0.6);
        });
        this.head.add(g);
        this.head.add(this.add.image(52, y, 'coin').setDisplaySize(40, 40));
        this.coinTxt = this.add.text(80, y, fmt(S.coins), t(23, TXT.gold)).setOrigin(0, 0.5);
        this.head.add(this.coinTxt);
        this.head.add(this.add.image(284, y, 'gem').setDisplaySize(36, 36));
        this.gemTxt = this.add.text(310, y, fmt(S.gems), t(23, '#8ef0ff')).setOrigin(0, 0.5);
        this.head.add(this.gemTxt);
        this.head.add(this.add.image(496, y, 'gold').setDisplaySize(38, 38));
        this.cashTxtHud = this.add.text(524, y, goldFull(S.cash), t(20, TXT.gold)).setOrigin(0, 0.5);
        this.head.add(this.cashTxtHud);
    }
    refreshWallet() {
        this.coinTxt?.setText(fmt(S.coins));
        this.gemTxt?.setText(fmt(S.gems));
        this.cashTxtHud?.setText(goldFull(S.cash));
        this.pulse(this.coinTxt);
    }
    pulse(o) {
        if (!o)
            return;
        this.tweens.add({ targets: o, scaleX: 1.18, scaleY: 1.18, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    }
    /** Launch the simulated rewarded-ad scene; cb(true) when fully watched. */
    playAd(reason, cb) {
        if (this.scene.isActive('AdScene'))
            return;
        this.input.enabled = false;
        this.scene.launch('AdScene', {
            reason,
            done: (ok) => {
                this.input.enabled = true;
                if (ok) {
                    S.adsWatched++;
                    save();
                }
                cb(ok);
            },
        });
        this.scene.bringToTop('AdScene');
    }
    close() {
        if (this.closing)
            return;
        this.closing = true;
        save();
        this.input.enabled = false;
        this.tweens.add({ targets: this.shade, fillAlpha: 0, duration: 220 });
        this.tweens.add({
            targets: [this.sheet, this.head],
            y: DH,
            duration: 260,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this.game.events.emit('panel-closed');
                this.scene.stop();
            },
        });
    }
    /** Small helper: standard row card graphics inside the sheet. */
    row(parent, x, y, w, h, stroke, fill = 0x141d30) {
        const g = this.add.graphics();
        rr(g, x, y, w, h, 22, fill, 1);
        rr(g, x + 3, y + 3, w - 6, h * 0.38, 19, 0xffffff, 0.04);
        rrs(g, x, y, w, h, 22, stroke, 2, 0.7);
        parent.add(g);
        return g;
    }
    btn(parent, b) {
        parent.add(b);
        return b;
    }
}

/* ==== src/scenes/Boot.ts ========================================== */
class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
        Object.defineProperty(this, "barG", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pct", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "shown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fontsDone", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "filesDone", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    preload() {
        const W = this.scale.width;
        const H = this.scale.height;
        const logo = this.add
            .text(W / 2, H * 0.42, 'STONE\nTYCOON', {
            fontFamily: 'Impact, system-ui, sans-serif',
            fontSize: `${Math.round(Math.min(W * 0.16, 92))}px`,
            color: '#ffc23d',
            align: 'center',
        })
            .setOrigin(0.5)
            .setShadow(0, 6, '#00000099', 8);
        this.tweens.add({ targets: logo, scaleX: 1.04, scaleY: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.barG = this.add.graphics();
        this.label = this.add
            .text(W / 2, H * 0.62, 'LOADING  0%', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '18px',
            color: '#7f8fb0',
        })
            .setOrigin(0.5);
        this.load.on('progress', (v) => {
            this.pct = v;
        });
        this.load.on('complete', () => {
            this.filesDone = true;
        });
        const IMAGES = ['bg_mine', 'coin', 'gem', 'cash', 'gold', 'particle', 'debris', 'tools']
            .concat(TIERS.map((tr) => tr.key))
            .concat(MINERS.map((m) => m.key));
        IMAGES.forEach((k) => this.load.image(k, asset(`/sprites/${k}.png`)));
        WebFont.load({
            custom: { families: ['RussoOne', 'Bangers'] },
            active: () => {
                this.fontsDone = true;
            },
            inactive: () => {
                this.fontsDone = true;
            },
            timeout: 4000,
        });
    }
    create() {
        this.makeTextures();
    }
    update(_time, delta) {
        const target = this.filesDone && this.fontsDone ? 1 : this.pct * 0.94;
        this.shown += (target - this.shown) * Math.min(1, delta * 0.008);
        const W = this.scale.width;
        const H = this.scale.height;
        const w = Math.min(W * 0.66, 420);
        const x = (W - w) / 2;
        const y = H * 0.55;
        this.barG.clear();
        rr(this.barG, x, y, w, 18, 9, 0x121a2c, 1);
        rrs(this.barG, x, y, w, 18, 9, C.stroke, 2, 0.8);
        const fw = (w - 6) * this.shown;
        if (fw > 2) {
            rr(this.barG, x + 3, y + 3, fw, 12, 6, C.gold, 1);
            rr(this.barG, x + 4, y + 4, Math.max(0, fw - 2), 5, 3, 0xffffff, 0.35);
        }
        this.label.setText('LOADING  ' + Math.round(this.shown * 100) + '%');
        if (this.shown > 0.995 && this.filesDone && this.fontsDone) {
            const splash = document.getElementById('boot-splash');
            if (splash)
                splash.remove();
            this.scene.start('Title');
        }
    }
    /** Procedural textures used for glows / crack overlays. */
    makeTextures() {
        try {
            this.buildProceduralTextures();
        }
        catch {
            // Canvas-texture upload can fail on exotic/headless renderers; the game
            // still runs (these are decorative glow/spark textures only).
        }
    }
    buildProceduralTextures() {
        // soft radial glow
        if (!this.textures.exists('glow')) {
            const size = 128;
            const cv = this.textures.createCanvas('glow', size, size);
            if (cv) {
                const ctx = cv.getContext();
                const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
                grd.addColorStop(0, 'rgba(255,255,255,1)');
                grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
                grd.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, size, size);
                cv.refresh();
            }
        }
        // small square spark
        if (!this.textures.exists('spark')) {
            const cv = this.textures.createCanvas('spark', 12, 12);
            if (cv) {
                const ctx = cv.getContext();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(8, 4);
                ctx.lineTo(12, 6);
                ctx.lineTo(8, 8);
                ctx.lineTo(6, 12);
                ctx.lineTo(4, 8);
                ctx.lineTo(0, 6);
                ctx.lineTo(4, 4);
                ctx.closePath();
                ctx.fill();
                cv.refresh();
            }
        }
        // vertical gradient strip for panels
        if (!this.textures.exists('vgrad')) {
            const cv = this.textures.createCanvas('vgrad', 8, 256);
            if (cv) {
                const ctx = cv.getContext();
                const grd = ctx.createLinearGradient(0, 0, 0, 256);
                grd.addColorStop(0, 'rgba(0,0,0,0)');
                grd.addColorStop(1, 'rgba(0,0,0,1)');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, 8, 256);
                cv.refresh();
            }
        }
    }
}

/* ==== src/scenes/Title.ts ========================================= */
class Title extends Phaser.Scene {
    constructor() {
        super('Title');
    }
    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        // background
        const bg = this.add.image(cx, H / 2, 'bg_mine');
        const sc = Math.max(W / bg.width, H / bg.height) * 1.06;
        bg.setScale(sc).setTint(0x8fa0c8);
        this.tweens.add({ targets: bg, scale: sc * 1.06, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const vig = this.add.graphics();
        vig.fillStyle(0x05070f, 0.62);
        vig.fillRect(0, 0, W, H);
        // floating dust
        for (let i = 0; i < 26; i++) {
            const d = this.add
                .image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'glow')
                .setDisplaySize(Phaser.Math.Between(4, 12), Phaser.Math.Between(4, 12))
                .setAlpha(Phaser.Math.FloatBetween(0.08, 0.3))
                .setTint(0xffd98a);
            this.tweens.add({
                targets: d,
                y: d.y - Phaser.Math.Between(70, 220),
                x: d.x + Phaser.Math.Between(-40, 40),
                alpha: 0,
                duration: Phaser.Math.Between(5000, 11000),
                repeat: -1,
                delay: Phaser.Math.Between(0, 4000),
                onRepeat: () => {
                    d.setPosition(Phaser.Math.Between(0, W), H + 20).setAlpha(Phaser.Math.FloatBetween(0.08, 0.3));
                },
            });
        }
        // ---- Title lockup ----
        const titleY = H * 0.19;
        const glowRing = this.add.image(cx, titleY + 8, 'glow').setDisplaySize(W * 1.1, 340).setTint(0xffb02a).setAlpha(0.22);
        this.tweens.add({ targets: glowRing, alpha: 0.34, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const tSize = Math.min(W * 0.155, 96);
        const l1 = this.add
            .text(cx, titleY - tSize * 0.44, 'STONE', {
            fontFamily: FONT_D,
            fontSize: `${tSize}px`,
            color: '#ffd76a',
        })
            .setOrigin(0.5)
            .setStroke('#4a2604', 10)
            .setShadow(0, 8, '#000000aa', 10);
        const l2 = this.add
            .text(cx, titleY + tSize * 0.46, 'TYCOON', {
            fontFamily: FONT_D,
            fontSize: `${tSize * 1.12}px`,
            color: '#ffc23d',
        })
            .setOrigin(0.5)
            .setStroke('#4a2604', 10)
            .setShadow(0, 8, '#000000aa', 10);
        this.tweens.add({ targets: [l1, l2], scaleX: 1.035, scaleY: 1.035, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add
            .text(cx, titleY + tSize * 1.05, 'IDLE MINING \u00b7 EARN GOLD \u00b7 WITHDRAW', t(Math.min(W * 0.035, 20), TXT.dim))
            .setOrigin(0.5)
            .setAlpha(0.9);
        // ---- Hero rock + miner ----
        const heroY = H * 0.455;
        const rockS = Math.min(W * 0.44, 250);
        const rock = this.add.image(cx + W * 0.06, heroY, 'rock_gold').setDisplaySize(rockS, rockS);
        this.tweens.add({ targets: rock, angle: 4, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const rGlow = this.add.image(rock.x, heroY, 'glow').setDisplaySize(rockS * 1.9, rockS * 1.9).setTint(0xffc23d).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: rGlow, alpha: 0.36, duration: 1200, yoyo: true, repeat: -1 });
        const mS = Math.min(W * 0.38, 215);
        const miner = this.add.image(cx - W * 0.24, heroY + 18, 'miner1').setDisplaySize(mS, mS);
        this.tweens.add({ targets: miner, angle: -14, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        // sparks between them
        this.time.addEvent({
            delay: 460,
            loop: true,
            callback: () => {
                for (let i = 0; i < 5; i++) {
                    const p = this.add
                        .image(rock.x - rockS * 0.4, heroY, 'spark')
                        .setDisplaySize(12, 12)
                        .setTint(0xffe066)
                        .setBlendMode(Phaser.BlendModes.ADD);
                    this.tweens.add({
                        targets: p,
                        x: p.x + Phaser.Math.Between(-70, 30),
                        y: p.y + Phaser.Math.Between(-70, 60),
                        alpha: 0,
                        scale: 0,
                        duration: 620,
                        ease: 'Quad.easeOut',
                        onComplete: () => p.destroy(),
                    });
                }
            },
        });
        // ---- Stats strip ----
        const has = S.totalBroken > 0 || S.cash > 0;
        if (has) {
            const sy = H * 0.63;
            const sw = Math.min(W * 0.88, 460);
            card(this, cx, sy, sw, 78, { fill: 0x0c1322, stroke: C.stroke, radius: 18, alpha: 0.93 });
            const cols = [
                ['LEVEL', String(S.bestLevel), TXT.gold],
                ['COINS', fmt(S.coins), TXT.light],
                ['GOLD', goldFull(S.cash), TXT.gold],
            ];
            cols.forEach((c2, i) => {
                const x = cx - sw / 2 + sw * ((i + 0.5) / 3);
                this.add.text(x, sy - 17, c2[0], t(13, TXT.dim)).setOrigin(0.5);
                this.add.text(x, sy + 11, c2[1], t(25, c2[2])).setOrigin(0.5);
                if (i < 2) {
                    const g = this.add.graphics();
                    g.lineStyle(1, C.stroke, 0.6);
                    g.lineBetween(cx - sw / 2 + (sw * (i + 1)) / 3, sy - 24, cx - sw / 2 + (sw * (i + 1)) / 3, sy + 24);
                }
            });
        }
        // ---- Play button ----
        const playY = has ? H * 0.755 : H * 0.71;
        const bw = Math.min(W * 0.74, 380);
        const playBtn = new Btn(this, cx, playY, {
            w: bw,
            h: 94,
            label: has ? 'CONTINUE' : 'START MINING',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 36,
            textColor: '#ffffff',
            radius: 26,
            sound: false,
            onClick: () => this.start(),
        });
        this.tweens.add({ targets: playBtn, scaleX: 1.035, scaleY: 1.035, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        // tap-anywhere hint
        const hint = this.add
            .text(cx, playY + 76, 'Tap the rock to mine \u00b7 Miners dig for you', t(16, TXT.dim))
            .setOrigin(0.5);
        this.tweens.add({ targets: hint, alpha: 0.4, duration: 1100, yoyo: true, repeat: -1 });
        // ---- Sound toggle · help · HTML download ----
        const btnY = H - 56;
        const soundBtn = new Btn(this, cx - 158, btnY, {
            w: 142,
            h: 56,
            label: S.muted ? 'SOUND OFF' : 'SOUND ON',
            color: S.muted ? C.grey : C.blue,
            fontSize: 15,
            radius: 16,
            onClick: () => {
                S.muted = !S.muted;
                setMuted(S.muted);
                save();
                soundBtn.setLabel(S.muted ? 'SOUND OFF' : 'SOUND ON').setColorTheme(S.muted ? C.grey : C.blue);
            },
        });
        new Btn(this, cx, btnY, {
            w: 142,
            h: 56,
            label: 'HOW TO PLAY',
            color: C.panelLite,
            fontSize: 15,
            radius: 16,
            onClick: () => this.showHelp(),
        });
        new Btn(this, cx + 158, btnY, {
            w: 142,
            h: 56,
            label: '\u2b07 GET HTML',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 15,
            radius: 16,
            onClick: () => {
                // Opens the download page shipped alongside the game. Falls back to a
                // direct hit on the single-file build when opened from file://.
                const target = window.location.protocol === 'file:' ? 'stone-tycoon-offline.html' : 'download.html';
                window.open(target, '_blank');
            },
        });
        // whole-screen tap also starts (but not over buttons)
        this.input.once('pointerdown', () => {
            initAudio();
            setMuted(S.muted);
        });
        this.cameras.main.fadeIn(400, 0, 0, 0);
    }
    start() {
        initAudio();
        setMuted(S.muted);
        sfx('confirm');
        this.cameras.main.fadeOut(260, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    }
    showHelp() {
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        const layer = this.add.container(0, 0).setDepth(5000);
        const shade = this.add.rectangle(cx, H / 2, W, H, 0x03060e, 0.86).setInteractive();
        layer.add(shade);
        const pw = Math.min(W * 0.9, 470);
        const ph = Math.min(H * 0.66, 520);
        const panel = this.add.container(cx, H / 2);
        const g = this.add.graphics();
        rr(g, -pw / 2, -ph / 2, pw, ph, 26, 0x101827, 0.99);
        rrs(g, -pw / 2, -ph / 2, pw, ph, 26, C.gold, 3, 0.85);
        rr(g, -pw / 2, -ph / 2, pw, 66, 26, C.gold, 1);
        rr(g, -pw / 2, -ph / 2 + 40, pw, 26, 0, C.gold, 1);
        panel.add(g);
        panel.add(this.add.text(0, -ph / 2 + 33, 'HOW TO PLAY', { fontFamily: FONT, fontSize: '28px', color: '#231301' }).setOrigin(0.5));
        const lines = [
            ['\u26cf\ufe0f', 'Tap the rock to swing your pickaxe and deal damage.'],
            ['\ud83d\udc77', 'Hire miners \u2014 they auto-mine for you every second, even while idle.'],
            ['\ud83d\udcfa', 'Watch ads to unlock new miners. Each miner needs more ad views.'],
            ['\ud83e\ude99', 'Break a rock \u2192 earn coins + GOLD nuggets. Every 10th rock is a BOSS.'],
            ['\ud83d\udcb5', 'Tap WITHDRAW GOLD at the bottom to request a gold withdrawal.'],
        ];
        let y = -ph / 2 + 100;
        lines.forEach(([ic, txt]) => {
            panel.add(this.add.text(-pw / 2 + 26, y, ic, { fontSize: '26px' }).setOrigin(0, 0));
            const tx = this.add.text(-pw / 2 + 70, y + 2, txt, {
                fontFamily: FONT,
                fontSize: '17px',
                color: TXT.light,
                wordWrap: { width: pw - 100 },
                lineSpacing: 4,
            });
            panel.add(tx);
            y += Math.max(52, tx.height + 20);
        });
        layer.add(panel);
        const close = new Btn(this, cx, H / 2 + ph / 2 - 44, {
            w: pw - 60,
            h: 62,
            label: 'GOT IT',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 24,
            radius: 18,
            onClick: () => layer.destroy(),
        });
        layer.add(close);
        shade.on('pointerdown', () => layer.destroy());
        panel.setScale(0.88).setAlpha(0);
        this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
    }
}

/* ==== src/scenes/AdScene.ts ======================================= */
const AD_SECONDS = 5;
/** Simulated rewarded-video ad: 5s countdown, skip-after-3s, fake install CTA. */
class AdScene extends Phaser.Scene {
    constructor() {
        super('AdScene');
        Object.defineProperty(this, "req", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "left", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: AD_SECONDS
        });
        Object.defineProperty(this, "ring", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ringTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "skipBtnG", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "skipTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "finished", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "progressG", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    init(d) {
        this.req = d;
        this.left = AD_SECONDS;
        this.finished = false;
    }
    create() {
        const ad = FAKE_ADS[Math.floor(Math.random() * FAKE_ADS.length)];
        // opaque backdrop so the game is fully covered
        this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x000000, 1).setInteractive();
        // gradient ad creative
        const g = this.add.graphics();
        g.fillGradientStyle(ad.c1, ad.c2, lighten(ad.c2, 0.1), ad.c1, 1);
        g.fillRect(0, 0, DW, DH);
        // decorative circles
        for (let i = 0; i < 14; i++) {
            g.fillStyle(0xffffff, 0.05);
            g.fillCircle(Phaser.Math.Between(0, DW), Phaser.Math.Between(0, DH), Phaser.Math.Between(40, 190));
        }
        // top ad label bar
        const bar = this.add.graphics();
        bar.fillStyle(0x000000, 0.42);
        bar.fillRect(0, 0, DW, 78);
        this.add.text(22, 39, 'Ad \u00b7 Sponsored', t(19, '#ffffffcc')).setOrigin(0, 0.5);
        this.add
            .text(DW - 22, 39, this.req.reason, t(17, '#ffffff99'))
            .setOrigin(1, 0.5);
        // hero art
        const hero = this.add.image(DW / 2, 470, ad.sprite);
        const s = 460 / Math.max(hero.width, hero.height);
        hero.setScale(s);
        this.tweens.add({
            targets: hero,
            scaleX: s * 1.07,
            scaleY: s * 1.07,
            angle: 4,
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        // sparkles behind
        this.add.particles(DW / 2, 470, 'spark', {
            speed: { min: 40, max: 180 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.6, end: 0 },
            alpha: { start: 0.9, end: 0 },
            lifespan: 1200,
            frequency: 90,
            blendMode: 'ADD',
        }).setDepth(-1);
        // app name
        this.add
            .text(DW / 2, 790, ad.app, { fontFamily: FONT_D, fontSize: '58px', color: '#ffffff' })
            .setOrigin(0.5)
            .setStroke('#00000066', 8);
        this.add.text(DW / 2, 848, ad.tag, t(22, '#ffffffdd')).setOrigin(0.5);
        this.add.text(DW / 2, 890, ad.rating, t(18, '#ffffffaa')).setOrigin(0.5);
        // fake CTA (does nothing but juice)
        const cta = this.add.container(DW / 2, 990);
        const cg = this.add.graphics();
        rr(cg, -210, -44, 420, 88, 26, 0xffffff, 1);
        rr(cg, -204, -38, 408, 34, 20, 0x000000, 0.05);
        cta.add(cg);
        cta.add(this.add.text(0, 0, ad.cta, { fontFamily: FONT, fontSize: '32px', color: '#12172a' }).setOrigin(0.5));
        cta.setSize(420, 88).setInteractive({ useHandCursor: true });
        cta.on('pointerdown', () => {
            sfx('click');
            this.tweens.add({ targets: cta, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true });
        });
        this.tweens.add({
            targets: cta,
            scaleX: 1.04,
            scaleY: 1.04,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        // countdown ring (top-right)
        this.ring = this.add.graphics().setDepth(5);
        this.ringTxt = this.add
            .text(DW - 62, 150, String(AD_SECONDS), { fontFamily: FONT, fontSize: '30px', color: '#ffffff' })
            .setOrigin(0.5)
            .setDepth(6);
        // reward banner bottom
        const rg = this.add.graphics();
        rr(rg, 40, DH - 190, DW - 80, 96, 24, 0x000000, 0.45);
        rrs(rg, 40, DH - 190, DW - 80, 96, 24, 0xffffff, 2, 0.28);
        this.add
            .text(DW / 2, DH - 158, '\ud83c\udf81  REWARD UNLOCKS WHEN AD ENDS', t(20, '#ffffff'))
            .setOrigin(0.5);
        this.add.text(DW / 2, DH - 122, this.req.reason, t(17, '#ffffffaa')).setOrigin(0.5);
        // skip button (enabled after 3s)
        const sc = this.add.container(DW / 2, DH - 52).setDepth(6);
        this.skipBtnG = this.add.graphics();
        sc.add(this.skipBtnG);
        this.skipTxt = this.add.text(0, 0, 'SKIP IN 3', t(22, '#ffffff88')).setOrigin(0.5);
        sc.add(this.skipTxt);
        sc.setSize(300, 64).setInteractive({ useHandCursor: true });
        sc.on('pointerdown', () => {
            if (this.left > AD_SECONDS - 3)
                return;
            sfx('click');
            this.finish(true);
        });
        // bottom progress bar
        this.progressG = this.add.graphics().setDepth(6);
        this.cameras.main.fadeIn(180, 0, 0, 0);
    }
    update(_t, delta) {
        if (this.finished)
            return;
        this.left = Math.max(0, this.left - delta / 1000);
        const r = 1 - this.left / AD_SECONDS;
        this.ring.clear();
        this.ring.fillStyle(0x000000, 0.5);
        this.ring.fillCircle(DW - 62, 150, 38);
        this.ring.lineStyle(6, 0xffffff, 0.25);
        this.ring.strokeCircle(DW - 62, 150, 32);
        this.ring.lineStyle(6, 0xffffff, 0.95);
        this.ring.beginPath();
        this.ring.arc(DW - 62, 150, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r, false);
        this.ring.strokePath();
        this.ringTxt.setText(String(Math.ceil(this.left)));
        this.progressG.clear();
        rr(this.progressG, 0, DH - 8, DW, 8, 0, 0x000000, 0.4);
        rr(this.progressG, 0, DH - 8, DW * r, 8, 0, 0xffffff, 0.85);
        const canSkip = this.left <= AD_SECONDS - 3;
        this.skipBtnG.clear();
        rr(this.skipBtnG, -150, -32, 300, 64, 18, 0x000000, canSkip ? 0.55 : 0.32);
        rrs(this.skipBtnG, -150, -32, 300, 64, 18, 0xffffff, 2, canSkip ? 0.7 : 0.2);
        this.skipTxt
            .setText(canSkip ? 'SKIP AD  \u25b6' : 'SKIP IN ' + Math.max(1, Math.ceil(this.left - (AD_SECONDS - 3))))
            .setColor(canSkip ? '#ffffff' : '#ffffff77');
        if (this.left <= 0)
            this.finish(true);
    }
    finish(ok) {
        if (this.finished)
            return;
        this.finished = true;
        this.cameras.main.fadeOut(160, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            const cb = this.req.done;
            this.scene.stop();
            cb(ok);
        });
    }
}

/* ==== src/scenes/MinersPanel.ts =================================== */
const ROW_H = 178;
const GAP = 14;
class MinersPanel extends Panel {
    constructor() {
        super('MinersPanel');
        Object.defineProperty(this, "list", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rowRefs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    init() {
        this.headerColor = C.blue;
        this.titleText = 'MINER CREW';
        this.subtitleText = 'Hire & upgrade \u00b7 they mine automatically';
        this.sheetTop = 130;
        this.closing = false;
        this.rowRefs = [];
    }
    create() {
        this.buildChrome();
        const vy = this.contentTop;
        const vh = DH - vy - 24;
        this.list = this.add.container(0, vy).setDepth(2);
        MINERS.forEach((_, i) => this.buildRow(i, i * (ROW_H + GAP)));
        const contentH = MINERS.length * (ROW_H + GAP) + 20;
        attachScroll(this, this.list, 0, vy, DW, vh, contentH);
    }
    buildRow(i, y) {
        const m = MINERS[i];
        const g = this.add.graphics();
        const nameTxt = this.add.text(0, 0, '', t(26, TXT.light));
        const titleTxt = this.add.text(0, 0, '', t(16, TXT.dim));
        const dpsTxt = this.add.text(0, 0, '', t(18, TXT.gold));
        const lvTxt = this.add.text(0, 0, '', t(15, '#9fb4d8'));
        const progTxt = this.add.text(0, 0, '', t(15, '#b9c8e4'));
        const progG = this.add.graphics();
        const portrait = this.add.image(96, y + ROW_H / 2, m.key);
        const ps = 126 / Math.max(portrait.width, portrait.height);
        portrait.setScale(ps);
        const badge = this.add
            .text(30, y + 24, '#' + (i + 1), t(16, '#7f92b5'))
            .setOrigin(0, 0.5);
        nameTxt.setPosition(178, y + 34).setOrigin(0, 0.5);
        titleTxt.setPosition(178, y + 62).setOrigin(0, 0.5);
        dpsTxt.setPosition(178, y + 92).setOrigin(0, 0.5);
        lvTxt.setPosition(DW - 34, y + 34).setOrigin(1, 0.5);
        progTxt.setPosition(178, y + 124).setOrigin(0, 0.5);
        const mainBtn = new Btn(this, DW - 152, y + ROW_H - 52, {
            w: 250,
            h: 78,
            label: '',
            sub: '',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 24,
            subSize: 15,
            radius: 20,
            onClick: () => this.onAction(i),
        });
        const gemBtn = new Btn(this, 372, y + ROW_H - 52, {
            w: 168,
            h: 66,
            label: '',
            color: C.purple,
            shadow: C.purpleDk,
            fontSize: 20,
            radius: 18,
            onClick: () => this.buyWithGems(i),
        });
        this.list.add([g, progG, portrait, badge, nameTxt, titleTxt, dpsTxt, lvTxt, progTxt, mainBtn, gemBtn]);
        const redraw = () => {
            const un = S.unlocked[i];
            const lv = S.minerLevel[i];
            const cost = minerCost(i, lv);
            const need = m.adsRequired;
            const got = Math.min(S.adProgress[i], need);
            const adsDone = got >= need;
            g.clear();
            const stroke = un ? m.tint : C.grey;
            rr(g, 18, y, DW - 36, ROW_H, 24, un ? 0x151f34 : 0x101725, 1);
            rr(g, 21, y + 3, DW - 42, 58, 21, 0xffffff, 0.04);
            rrs(g, 18, y, DW - 36, ROW_H, 24, stroke, 2, un ? 0.75 : 0.35);
            // tint stripe
            rr(g, 18, y, 8, ROW_H, 4, m.tint, un ? 0.95 : 0.3);
            portrait.setAlpha(un ? 1 : 0.32);
            portrait.setTint(un ? 0xffffff : 0x2a3550);
            nameTxt.setText(m.name).setColor(un ? TXT.light : '#66759a');
            titleTxt.setText(m.title);
            lvTxt.setText(un ? 'Lv ' + lv : 'LOCKED').setColor(un ? '#9fb4d8' : '#ff9a6a');
            if (un) {
                dpsTxt.setText('\u26a1 ' + fmt(minerDps(i, lv)) + ' DPS   \u2192 ' + fmt(minerDps(i, lv + 1)));
                progTxt.setText('');
                progG.clear();
                mainBtn.setVisible(true);
                mainBtn.setLabel('UPGRADE').setSub(fmt(cost) + ' coins');
                mainBtn.setColorTheme(C.green);
                mainBtn.setEnabled(S.coins >= cost);
                gemBtn.setVisible(false);
            }
            else {
                dpsTxt.setText('\u26a1 ' + fmt(m.baseDps) + ' DPS at Lv 1');
                progTxt.setText(`\ud83d\udcfa  Ads watched  ${got} / ${need}`);
                // ad progress pips
                progG.clear();
                for (let k = 0; k < need; k++) {
                    const px = 178 + k * 30;
                    const py = y + 146;
                    if (k < got) {
                        rr(progG, px, py, 24, 10, 5, C.gold, 1);
                    }
                    else {
                        rr(progG, px, py, 24, 10, 5, 0x2a3550, 1);
                    }
                }
                mainBtn.setVisible(true);
                if (adsDone) {
                    mainBtn.setLabel('UNLOCK').setSub(fmt(m.baseCost) + ' coins');
                    mainBtn.setColorTheme(C.gold);
                    mainBtn.setEnabled(S.coins >= m.baseCost);
                }
                else {
                    mainBtn.setLabel('WATCH AD').setSub(`${need - got} more to unlock`);
                    mainBtn.setColorTheme(C.blue);
                    mainBtn.setEnabled(true);
                }
                gemBtn.setVisible(true);
                gemBtn.setLabel('\ud83d\udc8e ' + m.gemCost);
                gemBtn.setEnabled(S.gems >= m.gemCost);
            }
        };
        redraw();
        this.rowRefs.push({ redraw });
    }
    refreshAll() {
        this.rowRefs.forEach((r) => r.redraw());
        this.refreshWallet();
    }
    onAction(i) {
        const m = MINERS[i];
        if (S.unlocked[i]) {
            const cost = minerCost(i, S.minerLevel[i]);
            if (S.coins < cost) {
                toast(this, 'Not enough coins', C.red);
                return;
            }
            S.coins -= cost;
            S.minerLevel[i]++;
            save();
            sfx('confirm', 1.1);
            toast(this, `${m.name} \u2192 Lv ${S.minerLevel[i]}`, m.tint);
            this.refreshAll();
            return;
        }
        const need = m.adsRequired;
        if (S.adProgress[i] >= need) {
            if (S.coins < m.baseCost) {
                toast(this, 'Not enough coins', C.red);
                return;
            }
            S.coins -= m.baseCost;
            this.doUnlock(i);
            return;
        }
        this.playAd(`Unlock ${m.name}`, (ok) => {
            if (!ok)
                return;
            S.adProgress[i] = Math.min(need, S.adProgress[i] + 1);
            save();
            sfx('unlock', 1.2);
            const left = need - S.adProgress[i];
            toast(this, left > 0 ? `Ad complete! ${left} more for ${m.name}` : `${m.name} ready to unlock!`, C.gold);
            this.refreshAll();
        });
    }
    buyWithGems(i) {
        const m = MINERS[i];
        if (S.gems < m.gemCost) {
            toast(this, 'Not enough gems', C.red);
            return;
        }
        S.gems -= m.gemCost;
        S.adProgress[i] = m.adsRequired;
        this.doUnlock(i);
    }
    doUnlock(i) {
        const m = MINERS[i];
        S.unlocked[i] = true;
        S.minerLevel[i] = Math.max(1, S.minerLevel[i]);
        save();
        sfx('unlock', 0.9);
        this.unlockFx(m.name, m.key, m.tint);
        this.refreshAll();
    }
    unlockFx(name, key, tint) {
        this.data.set('modal', true);
        const layer = this.add.container(0, 0).setDepth(500);
        const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x03060e, 0.88).setInteractive();
        layer.add(shade);
        const rays = this.add.image(DW / 2, DH / 2 - 60, 'glow').setDisplaySize(700, 700).setTint(tint).setAlpha(0.55);
        rays.setBlendMode(Phaser.BlendModes.ADD);
        layer.add(rays);
        this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
        const sprite = this.add.image(DW / 2, DH / 2 - 60, key);
        const s = 400 / Math.max(sprite.width, sprite.height);
        sprite.setScale(s * 0.2).setAlpha(0);
        layer.add(sprite);
        this.tweens.add({ targets: sprite, scaleX: s, scaleY: s, alpha: 1, duration: 520, ease: 'Back.easeOut' });
        const t1 = this.add
            .text(DW / 2, DH / 2 + 190, 'MINER UNLOCKED!', { fontFamily: FONT_D, fontSize: '52px', color: hex(lighten(tint, 0.25)) })
            .setOrigin(0.5)
            .setStroke('#0b1020', 8)
            .setAlpha(0);
        const t2 = this.add.text(DW / 2, DH / 2 + 244, name, t(34, TXT.light)).setOrigin(0.5).setAlpha(0);
        layer.add([t1, t2]);
        this.tweens.add({ targets: [t1, t2], alpha: 1, duration: 300, delay: 260 });
        const burst = this.add.particles(DW / 2, DH / 2 - 60, 'spark', {
            speed: { min: 200, max: 620 },
            angle: { min: 0, max: 360 },
            scale: { start: 2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1100,
            quantity: 40,
            blendMode: 'ADD',
            tint: [tint, 0xffffff, 0xffe066],
            emitting: false,
        });
        layer.add(burst);
        burst.explode(46);
        this.cameras.main.flash(220, 255, 255, 220, false);
        const ok = new Btn(this, DW / 2, DH / 2 + 340, {
            w: 380,
            h: 84,
            label: 'AWESOME!',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 30,
            radius: 22,
            onClick: () => {
                layer.destroy();
                this.data.set('modal', false);
            },
        });
        layer.add(ok);
        ok.setAlpha(0);
        this.tweens.add({ targets: ok, alpha: 1, duration: 250, delay: 400 });
    }
}

/* ==== src/scenes/UpgradePanel.ts ================================== */
class UpgradePanel extends Panel {
    constructor() {
        super('UpgradePanel');
        Object.defineProperty(this, "rows", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    init() {
        this.headerColor = C.gold;
        this.titleText = 'UPGRADES';
        this.subtitleText = 'Spend coins to mine faster & richer';
        this.sheetTop = 150;
        this.closing = false;
        this.rows = [];
    }
    create() {
        this.buildChrome();
        const defs = [
            {
                key: 'tap',
                name: 'PICKAXE POWER',
                icon: 'tools',
                color: C.gold,
                shadow: C.goldDk,
                desc: () => 'Damage dealt per manual tap',
                effect: () => fmt(tapDamage()) + ' dmg / tap',
                next: () => fmt(2 * (S.tapLv + 1) * Math.pow(1.14, S.tapLv)) + ' dmg / tap',
                level: () => S.tapLv,
                cost: () => tapCost(S.tapLv),
                apply: () => {
                    S.tapLv++;
                },
            },
            {
                key: 'gold',
                name: 'GOLD RUSH',
                icon: 'coin',
                color: C.green,
                shadow: C.greenDk,
                desc: () => 'Bonus coins from every broken rock',
                effect: () => '+' + Math.round((goldMult() - 1) * 100) + '% coins',
                next: () => '+' + Math.round((S.goldLv + 1) * 14) + '% coins',
                level: () => S.goldLv,
                cost: () => goldCost(S.goldLv),
                apply: () => {
                    S.goldLv++;
                },
            },
            {
                key: 'luck',
                name: 'LUCKY STRIKE',
                icon: 'gem',
                color: C.purple,
                shadow: C.purpleDk,
                desc: () => 'Crit chance + chance of Lucky Rocks (x3 loot)',
                effect: () => Math.round(critChance() * 100) + '% crit \u00b7 ' + Math.round(luckyChance() * 100) + '% lucky',
                next: () => Math.round(Math.min(0.6, 0.04 + (S.luckLv + 1) * 0.022) * 100) +
                    '% crit \u00b7 ' +
                    Math.round(Math.min(0.4, 0.05 + (S.luckLv + 1) * 0.018) * 100) +
                    '% lucky',
                level: () => S.luckLv,
                cost: () => luckCost(S.luckLv),
                apply: () => {
                    S.luckLv++;
                },
            },
        ];
        const vy = this.contentTop;
        const vh = DH - vy - 24;
        const list = this.add.container(0, vy).setDepth(2);
        const H = 224;
        const GAP = 16;
        defs.forEach((d, i) => this.buildRow(list, d, i * (H + GAP), H));
        // stats footer card
        const fy = defs.length * (H + GAP) + 6;
        const fg = this.add.graphics();
        rr(fg, 18, fy, DW - 36, 176, 24, 0x101a2b, 1);
        rrs(fg, 18, fy, DW - 36, 176, 24, C.stroke, 2, 0.6);
        list.add(fg);
        list.add(this.add.text(DW / 2, fy + 34, 'CAREER STATS', t(22, TXT.gold)).setOrigin(0.5));
        const stats = [
            ['Rocks smashed', fmt(S.totalBroken)],
            ['Deepest level', 'Lv ' + fmt(S.bestLevel)],
            ['Lifetime coins', fmt(S.totalCoins)],
            ['Ads watched', String(S.adsWatched)],
        ];
        stats.forEach(([k, v], i) => {
            const yy = fy + 74 + Math.floor(i / 2) * 42;
            const xx = i % 2 === 0 ? 48 : DW / 2 + 14;
            list.add(this.add.text(xx, yy, k, t(17, TXT.dim)).setOrigin(0, 0.5));
            list.add(this.add.text(xx + 268, yy, v, t(18, TXT.light)).setOrigin(1, 0.5));
        });
        const contentH = fy + 200;
        attachScroll(this, list, 0, vy, DW, vh, contentH);
    }
    buildRow(list, d, y, H) {
        const g = this.add.graphics();
        const icon = this.add.image(88, y + 78, d.icon).setDisplaySize(74, 74);
        const name = this.add.text(154, y + 46, d.name, t(26, TXT.light)).setOrigin(0, 0.5);
        const lv = this.add.text(DW - 40, y + 46, '', t(19, TXT.gold)).setOrigin(1, 0.5);
        const desc = this.add
            .text(154, y + 78, d.desc(), { ...t(16, TXT.dim), wordWrap: { width: DW - 210 } })
            .setOrigin(0, 0);
        const cur = this.add.text(40, y + 138, '', t(19, '#8ef0ff')).setOrigin(0, 0.5);
        const nxt = this.add.text(40, y + 168, '', t(17, '#7bf0ae')).setOrigin(0, 0.5);
        const buy = new Btn(this, DW - 158, y + 156, {
            w: 250,
            h: 82,
            label: 'UPGRADE',
            sub: '',
            color: d.color,
            shadow: d.shadow,
            fontSize: 25,
            subSize: 16,
            radius: 20,
            textColor: d.color === C.gold ? '#2a1a02' : TXT.light,
            subColor: d.color === C.gold ? '#4a3208' : TXT.dim,
            onClick: () => {
                const c = d.cost();
                if (S.coins < c) {
                    toast(this, 'Not enough coins', C.red);
                    return;
                }
                S.coins -= c;
                d.apply();
                save();
                sfx('confirm', 1.15);
                toast(this, d.name + ' upgraded!', d.color);
                this.cameras.main.flash(90, 255, 240, 190, false);
                this.refreshAll();
            },
        });
        list.add([g, icon, name, lv, desc, cur, nxt, buy]);
        const redraw = () => {
            const c = d.cost();
            g.clear();
            rr(g, 18, y, DW - 36, H, 24, 0x151f34, 1);
            rr(g, 21, y + 3, DW - 42, 62, 21, 0xffffff, 0.04);
            rrs(g, 18, y, DW - 36, H, 24, d.color, 2, 0.6);
            rr(g, 18, y, 8, H, 4, d.color, 0.95);
            lv.setText('Lv ' + d.level());
            cur.setText('NOW:  ' + d.effect());
            nxt.setText('NEXT: ' + d.next());
            buy.setSub(fmt(c) + ' coins');
            buy.setEnabled(S.coins >= c);
        };
        redraw();
        this.rows.push(redraw);
    }
    refreshAll() {
        this.rows.forEach((r) => r());
        this.refreshWallet();
    }
}

/* ==== src/scenes/RewardsPanel.ts ================================== */
class RewardsPanel extends Panel {
    constructor() {
        super('RewardsPanel');
        Object.defineProperty(this, "redraws", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    init() {
        this.headerColor = C.purple;
        this.titleText = 'FREE REWARDS';
        this.subtitleText = 'Watch ads \u00b7 earn GOLD, gems & boosts';
        this.sheetTop = 150;
        this.closing = false;
        this.redraws = [];
    }
    create() {
        this.buildChrome();
        const offers = [
            {
                title: 'GOLD BONUS',
                desc: 'Instant GOLD added to your withdrawable balance.',
                reward: '+' + goldFull(getAdCashReward()),
                icon: 'gold',
                color: C.green,
                shadow: C.greenDk,
                cta: 'WATCH AD',
                ready: () => true,
                claim: (done) => {
                    this.playAd('Gold bonus ' + goldFull(getAdCashReward()), (ok) => {
                        if (!ok)
                            return;
                        S.cash += getAdCashReward();
                        save();
                        sfx('coin', 1.15);
                        toast(this, 'Earned ' + goldFull(getAdCashReward()) + '!', C.gold);
                        done();
                    });
                },
            },
            {
                title: 'GEM PACK',
                desc: 'Gems instantly unlock miners \u2014 no ads needed.',
                reward: '+' + getAdGemReward() + ' \ud83d\udc8e',
                icon: 'gem',
                color: C.cyan,
                shadow: 0x1a7f95,
                cta: 'WATCH AD',
                ready: () => true,
                claim: (done) => {
                    this.playAd('Gem pack +' + getAdGemReward(), (ok) => {
                        if (!ok)
                            return;
                        S.gems += getAdGemReward();
                        save();
                        sfx('coin', 1.4);
                        toast(this, '+' + getAdGemReward() + ' gems!', C.cyan);
                        done();
                    });
                },
            },
            {
                title: 'x2 MINING BOOST',
                desc: 'Double all miner DPS for 60 seconds. Stacks with time left.',
                reward: 'x2 \u00b7 ' + getBoostSeconds() + 's',
                icon: 'tools',
                color: C.purple,
                shadow: C.purpleDk,
                cta: 'ACTIVATE',
                ready: () => true,
                note: () => (boostActive() ? 'Active: ' + clock((S.boostUntil - Date.now()) / 1000) : ''),
                claim: (done) => {
                    this.playAd('x2 mining boost', (ok) => {
                        if (!ok)
                            return;
                        const base = Math.max(Date.now(), S.boostUntil);
                        S.boostUntil = base + getBoostSeconds() * 1000;
                        save();
                        sfx('unlock', 1.1);
                        toast(this, 'x2 BOOST ACTIVE!', C.purple);
                        done();
                    });
                },
            },
            {
                title: 'COIN JACKPOT',
                desc: 'Grab a big pile of coins based on your current depth.',
                reward: '+' + fmt(Math.floor(coinReward(S.level) * goldMult() * 9)),
                icon: 'coin',
                color: C.gold,
                shadow: C.goldDk,
                cta: 'WATCH AD',
                ready: () => true,
                claim: (done) => {
                    const amt = Math.floor(coinReward(S.level) * goldMult() * 9);
                    this.playAd('Coin jackpot +' + fmt(amt), (ok) => {
                        if (!ok)
                            return;
                        S.coins += amt;
                        S.totalCoins += amt;
                        save();
                        sfx('coin');
                        toast(this, '+' + fmt(amt) + ' coins!', C.gold);
                        done();
                    });
                },
            },
        ];
        const vy = this.contentTop;
        const vh = DH - vy - 24;
        const list = this.add.container(0, vy).setDepth(2);
        const H = 168;
        const GAP = 16;
        offers.forEach((o, i) => this.buildOffer(list, o, i * (H + GAP), H));
        // info card
        const iy = offers.length * (H + GAP) + 4;
        const ig = this.add.graphics();
        rr(ig, 18, iy, DW - 36, 150, 24, 0x121b2c, 1);
        rrs(ig, 18, iy, DW - 36, 150, 24, C.stroke, 2, 0.6);
        list.add(ig);
        list.add(this.add.text(DW / 2, iy + 34, '\ud83d\udcfa  ADS WATCHED', t(20, TXT.dim)).setOrigin(0.5));
        list.add(this.add
            .text(DW / 2, iy + 84, String(S.adsWatched), { fontFamily: 'Bangers', fontSize: '56px', color: '#ffd76a' })
            .setOrigin(0.5));
        list.add(this.add.text(DW / 2, iy + 126, 'Simulated ads \u2014 no real network calls', t(14, '#5d6b88')).setOrigin(0.5));
        attachScroll(this, list, 0, vy, DW, vh, iy + 180);
    }
    buildOffer(list, o, y, H) {
        const g = this.add.graphics();
        rr(g, 18, y, DW - 36, H, 24, 0x151f34, 1);
        rr(g, 21, y + 3, DW - 42, 56, 21, 0xffffff, 0.04);
        rrs(g, 18, y, DW - 36, H, 24, o.color, 2, 0.6);
        rr(g, 18, y, 8, H, 4, o.color, 0.95);
        list.add(g);
        const iconBg = this.add.graphics();
        rr(iconBg, 40, y + 34, 92, 92, 22, 0x0b1120, 1);
        rrs(iconBg, 40, y + 34, 92, 92, 22, o.color, 2, 0.45);
        list.add(iconBg);
        list.add(this.add.image(86, y + 80, o.icon).setDisplaySize(66, 66));
        list.add(this.add.text(154, y + 42, o.title, t(25, TXT.light)).setOrigin(0, 0.5));
        list.add(this.add
            .text(154, y + 66, o.desc, { ...t(15, TXT.dim), wordWrap: { width: 300 } })
            .setOrigin(0, 0));
        const rewardTxt = this.add
            .text(154, y + 132, o.reward, { fontFamily: 'Bangers', fontSize: '34px', color: '#ffd76a' })
            .setOrigin(0, 0.5)
            .setStroke('#0b1020', 5);
        list.add(rewardTxt);
        const noteTxt = this.add.text(DW - 40, y + 132, '', t(15, '#7bf0ae')).setOrigin(1, 0.5);
        list.add(noteTxt);
        const b = new Btn(this, DW - 152, y + 62, {
            w: 244,
            h: 76,
            label: o.cta,
            color: o.color,
            shadow: o.shadow,
            fontSize: 24,
            radius: 20,
            textColor: o.color === C.gold ? '#2a1a02' : TXT.light,
            onClick: () => {
                o.claim(() => {
                    this.refreshAll();
                });
            },
        });
        list.add(b);
        const redraw = () => {
            noteTxt.setText(o.note ? o.note() : '');
        };
        redraw();
        this.redraws.push(redraw);
    }
    refreshAll() {
        this.redraws.forEach((r) => r());
        this.refreshWallet();
    }
    update() {
        // keeps boost countdown live
        if (this.redraws.length)
            this.redraws.forEach((r) => r());
    }
}

/* ==== src/scenes/CashPanel.ts ===================================== */
class CashPanel extends Panel {
    constructor() {
        super('CashPanel');
        Object.defineProperty(this, "method", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "amount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 5
        });
        Object.defineProperty(this, "list", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "redraws", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "balTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "accountTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hintTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "etaTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "feeTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "netTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "submitBtn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "progG", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "progTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    init() {
        this.headerColor = C.green;
        this.titleText = 'WITHDRAW GOLD';
        this.subtitleText = 'Withdraw your mined GOLD';
        this.sheetTop = 118;
        this.showWallet = false;
        this.closing = false;
        this.redraws = [];
        this.method = PAYOUTS.find((p) => p.id === S.lastMethod) ?? PAYOUTS[0];
        this.amount = AMOUNTS.find((a) => a <= S.cash) ?? getMinWithdraw();
    }
    create() {
        this.buildChrome();
        const vy = this.sheetTop + 112;
        const vh = DH - vy - 16;
        this.list = this.add.container(0, vy).setDepth(2);
        let y = 6;
        y = this.buildBalanceCard(y);
        y = this.buildMethods(y);
        y = this.buildAmounts(y);
        y = this.buildAccount(y);
        y = this.buildSummary(y);
        y = this.buildSubmit(y);
        y = this.buildHistory(y);
        attachScroll(this, this.list, 0, vy, DW, vh, y + 40);
        this.refreshAll();
    }
    // ─────────────────────────────── balance hero card
    buildBalanceCard(y) {
        const H = 214;
        const g = this.add.graphics();
        g.fillGradientStyle(0x0d3c2a, 0x0d3c2a, 0x11624a, 0x0a2e22, 1);
        g.fillRoundedRect(18, y, DW - 36, H, 26);
        rrs(g, 18, y, DW - 36, H, 26, C.green, 3, 0.75);
        rr(g, 22, y + 4, DW - 44, 70, 22, 0xffffff, 0.06);
        this.list.add(g);
        // shimmer
        const shine = this.add.rectangle(-120, y + H / 2, 90, H, 0xffffff, 0.07).setAngle(14);
        this.list.add(shine);
        this.tweens.add({
            targets: shine,
            x: DW + 140,
            duration: 2600,
            repeat: -1,
            repeatDelay: 1600,
            ease: 'Sine.easeInOut',
        });
        this.list.add(this.add.text(46, y + 34, 'AVAILABLE GOLD', t(17, '#8fe4b8')).setOrigin(0, 0.5));
        this.list.add(this.add.image(DW - 72, y + 46, 'gold').setDisplaySize(60, 60));
        this.balTxt = this.add
            .text(46, y + 96, goldFull(S.cash), { fontFamily: FONT_D, fontSize: '68px', color: '#ffffff' })
            .setOrigin(0, 0.5)
            .setStroke('#04241a', 8);
        this.list.add(this.balTxt);
        // progress toward minimum
        this.progG = this.add.graphics();
        this.list.add(this.progG);
        this.progTxt = this.add.text(46, y + 186, '', t(15, '#a9ecc9')).setOrigin(0, 0.5);
        this.list.add(this.progTxt);
        const drawProg = () => {
            const r = Phaser.Math.Clamp(S.cash / getMinWithdraw(), 0, 1);
            this.progG.clear();
            rr(this.progG, 46, y + 148, DW - 128, 16, 8, 0x04241a, 1);
            if (r > 0.01)
                rr(this.progG, 48, y + 150, (DW - 132) * r, 12, 6, 0x38e08a, 1);
            rrs(this.progG, 46, y + 148, DW - 128, 16, 8, 0x38e08a, 2, 0.45);
            this.progTxt.setText(S.cash >= getMinWithdraw()
                ? '\u2705  Minimum reached \u2014 you can withdraw now'
                : `${goldFull(getMinWithdraw() - S.cash)} more to reach the ${goldFull(getMinWithdraw())} minimum`);
            this.balTxt.setText(goldFull(S.cash));
        };
        this.redraws.push(drawProg);
        // quick "earn more" ad button
        const earn = new Btn(this, DW / 2, y + H + 52, {
            w: DW - 36,
            h: 82,
            label: '\ud83d\udcfa  WATCH AD  \u2192  +' + goldFull(getAdCashReward()),
            color: C.purple,
            shadow: C.purpleDk,
            fontSize: 25,
            radius: 22,
            onClick: () => {
                this.playAd('Gold bonus ' + goldFull(getAdCashReward()), (ok) => {
                    if (!ok)
                        return;
                    S.cash += getAdCashReward();
                    save();
                    sfx('coin', 1.15);
                    toast(this, 'Added ' + goldFull(getAdCashReward()) + ' to balance', C.gold);
                    this.tweens.add({
                        targets: this.balTxt,
                        scaleX: 1.15,
                        scaleY: 1.15,
                        duration: 130,
                        yoyo: true,
                        ease: 'Back.easeOut',
                    });
                    this.refreshAll();
                });
            },
        });
        this.list.add(earn);
        return y + H + 106;
    }
    // ─────────────────────────────── payout methods
    buildMethods(y) {
        this.list.add(this.add.text(30, y + 10, 'PAYOUT METHOD', t(19, TXT.gold)).setOrigin(0, 0.5));
        const top = y + 36;
        const w = (DW - 36 - 3 * 12) / 4;
        const H = 118;
        PAYOUTS.forEach((p, i) => {
            const x = 18 + i * (w + 12);
            const g = this.add.graphics();
            this.list.add(g);
            const badge = this.add.graphics();
            this.list.add(badge);
            const short = this.add
                .text(x + w / 2, top + 42, p.short, { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
                .setOrigin(0.5);
            this.list.add(short);
            const nm = this.add.text(x + w / 2, top + 92, p.name, t(16, TXT.dim)).setOrigin(0.5);
            this.list.add(nm);
            const zone = this.add.zone(x + w / 2, top + H / 2, w, H).setInteractive({ useHandCursor: true });
            this.list.add(zone);
            zone.on('pointerdown', () => {
                if (this.method.id === p.id)
                    return;
                sfx('click');
                this.method = p;
                S.lastMethod = p.id;
                save();
                this.refreshAll();
                this.tweens.add({ targets: [short, nm], scaleX: 1.12, scaleY: 1.12, duration: 110, yoyo: true });
            });
            const redraw = () => {
                const sel = this.method.id === p.id;
                g.clear();
                rr(g, x, top, w, H, 20, sel ? 0x16283f : 0x111a2b, 1);
                rrs(g, x, top, w, H, 20, sel ? p.color : C.stroke, sel ? 3 : 2, sel ? 1 : 0.5);
                badge.clear();
                rr(badge, x + w / 2 - 28, top + 20, 56, 44, 12, p.color, sel ? 1 : 0.5);
                nm.setColor(sel ? TXT.light : TXT.dim);
                short.setAlpha(sel ? 1 : 0.7);
            };
            redraw();
            this.redraws.push(redraw);
        });
        return top + H + 22;
    }
    // ─────────────────────────────── amount chips
    buildAmounts(y) {
        this.list.add(this.add.text(30, y + 10, 'SELECT AMOUNT', t(19, TXT.gold)).setOrigin(0, 0.5));
        const top = y + 36;
        const w = (DW - 36 - 4 * 10) / 5;
        const H = 74;
        AMOUNTS.forEach((a, i) => {
            const x = 18 + i * (w + 10);
            const g = this.add.graphics();
            this.list.add(g);
            const lbl = this.add
                .text(x + w / 2, top + H / 2 - 6, goldFull(a), { fontFamily: FONT, fontSize: '24px', color: '#ffffff' })
                .setOrigin(0.5);
            this.list.add(lbl);
            const sub = this.add.text(x + w / 2, top + H - 16, '', t(12, '#7f92b5')).setOrigin(0.5);
            this.list.add(sub);
            const zone = this.add.zone(x + w / 2, top + H / 2, w, H).setInteractive({ useHandCursor: true });
            this.list.add(zone);
            zone.on('pointerdown', () => {
                if (S.cash < a) {
                    toast(this, 'Need ' + goldFull(a - S.cash) + ' more', C.red);
                    sfx('click', 0.7);
                    return;
                }
                sfx('click', 1.2);
                this.amount = a;
                this.refreshAll();
                this.tweens.add({ targets: lbl, scaleX: 1.2, scaleY: 1.2, duration: 110, yoyo: true, ease: 'Back.easeOut' });
            });
            const redraw = () => {
                const sel = this.amount === a;
                const afford = S.cash >= a;
                g.clear();
                rr(g, x, top, w, H, 18, sel ? 0x0f3826 : afford ? 0x111a2b : 0x0c111c, 1);
                rrs(g, x, top, w, H, 18, sel ? C.green : afford ? C.stroke : 0x1d2536, sel ? 3 : 2, sel ? 1 : 0.6);
                lbl.setColor(sel ? '#7bf0ae' : afford ? '#ffffff' : '#4a5674');
                sub.setText(afford ? '' : '\ud83d\udd12');
            };
            redraw();
            this.redraws.push(redraw);
        });
        return top + H + 22;
    }
    // ─────────────────────────────── account field
    buildAccount(y) {
        const H = 116;
        const g = this.add.graphics();
        rr(g, 18, y, DW - 36, H, 22, 0x111a2b, 1);
        rrs(g, 18, y, DW - 36, H, 22, C.stroke, 2, 0.6);
        this.list.add(g);
        this.hintTxt = this.add.text(40, y + 30, '', t(15, TXT.dim)).setOrigin(0, 0.5);
        this.list.add(this.hintTxt);
        this.accountTxt = this.add.text(40, y + 72, '', t(24, TXT.light)).setOrigin(0, 0.5);
        this.list.add(this.accountTxt);
        const edit = new Btn(this, DW - 108, y + H / 2, {
            w: 150,
            h: 68,
            label: 'EDIT',
            color: C.blue,
            shadow: C.blueDk,
            fontSize: 22,
            radius: 18,
            onClick: () => this.promptAccount(),
        });
        this.list.add(edit);
        const redraw = () => {
            this.hintTxt.setText(this.method.hint);
            const v = S.account[this.method.id] ?? '';
            this.accountTxt.setText(v ? mask(v) : this.method.placeholder).setColor(v ? TXT.light : '#54628350');
            this.accountTxt.setColor(v ? TXT.light : '#546283');
        };
        redraw();
        this.redraws.push(redraw);
        return y + H + 18;
    }
    // ─────────────────────────────── summary
    buildSummary(y) {
        const H = 152;
        const g = this.add.graphics();
        rr(g, 18, y, DW - 36, H, 22, 0x0e1626, 1);
        rrs(g, 18, y, DW - 36, H, 22, C.stroke, 2, 0.5);
        this.list.add(g);
        const mk = (yy, label, color, size) => {
            const l = this.add.text(44, yy, label, t(17, TXT.dim)).setOrigin(0, 0.5);
            const v = this.add.text(DW - 44, yy, '', t(size, color)).setOrigin(1, 0.5);
            this.list.add([l, v]);
            return v;
        };
        this.feeTxt = mk(y + 32, 'Processing fee', '#ffb37a', 18);
        this.etaTxt = mk(y + 72, 'Estimated arrival', '#8ef0ff', 17);
        const sep = this.add.graphics();
        sep.lineStyle(2, 0x24314c, 1);
        sep.lineBetween(44, y + 100, DW - 44, y + 100);
        this.list.add(sep);
        this.netTxt = mk(y + 126, 'YOU RECEIVE', '#7bf0ae', 26);
        const redraw = () => {
            const fee = this.method.fee;
            this.feeTxt.setText('FREE');
            this.feeTxt.setColor('#7bf0ae');
            this.etaTxt.setText(this.method.eta);
            this.netTxt.setText(goldFull(this.amount));
        };
        redraw();
        this.redraws.push(redraw);
        return y + H + 18;
    }
    // ─────────────────────────────── submit
    buildSubmit(y) {
        this.submitBtn = new Btn(this, DW / 2, y + 52, {
            w: DW - 36,
            h: 100,
            label: 'WITHDRAW',
            sub: '',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 32,
            subSize: 16,
            radius: 26,
            onClick: () => this.submit(),
        });
        this.list.add(this.submitBtn);
        const note = this.add
            .text(DW / 2, y + 122, '\ud83d\udd12  Simulated GOLD withdrawal record only', t(14, '#5d6b88'))
            .setOrigin(0.5);
        this.list.add(note);
        const redraw = () => {
            const hasAcc = !!S.account[this.method.id];
            const enough = S.cash >= this.amount;
            const okMin = this.amount >= getMinWithdraw();
            this.submitBtn.setEnabled(hasAcc && enough && okMin);
            this.submitBtn.setLabel('WITHDRAW ' + goldFull(this.amount));
            this.submitBtn.setSub(!enough
                ? 'Insufficient balance'
                : !hasAcc
                    ? 'Add your ' + this.method.name + ' details first'
                    : 'via ' + this.method.name + ' \u00b7 ' + this.method.eta);
        };
        redraw();
        this.redraws.push(redraw);
        return y + 150;
    }
    // ─────────────────────────────── history
    buildHistory(y) {
        this.list.add(this.add.text(30, y + 16, 'TRANSACTION HISTORY', t(19, TXT.gold)).setOrigin(0, 0.5));
        let yy = y + 42;
        if (S.withdrawals.length === 0) {
            const g = this.add.graphics();
            rr(g, 18, yy, DW - 36, 108, 22, 0x0e1626, 1);
            rrs(g, 18, yy, DW - 36, 108, 22, C.stroke, 2, 0.4);
            this.list.add(g);
            this.list.add(this.add.text(DW / 2, yy + 40, 'No withdrawals yet', t(19, TXT.dim)).setOrigin(0.5));
            this.list.add(this.add.text(DW / 2, yy + 72, 'Break rocks to earn GOLD nuggets', t(15, '#5d6b88')).setOrigin(0.5));
            return yy + 130;
        }
        S.withdrawals.slice(0, 10).forEach((w) => {
            const H = 104;
            const pm = PAYOUTS.find((p) => p.id === w.method) ?? PAYOUTS[0];
            const g = this.add.graphics();
            rr(g, 18, yy, DW - 36, H, 20, 0x111a2b, 1);
            rrs(g, 18, yy, DW - 36, H, 20, C.stroke, 2, 0.45);
            rr(g, 18, yy, 7, H, 3, pm.color, 0.9);
            this.list.add(g);
            const badge = this.add.graphics();
            rr(badge, 42, yy + 26, 56, 52, 14, pm.color, 0.85);
            this.list.add(badge);
            this.list.add(this.add.text(70, yy + 52, pm.short, { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5));
            this.list.add(this.add.text(116, yy + 32, goldFull(w.amount), t(24, TXT.light)).setOrigin(0, 0.5));
            this.list.add(this.add.text(116, yy + 58, w.id, t(14, '#6d7d9c')).setOrigin(0, 0.5));
            this.list.add(this.add.text(116, yy + 80, dateStr(w.date), t(13, '#54628a')).setOrigin(0, 0.5));
            const sg = this.add.graphics();
            const isPending = w.status === 'PENDING';
            const col = isPending ? C.gold : C.green;
            rr(sg, DW - 176, yy + 34, 140, 40, 20, col, 0.16);
            rrs(sg, DW - 176, yy + 34, 140, 40, 20, col, 2, 0.8);
            this.list.add(sg);
            this.list.add(this.add
                .text(DW - 106, yy + 54, w.status, t(16, isPending ? TXT.gold : TXT.green))
                .setOrigin(0.5));
            yy += H + 12;
        });
        return yy + 20;
    }
    // ─────────────────────────────── actions
    refreshAll() {
        this.redraws.forEach((r) => r());
    }
    /** In-canvas keypad / text entry overlay (no DOM inputs needed). */
    promptAccount() {
        this.data.set('modal', true);
        const layer = this.add.container(0, 0).setDepth(900);
        const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x02040a, 0.9).setInteractive();
        layer.add(shade);
        const numeric = this.method.id === 'bank';
        const PW = DW - 60;
        const PH = numeric ? 720 : 620;
        const px = 30;
        const py = (DH - PH) / 2;
        const g = this.add.graphics();
        rr(g, px, py, PW, PH, 28, 0x101827, 1);
        rrs(g, px, py, PW, PH, 28, this.method.color, 3, 0.9);
        rr(g, px, py, PW, 84, 28, this.method.color, 1);
        g.fillStyle(this.method.color, 1);
        g.fillRect(px, py + 50, PW, 34);
        layer.add(g);
        layer.add(this.add
            .text(DW / 2, py + 42, this.method.name.toUpperCase() + ' DETAILS', {
            fontFamily: FONT_D,
            fontSize: '34px',
            color: '#ffffff',
        })
            .setOrigin(0.5)
            .setStroke('#00000055', 5));
        layer.add(this.add.text(DW / 2, py + 116, this.method.hint, t(17, TXT.dim)).setOrigin(0.5));
        let value = S.account[this.method.id] ?? '';
        const fieldG = this.add.graphics();
        layer.add(fieldG);
        const valTxt = this.add
            .text(DW / 2, py + 176, '', { fontFamily: FONT, fontSize: '26px', color: '#eaf1ff' })
            .setOrigin(0.5);
        layer.add(valTxt);
        const caret = this.add.rectangle(0, py + 176, 3, 30, 0x7bf0ae);
        layer.add(caret);
        this.tweens.add({ targets: caret, alpha: 0, duration: 480, yoyo: true, repeat: -1 });
        const drawField = () => {
            fieldG.clear();
            rr(fieldG, px + 26, py + 146, PW - 52, 62, 16, 0x070c16, 1);
            rrs(fieldG, px + 26, py + 146, PW - 52, 62, 16, value ? C.green : C.stroke, 2, 0.85);
            const shown = value || this.method.placeholder;
            valTxt.setText(shown.length > 26 ? '\u2026' + shown.slice(-25) : shown);
            valTxt.setColor(value ? '#eaf1ff' : '#546283');
            caret.setX(valTxt.x + valTxt.width / 2 + 8).setVisible(!!value);
        };
        drawField();
        // keypad
        const keys = numeric
            ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'DEL']
            : ['@', '.', '_', '-', 'CLR', 'DEL'];
        const kw = numeric ? (PW - 52 - 3 * 10) / 3 : (PW - 52 - 5 * 8) / 6;
        const kh = numeric ? 68 : 60;
        const ky = py + 236;
        keys.forEach((k, i) => {
            const col = numeric ? i % 3 : i;
            const rowI = numeric ? Math.floor(i / 3) : 0;
            const x = px + 26 + col * (kw + (numeric ? 10 : 8)) + kw / 2;
            const yy = ky + rowI * (kh + 10) + kh / 2;
            const isAct = k === 'CLR' || k === 'DEL';
            const b = new Btn(this, x, yy, {
                w: kw,
                h: kh,
                label: k === 'DEL' ? '\u232b' : k,
                color: isAct ? C.grey : C.panelLite,
                shadow: isAct ? 0x1b2436 : 0x0f1626,
                fontSize: numeric ? 26 : 22,
                radius: 14,
                onClick: () => {
                    if (k === 'CLR')
                        value = '';
                    else if (k === 'DEL')
                        value = value.slice(0, -1);
                    else if (value.length < 34)
                        value += k;
                    drawField();
                    save();
                },
            });
            layer.add(b);
        });
        // letters row for non-numeric (quick presets)
        const presetY = numeric ? ky + 4 * (kh + 10) + 6 : ky + kh + 24;
        if (!numeric) {
            const presets = this.method.id === 'paypal'
                ? ['gmail.com', 'yahoo.com', 'outlook.com']
                : this.method.id === 'upi'
                    ? ['@okaxis', '@okhdfcbank', '@paytm']
                    : ['TRC20', 'TX9f', 'USDT'];
            const pw2 = (PW - 52 - 2 * 10) / 3;
            presets.forEach((p, i) => {
                const b = new Btn(this, px + 26 + i * (pw2 + 10) + pw2 / 2, presetY + 30, {
                    w: pw2,
                    h: 58,
                    label: p,
                    color: C.blueDk,
                    shadow: 0x0c2a5c,
                    fontSize: 17,
                    radius: 14,
                    onClick: () => {
                        if (value.length < 30)
                            value += p;
                        drawField();
                    },
                });
                layer.add(b);
            });
        }
        // hidden DOM input so real keyboards work too
        const dom = document.createElement('input');
        dom.type = numeric ? 'tel' : 'text';
        dom.value = value;
        dom.style.cssText =
            'position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px;border:0;padding:0;';
        dom.maxLength = 34;
        document.body.appendChild(dom);
        const syncFromDom = () => {
            value = dom.value.slice(0, 34);
            drawField();
        };
        dom.addEventListener('input', syncFromDom);
        setTimeout(() => {
            try {
                dom.focus();
            }
            catch {
                /* ignore */
            }
        }, 120);
        const cleanup = () => {
            dom.removeEventListener('input', syncFromDom);
            dom.remove();
            layer.destroy();
            this.data.set('modal', false);
        };
        const kbHint = this.add
            .text(DW / 2, presetY + (numeric ? 6 : 76), 'You can also type with your keyboard', t(14, '#5d6b88'))
            .setOrigin(0.5);
        layer.add(kbHint);
        const saveBtn = new Btn(this, DW / 2, py + PH - 58, {
            w: PW - 52,
            h: 82,
            label: 'SAVE DETAILS',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 26,
            radius: 22,
            onClick: () => {
                const v = value.trim();
                if (v.length < 4) {
                    toast(this, 'Enter valid details', C.red);
                    return;
                }
                if (this.method.id === 'paypal' && !v.includes('@')) {
                    toast(this, 'E-mail must contain @', C.red);
                    return;
                }
                S.account[this.method.id] = v;
                save();
                sfx('confirm');
                toast(this, this.method.name + ' details saved', C.green);
                cleanup();
                this.refreshAll();
            },
        });
        layer.add(saveBtn);
        const cancel = this.add
            .text(DW / 2, py + PH + 34, 'Cancel', t(19, '#8ea1c2'))
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        cancel.on('pointerdown', () => {
            sfx('click');
            cleanup();
        });
        layer.add(cancel);
        layer.setAlpha(0);
        this.tweens.add({ targets: layer, alpha: 1, duration: 200 });
    }
    submit() {
        const amt = this.amount;
        if (S.cash < amt) {
            toast(this, 'Insufficient balance', C.red);
            return;
        }
        const acc = S.account[this.method.id];
        if (!acc) {
            this.promptAccount();
            return;
        }
        this.processing(amt, acc);
    }
    /** Bank-style processing overlay with staged status, then receipt. */
    processing(amt, acc) {
        this.data.set('modal', true);
        const layer = this.add.container(0, 0).setDepth(1000);
        const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x02040a, 0.94).setInteractive();
        layer.add(shade);
        const ring = this.add.graphics();
        layer.add(ring);
        const pctTxt = this.add
            .text(DW / 2, DH / 2 - 90, '0%', { fontFamily: FONT, fontSize: '40px', color: '#7bf0ae' })
            .setOrigin(0.5);
        layer.add(pctTxt);
        const title = this.add
            .text(DW / 2, DH / 2 + 60, 'PROCESSING PAYOUT', { fontFamily: FONT_D, fontSize: '42px', color: '#ffffff' })
            .setOrigin(0.5)
            .setStroke('#0b1020', 7);
        layer.add(title);
        const steps = [
            'Verifying account\u2026',
            'Checking balance\u2026',
            'Contacting ' + this.method.name + '\u2026',
            'Encrypting transfer\u2026',
            'Queuing payout\u2026',
        ];
        const stepTxt = this.add.text(DW / 2, DH / 2 + 116, steps[0], t(20, '#8ea1c2')).setOrigin(0.5);
        layer.add(stepTxt);
        const checkG = this.add.graphics();
        layer.add(checkG);
        let p = 0;
        let stepI = 0;
        const total = 2600;
        let elapsed = 0;
        const timer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                elapsed += 16;
                p = Phaser.Math.Clamp(elapsed / total, 0, 1);
                const cx = DW / 2;
                const cy = DH / 2 - 90;
                ring.clear();
                ring.lineStyle(14, 0x14243a, 1);
                ring.strokeCircle(cx, cy, 92);
                ring.lineStyle(14, 0x2fd074, 1);
                ring.beginPath();
                ring.arc(cx, cy, 92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false);
                ring.strokePath();
                pctTxt.setText(Math.round(p * 100) + '%');
                const si = Math.min(steps.length - 1, Math.floor(p * steps.length));
                if (si !== stepI) {
                    stepI = si;
                    stepTxt.setText(steps[si]);
                    sfx('click', 1.5, 0.4);
                    checkG.clear();
                    for (let k = 0; k < si; k++) {
                        checkG.fillStyle(0x2fd074, 1);
                        checkG.fillCircle(DW / 2 - 60 + k * 30, DH / 2 + 156, 7);
                    }
                }
                if (p >= 1) {
                    timer.remove();
                    layer.destroy();
                    this.completeWithdrawal(amt, acc);
                }
            },
        });
        layer.setAlpha(0);
        this.tweens.add({ targets: layer, alpha: 1, duration: 180 });
    }
    completeWithdrawal(amt, acc) {
        S.cash = Math.max(0, S.cash - amt);
        const w = {
            id: txnId(),
            amount: amt,
            method: this.method.id,
            methodName: this.method.name,
            account: acc,
            date: Date.now(),
            status: 'PENDING',
        };
        S.withdrawals.unshift(w);
        S.withdrawals = S.withdrawals.slice(0, 30);
        save();
        sfx('unlock', 0.9);
        this.receipt(w);
    }
    receipt(w) {
        this.data.set('modal', true);
        const layer = this.add.container(0, 0).setDepth(1100);
        const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x02040a, 0.93).setInteractive();
        layer.add(shade);
        const PW = DW - 76;
        const PH = 660;
        const px = 38;
        const py = (DH - PH) / 2;
        const g = this.add.graphics();
        rr(g, px, py, PW, PH, 28, 0x0f1626, 1);
        rrs(g, px, py, PW, PH, 28, C.green, 3, 0.85);
        g.fillStyle(0x11412d, 1);
        g.fillRoundedRect(px, py, PW, 150, { tl: 28, tr: 28, bl: 0, br: 0 });
        layer.add(g);
        // perforated bottom edge
        const perf = this.add.graphics();
        perf.fillStyle(0x02040a, 1);
        for (let i = 0; i < 16; i++)
            perf.fillCircle(px + 14 + i * ((PW - 28) / 15), py + PH, 9);
        layer.add(perf);
        // success tick
        const tick = this.add.graphics();
        tick.fillStyle(0x2fd074, 1);
        tick.fillCircle(DW / 2, py + 74, 44);
        tick.lineStyle(9, 0x0f1626, 1);
        tick.beginPath();
        tick.moveTo(DW / 2 - 20, py + 74);
        tick.lineTo(DW / 2 - 5, py + 90);
        tick.lineTo(DW / 2 + 22, py + 58);
        tick.strokePath();
        layer.add(tick);
        tick.setScale(0);
        this.tweens.add({ targets: tick, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.easeOut' });
        layer.add(this.add
            .text(DW / 2, py + 184, 'WITHDRAWAL REQUESTED', { fontFamily: FONT_D, fontSize: '38px', color: '#7bf0ae' })
            .setOrigin(0.5)
            .setStroke('#052018', 6));
        layer.add(this.add
            .text(DW / 2, py + 252, goldFull(w.amount), { fontFamily: FONT_D, fontSize: '76px', color: '#ffffff' })
            .setOrigin(0.5)
            .setStroke('#0b1020', 8));
        const rows = [
            ['Transaction ID', w.id],
            ['Method', w.methodName],
            ['Account', mask(w.account)],
            ['Fee', 'FREE'],
            ['You receive', goldFull(w.amount)],
            ['Status', w.status],
            ['Arrival', this.method.eta],
            ['Date', dateStr(w.date)],
        ];
        rows.forEach(([k, v], i) => {
            const yy = py + 316 + i * 34;
            layer.add(this.add.text(px + 30, yy, k, t(16, TXT.dim)).setOrigin(0, 0.5));
            layer.add(this.add
                .text(px + PW - 30, yy, v, t(17, i === 5 ? TXT.gold : i === 4 ? TXT.green : TXT.light))
                .setOrigin(1, 0.5));
        });
        const burst = this.add.particles(DW / 2, py + 74, 'spark', {
            speed: { min: 160, max: 480 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.7, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            quantity: 34,
            blendMode: 'ADD',
            tint: [0x2fd074, 0xffffff, 0x9df2ff],
            emitting: false,
        });
        layer.add(burst);
        burst.explode(38);
        this.cameras.main.flash(200, 120, 255, 190, false);
        const done = new Btn(this, DW / 2, py + PH + 66, {
            w: PW,
            h: 88,
            label: 'DONE',
            color: C.green,
            shadow: C.greenDk,
            fontSize: 30,
            radius: 24,
            onClick: () => {
                layer.destroy();
                this.scene.restart();
            },
        });
        layer.add(done);
        layer.setAlpha(0).setScale(0.95);
        this.tweens.add({ targets: layer, alpha: 1, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
    }
}

/* ==== src/scenes/SettingsPanel.ts ================================= */
class SettingsPanel extends Panel {
    constructor() {
        super('SettingsPanel');
        Object.defineProperty(this, "confirming", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    init() {
        this.headerColor = C.grey;
        this.titleText = 'SETTINGS';
        this.subtitleText = 'Audio \u00b7 progress \u00b7 about';
        this.sheetTop = 320;
        this.showWallet = false;
        this.closing = false;
    }
    create() {
        this.buildChrome();
        const y0 = this.contentTop;
        const c = this.add.container(0, y0).setDepth(2);
        // sound toggle
        const soundBtn = new Btn(this, DW / 2, 44, {
            w: DW - 80,
            h: 88,
            label: S.muted ? '\ud83d\udd07  SOUND: OFF' : '\ud83d\udd0a  SOUND: ON',
            color: S.muted ? C.greyDk : C.blue,
            shadow: S.muted ? 0x11182a : C.blueDk,
            fontSize: 26,
            radius: 22,
            onClick: () => {
                S.muted = !S.muted;
                setMuted(S.muted);
                save();
                soundBtn.setLabel(S.muted ? '\ud83d\udd07  SOUND: OFF' : '\ud83d\udd0a  SOUND: ON');
                soundBtn.setColorTheme(S.muted ? C.greyDk : C.blue);
                if (!S.muted)
                    sfx('click');
            },
        });
        c.add(soundBtn);
        // stats card
        const g = this.add.graphics();
        rr(g, 40, 108, DW - 80, 232, 24, 0x121b2c, 1);
        rrs(g, 40, 108, DW - 80, 232, 24, C.stroke, 2, 0.6);
        c.add(g);
        c.add(this.add.text(DW / 2, 140, 'YOUR PROGRESS', t(20, TXT.gold)).setOrigin(0.5));
        const rows = [
            ['Current level', 'Lv ' + fmt(S.level)],
            ['Rocks smashed', fmt(S.totalBroken)],
            ['Gold balance', goldFull(S.cash)],
            ['Withdrawals', String(S.withdrawals.length)],
        ];
        rows.forEach(([k, v], i) => {
            const yy = 182 + i * 40;
            c.add(this.add.text(70, yy, k, t(18, TXT.dim)).setOrigin(0, 0.5));
            c.add(this.add.text(DW - 70, yy, v, t(19, TXT.light)).setOrigin(1, 0.5));
        });
        // reset
        const reset = new Btn(this, DW / 2, 400, {
            w: DW - 80,
            h: 84,
            label: 'RESET PROGRESS',
            sub: 'Tap twice to confirm',
            color: C.red,
            shadow: C.redDk,
            fontSize: 25,
            subSize: 15,
            radius: 22,
            onClick: () => this.onReset(reset),
        });
        c.add(reset);
        c.add(this.add
            .text(DW / 2, 486, 'STONE TYCOON  \u00b7  v1.0', t(16, '#5d6b88'))
            .setOrigin(0.5));
        c.add(this.add
            .text(DW / 2, 520, 'Demo game. Ads and payouts are simulated for\nentertainment only \u2014 no real money is involved.', { ...t(14, '#4d5975'), align: 'center', lineSpacing: 4 })
            .setOrigin(0.5));
    }
    onReset(btn) {
        if (!this.confirming) {
            this.confirming = true;
            btn.setLabel('ARE YOU SURE?').setSub('This deletes everything');
            toast(this, 'Tap again to wipe save', C.red);
            this.time.delayedCall(3200, () => {
                if (!this.scene.isActive())
                    return;
                this.confirming = false;
                btn.setLabel('RESET PROGRESS').setSub('Tap twice to confirm');
            });
            return;
        }
        resetSave();
        save();
        sfx('break', 0.7);
        this.cameras.main.flash(200, 255, 80, 80, false);
        this.time.delayedCall(220, () => {
            this.game.events.emit('panel-closed');
            this.scene.stop();
            this.scene.stop('Game');
            this.scene.start('Title');
        });
    }
}

/* ==== src/main.ts ================================================= */
setMuted(S.muted);
applyAdminConfig(adminConfig());
window.addEventListener('stone-tycoon-config-updated', (e) => {
    applyAdminConfig(e.detail || adminConfig());
});
const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#05070d',
    width: DW,
    height: DH,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
        antialias: true,
        roundPixels: false,
        powerPreference: 'high-performance',
    },
    input: { activePointers: 3 },
    scene: [Boot, Title, Game, AdScene, MinersPanel, UpgradePanel, RewardsPanel, CashPanel, SettingsPanel],
});
// persist on tab hide / close
document.addEventListener('visibilitychange', () => {
    if (document.hidden)
        save();
});
window.addEventListener('pagehide', () => save());
var __default = game;

})();
