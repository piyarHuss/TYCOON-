import { MINERS, rockMaxHp } from './data';

export interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  methodName: string;
  account: string;
  date: number;
  status: string;
}

export interface GameState {
  coins: number;
  gems: number;
  cash: number;
  level: number;
  hp: number;
  maxHp: number;
  lucky: boolean;
  bossTime: number;
  tapLv: number;
  goldLv: number;
  luckLv: number;
  minerLevel: number[];
  unlocked: boolean[];
  adProgress: number[];
  adsWatched: number;
  totalBroken: number;
  bestLevel: number;
  totalCoins: number;
  boostUntil: number;
  muted: boolean;
  account: Record<string, string>;
  lastMethod: string;
  withdrawals: Withdrawal[];
  lastSeen: number;
  intro: boolean;
}

const KEY = 'stone_tycoon_save_v1';

function fresh(): GameState {
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

function load(): GameState {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<GameState>;
    const s: GameState = { ...base, ...p };
    // array integrity
    s.minerLevel = MINERS.map((_, i) => (Array.isArray(p.minerLevel) ? Number(p.minerLevel[i]) || 0 : base.minerLevel[i]));
    s.unlocked = MINERS.map((_, i) => (Array.isArray(p.unlocked) ? !!p.unlocked[i] : base.unlocked[i]));
    s.adProgress = MINERS.map((_, i) => (Array.isArray(p.adProgress) ? Number(p.adProgress[i]) || 0 : 0));
    s.unlocked[0] = true;
    if (s.minerLevel[0] < 1) s.minerLevel[0] = 1;
    s.withdrawals = Array.isArray(p.withdrawals) ? p.withdrawals.slice(0, 30) : [];
    s.account = typeof p.account === 'object' && p.account ? p.account : {};
    s.level = Math.max(1, Math.floor(s.level));
    s.maxHp = rockMaxHp(s.level);
    if (!isFinite(s.hp) || s.hp <= 0 || s.hp > s.maxHp) s.hp = s.maxHp;
    s.coins = Math.max(0, s.coins || 0);
    s.gems = Math.max(0, s.gems || 0);
    s.cash = Math.max(0, s.cash || 0);
    return s;
  } catch {
    return base;
  }
}

export const S: GameState = load();

export function save(): void {
  try {
    S.lastSeen = Date.now();
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* quota / private mode */
  }
}

export function resetSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  Object.assign(S, fresh());
}
