import Phaser from 'phaser';
import { sfx } from '../audio';
import { S, save } from '../save';
import { fmt, goldFull, clock } from '../format';
import {
  MINERS,
  minerDps,
  rockMaxHp,
  coinReward,
  cashReward,
  tierFor,
  zoneName,
  isBoss,
  adminConfig,
  getBossTime,
} from '../data';
import { Btn, Bar, C, TXT, FONT, FONT_D, t, rr, rrs, toast, lighten, hex } from '../ui';

export const DW = 720;
export const DH = 1280;

export function tapDamage(): number {
  return 0; // finger tap does not break stones; miners do the mining
}
export function totalDps(): number {
  let d = 0;
  for (let i = 0; i < MINERS.length; i++) if (S.unlocked[i]) d += minerDps(i, S.minerLevel[i]);
  return d * (boostActive() ? 2 : 1);
}
export function goldMult(): number {
  return 1 + S.goldLv * 0.14;
}
export function critChance(): number {
  return Math.min(0.6, 0.04 + S.luckLv * 0.022);
}
export function luckyChance(): number {
  return Math.min(0.4, 0.05 + S.luckLv * 0.018);
}
export function boostActive(): boolean {
  return Date.now() < S.boostUntil;
}

export class Game extends Phaser.Scene {
  // hud
  private coinTxt!: Phaser.GameObjects.Text;
  private gemTxt!: Phaser.GameObjects.Text;
  private cashTxt!: Phaser.GameObjects.Text;
  private levelTxt!: Phaser.GameObjects.Text;
  private zoneTxt!: Phaser.GameObjects.Text;
  private tierTxt!: Phaser.GameObjects.Text;
  private dpsTxt!: Phaser.GameObjects.Text;
  private hpTxt!: Phaser.GameObjects.Text;
  private hpBar!: Bar;
  private coinPillPos = new Phaser.Math.Vector2(0, 0);
  private cashBtn!: Btn;

  // rock
  private rock!: Phaser.GameObjects.Image;
  private rockPivot!: Phaser.GameObjects.Container;
  private rockGlow!: Phaser.GameObjects.Image;
  private cracks!: Phaser.GameObjects.Graphics;
  private rockShadow!: Phaser.GameObjects.Ellipse;
  private rockBaseScale = 1;
  private luckyAura?: Phaser.GameObjects.Image;

  // boss
  private bossBanner!: Phaser.GameObjects.Container;
  private bossTimerTxt!: Phaser.GameObjects.Text;
  private bossBar!: Bar;

  // miners
  private minerSprites: Array<Phaser.GameObjects.Image | null> = [];
  private minerLocks: Array<Phaser.GameObjects.Container | null> = [];
  private minerLvTxt: Array<Phaser.GameObjects.Text | null> = [];
  private swingAcc: number[] = [];

  // combo / boost
  private combo = 0;
  private comboTimer = 0;
  private comboTxt!: Phaser.GameObjects.Text;
  private comboRing!: Phaser.GameObjects.Graphics;
  private boostTxt!: Phaser.GameObjects.Text;
  private boostBg!: Phaser.GameObjects.Graphics;

  // fx
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shards!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;

  private displayCoins = 0;
  private saveAcc = 0;
  private panelOpen = false;
  private hitSoundAcc = 0;

  constructor() {
    super('Game');
  }

