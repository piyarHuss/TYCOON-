import Phaser from 'phaser';
import { sfx } from '../audio';
import { S, save } from '../save';
import { fmt, goldFull, clock } from '../format';
import { coinReward, getAdCashReward, getAdGemReward, getBoostSeconds } from '../data';
import { Btn, C, TXT, t, rr, rrs, toast, attachScroll } from '../ui';
import { Panel } from './Panel';
import { DW, DH } from './Game';
import { boostActive, goldMult } from './Game';

interface Offer {
  title: string;
  desc: string;
  reward: string;
  icon: string;
  color: number;
  shadow: number;
  cta: string;
  claim: (done: () => void) => void;
  ready: () => boolean;
  note?: () => string;
}

export class RewardsPanel extends Panel {
  private redraws: Array<() => void> = [];

  constructor() {
    super('RewardsPanel');
  }

  init(): void {
    this.headerColor = C.purple;
    this.titleText = 'FREE REWARDS';
    this.subtitleText = 'Watch ads \u00b7 earn GOLD, gems & boosts';
    this.sheetTop = 150;
    this.closing = false;
    this.redraws = [];
  }

  create(): void {
    this.buildChrome();

    const offers: Offer[] = [
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
            if (!ok) return;
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
            if (!ok) return;
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
            if (!ok) return;
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
            if (!ok) return;
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
    list.add(
      this.add
        .text(DW / 2, iy + 84, String(S.adsWatched), { fontFamily: 'Bangers', fontSize: '56px', color: '#ffd76a' })
        .setOrigin(0.5)
    );
    list.add(
      this.add.text(DW / 2, iy + 126, 'Simulated ads \u2014 no real network calls', t(14, '#5d6b88')).setOrigin(0.5)
    );

    attachScroll(this, list, 0, vy, DW, vh, iy + 180);
  }

  private buildOffer(list: Phaser.GameObjects.Container, o: Offer, y: number, H: number): void {
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
    list.add(
      this.add
        .text(154, y + 66, o.desc, { ...t(15, TXT.dim), wordWrap: { width: 300 } })
        .setOrigin(0, 0)
    );
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

    const redraw = (): void => {
      noteTxt.setText(o.note ? o.note() : '');
    };
    redraw();
    this.redraws.push(redraw);
  }

  private refreshAll(): void {
    this.redraws.forEach((r) => r());
    this.refreshWallet();
  }

  update(): void {
    // keeps boost countdown live
    if (this.redraws.length) this.redraws.forEach((r) => r());
  }
}
