export interface MinerDef {
  id: number;
  name: string;
  title: string;
  key: string;
  baseDps: number;
  baseCost: number;
  adsRequired: number;
  gemCost: number;
  tint: number;
  swing: number; // ms between swings
}



// ---- Admin / Firebase live tuning ----
// Admin panel writes this JSON to Firestore and the game mirrors it into
// localStorage. All economy functions read it live, so reward amounts and
// difficulty can be changed without rebuilding the game.
export interface AdminGameConfig {
  enabled?: boolean;
  rockHpMultiplier?: number;
  coinRewardMultiplier?: number;
  cashRewardMultiplier?: number;
  tapDamageMultiplier?: number;
  minerDpsMultiplier?: number;
  minerCostMultiplier?: number;
  adCashReward?: number;
  adGemReward?: number;
  boostSeconds?: number;
  minWithdraw?: number;
  bossTime?: number;
  miners?: Array<Partial<MinerDef>>;
}

const ADMIN_CONFIG_KEY = 'stone_tycoon_admin_config_v1';
const DEFAULT_ADMIN_CONFIG: Required<Omit<AdminGameConfig, 'miners'>> = {
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

export function adminConfig(): Required<Omit<AdminGameConfig, 'miners'>> & { miners?: Array<Partial<MinerDef>> } {
  try {
    const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_ADMIN_CONFIG };
    const parsed = JSON.parse(raw) as AdminGameConfig;
    return { ...DEFAULT_ADMIN_CONFIG, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_ADMIN_CONFIG };
  }
}

function num(v: unknown, fallback: number, min = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

export function applyAdminConfig(cfg: AdminGameConfig): void {
  const clean: AdminGameConfig = { ...(cfg || {}) };
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
      if (!m || !MINERS[i]) return;
      const patch: Partial<MinerDef> = {};
      if (typeof m.name === 'string' && m.name.trim()) patch.name = m.name.trim();
      if (typeof m.title === 'string' && m.title.trim()) patch.title = m.title.trim();
      if (m.baseDps != null) patch.baseDps = num(m.baseDps, MINERS[i].baseDps, 0);
      if (m.baseCost != null) patch.baseCost = num(m.baseCost, MINERS[i].baseCost, 0);
      if (m.adsRequired != null) patch.adsRequired = Math.floor(num(m.adsRequired, MINERS[i].adsRequired, 0));
      if (m.gemCost != null) patch.gemCost = Math.floor(num(m.gemCost, MINERS[i].gemCost, 0));
      if (m.swing != null) patch.swing = Math.floor(num(m.swing, MINERS[i].swing, 100));
      Object.assign(MINERS[i], patch);
      clean.miners![i] = { ...clean.miners![i], ...patch };
    });
  }

  try {
    localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(clean));
  } catch {
    // ignore quota/private-mode failures
  }
}

export function getAdCashReward(): number { return adminConfig().adCashReward; }
export function getAdGemReward(): number { return Math.floor(adminConfig().adGemReward); }
export function getBoostSeconds(): number { return Math.floor(adminConfig().boostSeconds); }
export function getMinWithdraw(): number { return adminConfig().minWithdraw; }
export function getBossTime(): number { return Math.floor(adminConfig().bossTime); }


export const MINERS: MinerDef[] = [
  { id: 0, name: 'PICKY',  title: 'Rookie Miner',  key: 'miner1', baseDps: 1.4,    baseCost: 60,      adsRequired: 0, gemCost: 0,   tint: 0x4ea8ff, swing: 900 },
  { id: 1, name: 'BRUNO',  title: 'Veteran Digger',key: 'miner2', baseDps: 6,      baseCost: 520,     adsRequired: 1, gemCost: 25,  tint: 0xffa43d, swing: 1000 },
  { id: 2, name: 'GRIMM',  title: 'Forge Dwarf',   key: 'miner3', baseDps: 27,     baseCost: 4400,    adsRequired: 2, gemCost: 60,  tint: 0xff5d5d, swing: 1150 },
  { id: 3, name: 'DRIL-9', title: 'Mining Droid',  key: 'miner4', baseDps: 120,    baseCost: 36000,   adsRequired: 3, gemCost: 140, tint: 0x3ddc97, swing: 700 },
  { id: 4, name: 'NOVA',   title: 'Plasma Cutter', key: 'miner5', baseDps: 540,    baseCost: 290000,  adsRequired: 4, gemCost: 320, tint: 0xc46bff, swing: 820 },
  { id: 5, name: 'MIDAS',  title: 'The Gold King', key: 'miner6', baseDps: 2400,   baseCost: 2500000, adsRequired: 5, gemCost: 750, tint: 0xffd23d, swing: 1000 },
];

export interface RockTier {
  name: string;
  key: string;
  color: number;
  glow: number;
  css: string;
}

export const TIERS: RockTier[] = [
  { name: 'GRANITE',  key: 'rock_stone',    color: 0x9aa3b0, glow: 0xc8d2e0, css: '#c8d2e0' },
  { name: 'COPPER',   key: 'rock_copper',   color: 0xd07a3a, glow: 0xffb072, css: '#ffb072' },
  { name: 'IRON',     key: 'rock_iron',     color: 0x8f9bab, glow: 0xd7e2f0, css: '#d7e2f0' },
  { name: 'GOLD',     key: 'rock_gold',     color: 0xe8b52c, glow: 0xffe680, css: '#ffe680' },
  { name: 'DIAMOND',  key: 'rock_diamond',  color: 0x3fc6f0, glow: 0x9df2ff, css: '#9df2ff' },
  { name: 'OBSIDIAN', key: 'rock_obsidian', color: 0xa03df0, glow: 0xf07dff, css: '#f07dff' },
];

