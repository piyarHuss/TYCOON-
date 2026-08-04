import Phaser from 'phaser';
import { sfx } from '../audio';
import { S, save } from '../save';
import { fmt } from '../format';
import { MINERS, minerCost, minerDps } from '../data';
import { Btn, C, TXT, FONT, FONT_D, t, rr, rrs, toast, attachScroll, lighten, hex } from '../ui';
import { Panel } from './Panel';
import { DW, DH } from './Game';

const ROW_H = 178;
const GAP = 14;

export class MinersPanel extends Panel {
  private list!: Phaser.GameObjects.Container;
  private rowRefs: Array<{
    redraw: () => void;
  }> = [];

  constructor() {
    super('MinersPanel');
  }

  init(): void {
    this.headerColor = C.blue;
    this.titleText = 'MINER CREW';
    this.subtitleText = 'Hire & upgrade \u00b7 they mine automatically';
    this.sheetTop = 130;
    this.closing = false;
    this.rowRefs = [];
  }

  create(): void {
    this.buildChrome();

    const vy = this.contentTop;
    const vh = DH - vy - 24;
    this.list = this.add.container(0, vy).setDepth(2);

    MINERS.forEach((_, i) => this.buildRow(i, i * (ROW_H + GAP)));

    const contentH = MINERS.length * (ROW_H + GAP) + 20;
    attachScroll(this, this.list, 0, vy, DW, vh, contentH);
  }

  private buildRow(i: number, y: number): void {
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

    const redraw = (): void => {
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
      } else {
        dpsTxt.setText('\u26a1 ' + fmt(m.baseDps) + ' DPS at Lv 1');
        progTxt.setText(`\ud83d\udcfa  Ads watched  ${got} / ${need}`);
        // ad progress pips
        progG.clear();
        for (let k = 0; k < need; k++) {
          const px = 178 + k * 30;
          const py = y + 146;
          if (k < got) {
            rr(progG, px, py, 24, 10, 5, C.gold, 1);
          } else {
            rr(progG, px, py, 24, 10, 5, 0x2a3550, 1);
          }
        }
        mainBtn.setVisible(true);
        if (adsDone) {
          mainBtn.setLabel('UNLOCK').setSub(fmt(m.baseCost) + ' coins');
          mainBtn.setColorTheme(C.gold);
          mainBtn.setEnabled(S.coins >= m.baseCost);
        } else {
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

  private refreshAll(): void {
    this.rowRefs.forEach((r) => r.redraw());
    this.refreshWallet();
  }

  private onAction(i: number): void {
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
      if (!ok) return;
      S.adProgress[i] = Math.min(need, S.adProgress[i] + 1);
      save();
      sfx('unlock', 1.2);
      const left = need - S.adProgress[i];
      toast(this, left > 0 ? `Ad complete! ${left} more for ${m.name}` : `${m.name} ready to unlock!`, C.gold);
      this.refreshAll();
    });
  }

  private buyWithGems(i: number): void {
    const m = MINERS[i];
    if (S.gems < m.gemCost) {
      toast(this, 'Not enough gems', C.red);
      return;
    }
    S.gems -= m.gemCost;
    S.adProgress[i] = m.adsRequired;
    this.doUnlock(i);
  }

  private doUnlock(i: number): void {
    const m = MINERS[i];
    S.unlocked[i] = true;
    S.minerLevel[i] = Math.max(1, S.minerLevel[i]);
    save();
    sfx('unlock', 0.9);
    this.unlockFx(m.name, m.key, m.tint);
    this.refreshAll();
  }

  private unlockFx(name: string, key: string, tint: number): void {
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
