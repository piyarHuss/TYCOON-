import Phaser from 'phaser';
import WebFont from 'webfontloader';
import { MINERS, TIERS } from '../data';
import { C, rr, rrs } from '../ui';
import { asset } from '../assets';

export class Boot extends Phaser.Scene {
  private barG!: Phaser.GameObjects.Graphics;
  private pct = 0;
  private shown = 0;
  private label!: Phaser.GameObjects.Text;
  private fontsDone = false;
  private filesDone = false;

  constructor() {
    super('Boot');
  }

  preload(): void {
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

    this.load.on('progress', (v: number) => {
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

  create(): void {
    this.makeTextures();
  }

  update(_time: number, delta: number): void {
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
      if (splash) splash.remove();
      this.scene.start('Title');
    }
  }

  /** Procedural textures used for glows / crack overlays. */
  private makeTextures(): void {
    try {
      this.buildProceduralTextures();
    } catch {
      // Canvas-texture upload can fail on exotic/headless renderers; the game
      // still runs (these are decorative glow/spark textures only).
    }
  }

  private buildProceduralTextures(): void {
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