  create(): void {
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
  private buildBackground(): void {
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

  // ────────────────────────────────────────────── rock
  private ROCK_Y = 428;

  private buildRock(): void {
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
    this.rock.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.worldX, p.worldY));

    this.cracks = this.add.graphics();
    this.rockPivot.add([this.rock, this.cracks]);

    // big tap zone so the whole upper area registers taps
    const zone = this.add.zone(DW / 2, this.ROCK_Y, DW, 470).setInteractive();
    zone.setDepth(5);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.worldX, p.worldY));

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

  private refreshRock(instant = false): void {
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
    } else {
      this.luckyAura?.setVisible(false);
    }

    const boss = isBoss(S.level);
    this.bossBanner.setVisible(boss);
    this.bossBar.gfx.setVisible(boss);
    if (boss) {
      this.rock.setTint(0xffb0b0);
    } else {
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

  private drawCracks(): void {
    this.cracks.clear();
    const dmg = 1 - S.hp / S.maxHp;
    if (dmg < 0.14) return;
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

  // ────────────────────────────────────────────── miner row
  private MINER_Y = 742;

  private buildMinerRow(): void {
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

  private refreshMiners(): void {
    for (let i = 0; i < MINERS.length; i++) {
      const sp = this.minerSprites[i]!;
      const lock = this.minerLocks[i]!;
      const lv = this.minerLvTxt[i]!;
      const unlocked = S.unlocked[i];
      const hired = unlocked && S.minerLevel[i] > 0;
      sp.setVisible(true);
      if (hired) {
        sp.clearTint().setAlpha(1);
        lock.setVisible(false);
        lv.setText('Lv ' + S.minerLevel[i]).setColor(TXT.gold);
      } else if (unlocked) {
        sp.setTint(0x50607f).setAlpha(0.7);
        lock.setVisible(false);
        lv.setText('HIRE').setColor('#7bf0ae');
      } else {
        sp.setTint(0x0a0f1a).setAlpha(0.85);
        lock.setVisible(true);
        const txt = lock.getData('txt') as Phaser.GameObjects.Text;
        txt.setText(`${S.adProgress[i]}/${MINERS[i].adsRequired} AD`);
        lv.setText('LOCKED').setColor('#6d7c99');
      }
    }
  }

  // ────────────────────────────────────────────── HUD
  private buildHud(): void {
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

  private pill(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: number,
    stroke: number
  ): { g: Phaser.GameObjects.Graphics } {
    const g = this.add.graphics();
    rr(g, x, y, w, h, h / 2, fill, 0.95);
    rr(g, x + 3, y + 3, w - 6, h * 0.4, h / 2, 0xffffff, 0.06);
    rrs(g, x, y, w, h, h / 2, stroke, 2, 0.85);
    return { g };
  }

  // ────────────────────────────────────────────── bottom dock
  private buildDock(): void {
    const top = 848;
    const g = this.add.graphics().setDepth(40);
    rr(g, -10, top, DW + 20, DH - top + 20, 30, 0x080d18, 0.97);
    g.lineStyle(3, 0x2a3a5c, 0.9);
    g.lineBetween(0, top, DW, top);
    rr(g, 0, top, DW, 6, 3, 0x1c2a45, 0.6);

    const tabs: Array<[string, string, number, string]> = [
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
          if (i === 0) this.openPanel('MinersPanel');
          else if (i === 1) this.openPanel('UpgradePanel');
          else this.openPanel('RewardsPanel');
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
  private buildFx(): void {
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
  private onTap(x: number, y: number): void {
    if (this.panelOpen) return;
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

  private hitRock(dmg: number, crit: boolean, x: number, y: number, isTap: boolean): void {
    S.hp -= dmg;

    const tier = tierFor(S.level);
    this.dust.setParticleTint(tier.glow);
    this.dust.emitParticleAt(x, y, isTap ? 8 : 4);

    if (crit) this.sparkle.emitParticleAt(x, y, 12);

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

    if (crit) this.cameras.main.shake(120, 0.006);
    else if (isTap) this.cameras.main.shake(50, 0.0022);

    this.floatDamage(x, y, dmg, crit);

    if (isTap) {
      this.hitSoundAcc++;
      if (this.hitSoundAcc % 2 === 0 || crit) sfx('hit', crit ? 0.75 : Phaser.Math.FloatBetween(0.9, 1.35), crit ? 1 : 0.7);
    }

    this.drawCracks();
    this.hpBar.set(Math.max(0, S.hp) / S.maxHp);

    if (S.hp <= 0) this.breakRock();
  }

  private floatDamage(x: number, y: number, dmg: number, crit: boolean): void {
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
  private breakRock(): void {
    const lvl = S.level;
    const boss = isBoss(lvl);
    const luckMul = S.lucky ? 3 : 1;
    const coins = Math.floor(coinReward(lvl) * goldMult() * luckMul);
    let cash = cashReward(lvl) * luckMul;
    if (S.cash >= 600) cash *= 0.45; // after 600 GOLD, gold earning slows down
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

  private coinBurst(coins: number): void {
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

  private rewardBanner(coins: number, cash: number, gems: number, boss: boolean, lucky: boolean): void {
    const y = 300;
    const cont = this.add.container(DW / 2, y).setDepth(80);
    const label = boss ? 'BOSS DEFEATED!' : lucky ? 'LUCKY ROCK!' : 'ROCK SMASHED!';
    const col = boss ? '#ff8b8b' : lucky ? '#ffe066' : '#7bf0ae';
    const title = this.add
      .text(0, -34, label, { fontFamily: FONT_D, fontSize: '40px', color: col })
      .setOrigin(0.5)
      .setStroke('#0b1020', 7);
    let line = `+${fmt(coins)} coins   +${goldFull(cash)}`;
    if (gems > 0) line += `   +${gems} \ud83d\udc8e`;
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
  private offlineEarnings(): void {
    const away = (Date.now() - S.lastSeen) / 1000;
    if (away < 90) return;
    const dps = totalDps() / (boostActive() ? 2 : 1);
    if (dps <= 0) return;
    const capped = Math.min(away, 4 * 3600);
    // convert damage to approximate rocks broken -> coins
    const dmgTotal = dps * capped * 0.5;
    const perRock = rockMaxHp(S.level);
    const rocks = Math.floor(dmgTotal / Math.max(1, perRock));
    if (rocks < 1) return;
    const coins = Math.floor(coinReward(S.level) * goldMult() * rocks * 0.7);
    if (coins < 1) return;

    this.time.delayedCall(600, () => {
      S.coins += coins;
      S.totalCoins += coins;
      save();
      this.refreshHud();
      this.showOfflinePopup(capped, coins);
    });
  }

  private showOfflinePopup(sec: number, coins: number): void {
    const layer = this.add.container(0, 0).setDepth(3000);
    const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x03060e, 0.8).setInteractive();
    layer.add(shade);
    const g = this.add.graphics();
    rr(g, DW / 2 - 300, DH / 2 - 190, 600, 380, 28, 0x101827, 0.99);
    rrs(g, DW / 2 - 300, DH / 2 - 190, 600, 380, 28, C.gold, 3, 0.9);
    layer.add(g);
    layer.add(
      this.add.text(DW / 2, DH / 2 - 140, 'WELCOME BACK!', { fontFamily: FONT_D, fontSize: '46px', color: '#ffd76a' }).setOrigin(0.5)
    );
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    layer.add(
      this.add
        .text(DW / 2, DH / 2 - 88, `Your miners worked for ${h > 0 ? h + 'h ' : ''}${m}m`, t(21, TXT.dim))
        .setOrigin(0.5)
    );
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
  openPanel(key: string, data?: object): void {
    if (this.panelOpen) return;
    this.panelOpen = true;
    this.input.enabled = false;
    this.scene.launch(key, data ?? {});
    this.scene.bringToTop(key);
  }

  private onPanelClosed(): void {
    this.panelOpen = false;
    this.input.enabled = true;
    this.refreshMiners();
    this.refreshHud();
    this.refreshRock();
  }

  refreshHud(): void {
    this.gemTxt.setText(fmt(S.gems));
    this.cashTxt.setText(goldFull(S.cash));
    this.cashBtn?.setSub(
      S.cash >= 1230 ? `${goldFull(S.cash)} \u00b7 ready` : `${goldFull(S.cash)} available`
    );
  }

  // ────────────────────────────────────────────── loop
  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // animated coin counter
    if (this.displayCoins !== S.coins) {
      const diff = S.coins - this.displayCoins;
      this.displayCoins += diff * Math.min(1, dt * 8);
      if (Math.abs(S.coins - this.displayCoins) < 1) this.displayCoins = S.coins;
    }
    this.coinTxt.setText(fmt(this.displayCoins));

    this.hpBar.tick(delta);
    this.hpTxt.setText(fmt(Math.max(0, S.hp)) + ' / ' + fmt(S.maxHp));

    const dps = totalDps();
    this.dpsTxt.setText(
      `\u26a1 ${fmt(dps)} DPS    MINERS MINE ONLY` + (boostActive() ? '    \u00d72 BOOST' : '')
    );

    // ---- miner auto-swings ----
    if (!this.panelOpen) {
      for (let i = 0; i < MINERS.length; i++) {
        if (!S.unlocked[i] || S.minerLevel[i] <= 0) continue;
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
      if (S.bossTime <= 0) this.bossFail();
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
    } else {
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

  private doSwing(i: number, period: number): void {
    const sp = this.minerSprites[i];
    if (!sp) return;
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
    if (dmg <= 0) return;

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
        if (this.panelOpen) return;
        this.dust.setParticleTint(tier.glow);
        this.dust.emitParticleAt(hx, hy, 3);
        this.applyMinerDamage(dmg, hx, hy);
      },
    });
  }

  private applyMinerDamage(dmg: number, x: number, y: number): void {
    S.hp -= dmg;
    this.hpBar.set(Math.max(0, S.hp) / S.maxHp);
    if (Math.random() < 0.35) this.floatDamage(x, y, dmg, false);
    this.rock.setScale(this.rockBaseScale * 1.02, this.rockBaseScale * 0.985);
    this.tweens.add({
      targets: this.rock,
      scaleX: this.rockBaseScale,
      scaleY: this.rockBaseScale,
      duration: 110,
      ease: 'Sine.easeOut',
    });
    this.drawCracks();
    if (S.hp <= 0) this.breakRock();
  }

  private bossFail(): void {
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
