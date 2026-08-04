import Phaser from 'phaser';
import { sfx } from './audio';

export const FONT = 'RussoOne';
export const FONT_D = 'Bangers';

export const C = {
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

export const TXT = {
  light: '#eaf1ff',
  dim: '#8ea1c2',
  gold: '#ffd76a',
  green: '#7bf0ae',
  red: '#ff8b8b',
  dark: '#0b1020',
};

export function t(
  size: number,
  color: string = TXT.light,
  family: string = FONT
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: family, fontSize: `${size}px`, color };
}

export function rr(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: number,
  alpha = 1
): void {
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x, y, w, h, Math.max(0, Math.min(r, Math.min(w, h) / 2)));
}

export function rrs(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: number,
  width = 2,
  alpha = 1
): void {
  g.lineStyle(width, color, alpha);
  g.strokeRoundedRect(x, y, w, h, Math.max(0, Math.min(r, Math.min(w, h) / 2)));
}

/** Card with bevel + border, drawn centred on (0,0) of its own graphics. */
export function card(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; stroke?: number; radius?: number; alpha?: number } = {}
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const fill = opts.fill ?? C.panel;
  const st = opts.stroke ?? C.stroke;
  const r = opts.radius ?? 20;
  rr(g, -w / 2, -h / 2, w, h, r, fill, opts.alpha ?? 1);
  rr(g, -w / 2 + 3, -h / 2 + 3, w - 6, h * 0.42, r - 4, 0xffffff, 0.045);
  rrs(g, -w / 2, -h / 2, w, h, r, st, 2, 0.9);
  return g;
}

export interface BtnOpts {
  w: number;
  h: number;
  label: string;
  sub?: string;
  color?: number;
  shadow?: number;
  textColor?: string;
  subColor?: string;
  fontSize?: number;
  subSize?: number;
  icon?: string;
  iconSize?: number;
  radius?: number;
  onClick: () => void;
  enabled?: boolean;
  sound?: boolean;
}

export class Btn extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private face: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Text;
  private subText?: Phaser.GameObjects.Text;
  private iconImg?: Phaser.GameObjects.Image;
  private o: BtnOpts;
  private enabled = true;
  private downY = 0;
  private downX = 0;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, o: BtnOpts) {
    super(scene, x, y);
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
        .text(0, h * 0.24, o.sub!, t(o.subSize ?? Math.round(h * 0.21), o.subColor ?? TXT.dim))
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

    this.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled) return;
      this.downY = p.y;
      this.downX = p.x;
      this.pressed = true;
      this.face.setY(4);
      this.redraw(true);
    });
    this.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.pressed) return;
      this.pressed = false;
      this.face.setY(0);
      this.redraw(false);
      if (!this.enabled) return;
      if (Math.abs(p.y - this.downY) > 16 || Math.abs(p.x - this.downX) > 16) return;
      if (o.sound !== false) sfx('click', 1 + (Math.random() * 0.1 - 0.05));
      o.onClick();
    });
    this.on('pointerout', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.face.setY(0);
      this.redraw(false);
    });

    this.setEnabled(o.enabled !== false);
    scene.add.existing(this);
  }

  private layoutIcon(): void {
    if (!this.iconImg) return;
    const lw = this.label.width;
    const s = this.iconImg.displayWidth;
    const total = lw + s + 14;
    this.iconImg.setX(-total / 2 + s / 2);
    this.label.setX(total / 2 - lw / 2);
  }

  private redraw(down: boolean): void {
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

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.label.setAlpha(v ? 1 : 0.45);
    this.subText?.setAlpha(v ? 1 : 0.4);
    this.iconImg?.setAlpha(v ? 1 : 0.35);
    this.redraw(false);
    return this;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setLabel(s: string): this {
    this.label.setText(s);
    this.layoutIcon();
    return this;
  }

  setSub(s: string): this {
    if (this.subText) this.subText.setText(s);
    return this;
  }

  setColorTheme(color: number): this {
    this.o.color = color;
    this.redraw(false);
    return this;
  }

  pop(scale = 1.07): this {
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

export function darken(c: number, f: number): number {
  const r = Math.max(0, Math.floor(((c >> 16) & 255) * (1 - f)));
  const g = Math.max(0, Math.floor(((c >> 8) & 255) * (1 - f)));
  const b = Math.max(0, Math.floor((c & 255) * (1 - f)));
  return (r << 16) | (g << 8) | b;
}

export function lighten(c: number, f: number): number {
  const r = Math.min(255, Math.floor(((c >> 16) & 255) + 255 * f));
  const g = Math.min(255, Math.floor(((c >> 8) & 255) + 255 * f));
  const b = Math.min(255, Math.floor((c & 255) + 255 * f));
  return (r << 16) | (g << 8) | b;
}

export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

/** Rounded progress bar. */
export class Bar {
  private g: Phaser.GameObjects.Graphics;
  private ratio = 0;
  private shown = 0;
  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
    private color: number,
    private bgColor = 0x0a1120
  ) {
    this.g = scene.add.graphics();
  }
  setColor(c: number): void {
    this.color = c;
  }
  set(r: number, instant = false): void {
    this.ratio = Phaser.Math.Clamp(r, 0, 1);
    if (instant) this.shown = this.ratio;
  }
  get gfx(): Phaser.GameObjects.Graphics {
    return this.g;
  }
  setPos(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
  tick(dt: number): void {
    this.shown += (this.ratio - this.shown) * Math.min(1, dt * 0.014);
    if (Math.abs(this.ratio - this.shown) < 0.0015) this.shown = this.ratio;
    this.draw();
  }
  draw(): void {
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
  destroy(): void {
    this.g.destroy();
  }
}

export function toast(scene: Phaser.Scene, msg: string, color: number = C.gold): void {
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
export function attachScroll(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
  contentH: number
): void {
  const shape = scene.make.graphics({});
  shape.fillStyle(0xffffff);
  shape.fillRoundedRect(vx, vy, vw, vh, 16);
  container.setMask(shape.createGeometryMask());

  const top = container.y;
  const min = top - Math.max(0, contentH - vh);
  let dragging = false;
  let last = 0;
  let vel = 0;

  const blocked = (): boolean => scene.data.get('modal') === true;
  const inside = (p: Phaser.Input.Pointer): boolean =>
    p.x >= vx && p.x <= vx + vw && p.y >= vy && p.y <= vy + vh;

  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (blocked() || !inside(p)) return;
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
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (!dragging || !p.isDown) return;
    const dy = p.y - last;
    last = p.y;
    vel = dy;
    container.y = Phaser.Math.Clamp(container.y + dy, min, top);
  });
  scene.input.on(
    'wheel',
    (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (blocked() || !inside(p)) return;
      container.y = Phaser.Math.Clamp(container.y - dy * 0.6, min, top);
    }
  );
  scene.events.on('update', () => {
    if (dragging || Math.abs(vel) < 0.4) return;
    vel *= 0.9;
    container.y = Phaser.Math.Clamp(container.y + vel, min, top);
  });
  scene.events.once('shutdown', () => shape.destroy());
}