export function tierFor(level: number): RockTier {
  return TIERS[Math.floor((level - 1) / 5) % TIERS.length];
}

export function zoneName(level: number): string {
  const z = Math.floor((level - 1) / 10) + 1;
  return 'DEPTH ' + z;
}

export function isBoss(level: number): boolean {
  return level % 10 === 0;
}

export const BOSS_TIME = 30; // fallback seconds

export function rockMaxHp(level: number): number {
  const base = 10 * Math.pow(1.152, level - 1) + level * 5;
  return Math.max(8, Math.floor((isBoss(level) ? base * 6.5 : base) * adminConfig().rockHpMultiplier));
}

export function coinReward(level: number): number {
  const base = 14 * Math.pow(1.146, level - 1) + level * 3;
  return Math.max(4, Math.floor((isBoss(level) ? base * 9 : base) * adminConfig().coinRewardMultiplier));
}

export function cashReward(level: number): number {
  // Withdrawable GOLD. Early levels give visible gold, but the game slows
  // gold earnings after the player has 600+ gold (applied in Game.breakRock).
  const base = 22 + level * 4.5 + Math.pow(1.08, level) * 3;
  return (isBoss(level) ? base * 5 : base) * adminConfig().cashRewardMultiplier;
}

// ---- Global upgrades ----
export function tapCost(lv: number): number {
  return Math.floor(30 * Math.pow(1.3, lv - 1));
}
export function goldCost(lv: number): number {
  return Math.floor(320 * Math.pow(1.42, lv));
}
export function luckCost(lv: number): number {
  return Math.floor(850 * Math.pow(1.48, lv));
}

export function minerCost(i: number, level: number): number {
  return Math.floor(MINERS[i].baseCost * Math.pow(1.185, Math.max(0, level)) * adminConfig().minerCostMultiplier);
}
export function minerDps(i: number, level: number): number {
  if (level <= 0) return 0;
  return MINERS[i].baseDps * level * (1 + 0.022 * level) * adminConfig().minerDpsMultiplier;
}

// ---- Withdrawal ----
export interface PayoutMethod {
  id: string;
  name: string;
  short: string;
  color: number;
  hint: string;
  placeholder: string;
  eta: string;
  fee: number;
}

export const PAYOUTS: PayoutMethod[] = [
  { id: 'paypal', name: 'PayPal',  short: 'PP',  color: 0x0b7ec4, hint: 'PayPal e-mail address', placeholder: 'you@email.com',   eta: 'within 24 hours', fee: 0 },
  { id: 'upi',    name: 'UPI',     short: 'UPI', color: 0x12a05c, hint: 'UPI ID / VPA',          placeholder: 'name@okbank',     eta: 'within 2 hours',  fee: 0 },
  { id: 'bank',   name: 'Bank',    short: 'BNK', color: 0x5b6bd6, hint: 'Bank account number',   placeholder: '0000 0000 0000',  eta: '3 - 5 business days', fee: 0.5 },
  { id: 'crypto', name: 'Crypto',  short: 'USDT',color: 0xd98014, hint: 'USDT (TRC-20) wallet',  placeholder: 'TX9f\u2026wallet',     eta: 'within 1 hour',   fee: 1 },
];

export const AMOUNTS = [1230, 4230, 7230, 10000, 20000];
export const MIN_WITHDRAW = 1230;
export const AD_CASH_REWARD = 75; // GOLD reward from ads
export const AD_GEM_REWARD = 12;
export const BOOST_SECONDS = 60;

export interface FakeAd {
  app: string;
  tag: string;
  sprite: string;
  c1: number;
  c2: number;
  cta: string;
  rating: string;
}

export const FAKE_ADS: FakeAd[] = [
  { app: 'COIN MASTER RUSH',  tag: 'Spin \u00b7 Raid \u00b7 Build your empire',  sprite: 'cash',         c1: 0xff8a3d, c2: 0xd6215f, cta: 'INSTALL',   rating: '4.7 \u2605  \u00b7  50M+ installs' },
  { app: 'GEM LEGENDS SAGA',  tag: 'Match 3 gems \u00b7 5000 levels free',      sprite: 'gem',          c1: 0x7a3dff, c2: 0x1fb6ff, cta: 'PLAY FREE', rating: '4.9 \u2605  \u00b7  120M+ installs' },
  { app: 'ROBO WARS 3D',      tag: 'Build. Battle. Dominate the arena.', sprite: 'miner4',       c1: 0x1470d6, c2: 0x00c39a, cta: 'DOWNLOAD',  rating: '4.5 \u2605  \u00b7  8M+ installs' },
  { app: 'DIAMOND DIGGER PRO',tag: 'Dig deep \u00b7 Get rich \u00b7 Cash out daily',  sprite: 'rock_diamond', c1: 0x00a6e0, c2: 0x2b3df0, cta: 'GET NOW',   rating: '4.8 \u2605  \u00b7  22M+ installs' },
];
