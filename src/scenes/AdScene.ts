import Phaser from 'phaser';
import { sfx } from '../audio';
import { FAKE_ADS } from '../data';
import { C, TXT, FONT, FONT_D, t, rr, rrs, lighten } from '../ui';
import { DW, DH } from './Game';

interface AdData {
  reason: string;
  done: (ok: boolean) => void;
}

const AD_SECONDS = 5;

/** Simulated rewarded-video ad: 5s countdown, skip-after-3s, fake install CTA. */
export class AdScene extends Phaser.Scene {
  private req!: AdData;
  private left = AD_SECONDS;
  private ring!: Phaser.GameObjects.Graphics;
  private ringTxt!: Phaser.GameObjects.Text;
  private skipBtnG!: Phaser.GameObjects.Graphics;
  private skipTxt!: Phaser.GameObjects.Text;
  private finished = false;
  private progressG!: Phaser.GameObjects.Graphics;

  constructor() {
    super('AdScene');
  }

  init(d: AdData): void {
    this.req = d;
    this.left = AD_SECONDS;
    this.finished = false;
  }

  create(): void {
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
      g.fillCircle(
        Phaser.Math.Between(0, DW),
        Phaser.Math.Between(0, DH),
        Phaser.Math.Between(40, 190)
      );
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
    cta.add(
      this.add.text(0, 0, ad.cta, { fontFamily: FONT, fontSize: '32px', color: '#12172a' }).setOrigin(0.5)
    );
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
      if (this.left > AD_SECONDS - 3) return;
      sfx('click');
      this.finish(true);
    });

    // bottom progress bar
    this.progressG = this.add.graphics().setDepth(6);

    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  update(_t: number, delta: number): void {
    if (this.finished) return;
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

    if (this.left <= 0) this.finish(true);
  }

  private finish(ok: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const cb = this.req.done;
      this.scene.stop();
      cb(ok);
    });
  }
}
