import { Howl, Howler } from 'howler';
import { asset } from './assets';

export type SfxKey = 'click' | 'hit' | 'coin' | 'break' | 'unlock' | 'confirm';

const DEFS: Record<SfxKey, { src: string[]; vol: number }> = {
  click: { src: [asset('/sfx/click.wav')], vol: 0.45 },
  hit: { src: [asset('/sfx/hit.ogg')], vol: 0.5 },
  coin: { src: [asset('/sfx/coin.ogg')], vol: 0.4 },
  break: { src: [asset('/sfx/break.ogg')], vol: 0.55 },
  unlock: { src: [asset('/sfx/unlock.wav')], vol: 0.6 },
  confirm: { src: [asset('/sfx/confirm.wav')], vol: 0.55 },
};

const pool: Partial<Record<SfxKey, Howl>> = {};
let ready = false;
let muted = false;

/** Must be called from inside a user-gesture handler. */
export function initAudio(): void {
  if (ready) return;
  ready = true;
  (Object.keys(DEFS) as SfxKey[]).forEach((k) => {
    const ext = DEFS[k].src[0].indexOf('data:audio/wav') === 0 || /\.wav($|\?)/.test(DEFS[k].src[0]) ? 'wav' : 'ogg';
    pool[k] = new Howl({ src: DEFS[k].src, format: [ext], volume: DEFS[k].vol, preload: true, html5: false });
  });
  Howler.volume(0.9);
  Howler.mute(muted);
}

export function sfx(key: SfxKey, rate = 1, volScale = 1): void {
  if (!ready || muted) return;
  const h = pool[key];
  if (!h) return;
  try {
    const id = h.play();
    h.rate(Math.max(0.5, Math.min(3, rate)), id);
    h.volume(DEFS[key].vol * volScale, id);
  } catch {
    /* audio best-effort */
  }
}

export function setMuted(m: boolean): void {
  muted = m;
  if (ready) Howler.mute(m);
}

export function isAudioReady(): boolean {
  return ready;
}
