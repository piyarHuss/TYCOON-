import Phaser from 'phaser';
import { sfx } from '../audio';
import { S, save } from '../save';
import { fmt } from '../format';
import { tapCost, goldCost, luckCost } from '../data';
import { Btn, C, TXT, t, rr, rrs, toast, attachScroll } from '../ui';
import { Panel } from './Panel';
import { DW, DH } from './Game';
import { tapDamage, goldMult, critChance, luckyChance } from './Game';

interface UpRow {
  key: 'tap' | 'gold' | 'luck';
  name: string;
  icon: string;
  color: number;
  shadow: number;
  desc: () => string;
  effect: () => string;
  next: () => string;
  level: () => number;
  cost: () => number;
  apply: () => void;
  maxLv?: number;
}

export class UpgradePanel extends Panel {
  private rows: Array<() => void> = [];

  constructor() {
    super('UpgradePanel');
  }

  init(): void {
    this.headerColor = C.gold;
    this.titleText = 'UPGRADES';
    this.subtitleText = 'Spend coins to mine faster & richer';
    this.sheetTop = 150;
    this.closing = false;
    this.rows = [];
  }

  create(): void {
    this.buildChrome();

    const defs: UpRow[] = [
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
        next: () =>
          Math.round(Math.min(0.6, 0.04 + (S.luckLv + 1) * 0.022) * 100) +
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
    const stats: Array<[string, string]> = [
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

  private buildRow(list: Phaser.GameObjects.Container, d: UpRow, y: number, H: number): void {
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

    const redraw = (): void => {
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

  private refreshAll(): void {
    this.rows.forEach((r) => r());
    this.refreshWallet();
  }
}
