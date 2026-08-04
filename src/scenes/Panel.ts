import Phaser from 'phaser';
import { sfx } from '../audio';
import { S, save } from '../save';
import { fmt, goldFull } from '../format';
import { Btn, C, TXT, FONT, FONT_D, t, rr, rrs } from '../ui';
import { DW, DH } from './Game';

/**
 * Base for every full-screen sheet panel (Miners / Upgrades / Rewards /
 * Cash-out / Settings). Handles the slide-up sheet, header, currency strip,
 * dimmer, and close plumbing back to the Game scene.
 */
export abstract class Panel extends Phaser.Scene {
  protected sheet!: Phaser.GameObjects.Container;
  protected head!: Phaser.GameObjects.Container;
  protected shade!: Phaser.GameObjects.Rectangle;
  protected headerColor: number = C.blue;
  protected sheetTop = 150;
  protected titleText = 'PANEL';
  protected subtitleText = '';
  protected showWallet = true;
  protected coinTxt?: Phaser.GameObjects.Text;
  protected gemTxt?: Phaser.GameObjects.Text;
  protected cashTxtHud?: Phaser.GameObjects.Text;
  protected closing = false;

  /** Content area top (below header + wallet strip). */
  protected get contentTop(): number {
    return this.sheetTop + (this.showWallet ? 168 : 104);
  }

  protected buildChrome(): void {
    this.shade = this.add
      .rectangle(DW / 2, DH / 2, DW, DH, 0x02040a, 0)
      .setInteractive()
      .setDepth(0);
    this.shade.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < this.sheetTop - 10) this.close();
    });
    this.tweens.add({ targets: this.shade, fillAlpha: 0.78, duration: 200 });

    // Body sits BELOW the scrolled content (depth 2); header sits ABOVE it so
    // masked-off rows can never be tapped through the chrome.
    this.sheet = this.add.container(0, DH).setDepth(1);
    this.head = this.add.container(0, DH).setDepth(10);

    const h = DH - this.sheetTop + 40;
    const g = this.add.graphics();
    rr(g, 0, this.sheetTop, DW, h, 34, 0x0c1322, 1);
    rrs(g, 0, this.sheetTop, DW, h, 34, this.headerColor, 3, 0.55);
    this.sheet.add(g);

    const hb = this.contentTop - this.sheetTop;
    const hg = this.add.graphics();
    rr(hg, 0, this.sheetTop, DW, Math.max(hb, 108), 34, 0x0c1322, 1);
    // header band
    rr(hg, 0, this.sheetTop, DW, 104, 34, this.headerColor, 1);
    hg.fillStyle(this.headerColor, 1);
    hg.fillRect(0, this.sheetTop + 60, DW, 44);
    rr(hg, 6, this.sheetTop + 6, DW - 12, 42, 22, 0xffffff, 0.14);
    hg.fillStyle(0x000000, 0.22);
    hg.fillRect(0, this.sheetTop + 98, DW, 6);
    this.head.add(hg);

    // grab handle
    const handle = this.add.graphics();
    rr(handle, DW / 2 - 46, this.sheetTop - 22, 92, 8, 4, 0xffffff, 0.5);
    this.head.add(handle);

    const title = this.add
      .text(36, this.sheetTop + (this.subtitleText ? 38 : 52), this.titleText, {
        fontFamily: FONT_D,
        fontSize: '40px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
      .setStroke('#00000055', 5);
    this.head.add(title);
    if (this.subtitleText) {
      this.head.add(
        this.add
          .text(38, this.sheetTop + 70, this.subtitleText, t(17, '#ffffffcc'))
          .setOrigin(0, 0.5)
      );
    }

    // close X
    const x = this.add.container(DW - 58, this.sheetTop + 52);
    const xg = this.add.graphics();
    rr(xg, -28, -28, 56, 56, 16, 0x000000, 0.28);
    rrs(xg, -28, -28, 56, 56, 16, 0xffffff, 2, 0.4);
    x.add(xg);
    x.add(this.add.text(0, -2, '\u2715', { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5));
    x.setSize(60, 60).setInteractive({ useHandCursor: true });
    x.on('pointerdown', () => {
      sfx('click');
      this.close();
    });
    this.head.add(x);

    if (this.showWallet) this.buildWallet();

    // Swallows taps that land on the chrome so masked-off scroll rows underneath
    // can never be activated through the header/wallet strip.
    const blocker = this.add
      .rectangle(DW / 2, this.sheetTop + hb / 2, DW, hb, 0x000000, 0.001)
      .setInteractive();
    this.head.addAt(blocker, 0);

    this.tweens.add({ targets: [this.sheet, this.head], y: 0, duration: 340, ease: 'Cubic.easeOut' });
  }

  private buildWallet(): void {
    const y = this.sheetTop + 134;
    const g = this.add.graphics();
    const items: Array<[number, number, number]> = [
      [20, 220, C.gold],
      [252, 200, C.cyan],
      [464, 236, C.green],
    ];
    items.forEach(([x, w, col]) => {
      rr(g, x, y - 28, w, 56, 28, 0x121a2c, 1);
      rrs(g, x, y - 28, w, 56, 28, col, 2, 0.6);
    });
    this.head.add(g);

    this.head.add(this.add.image(52, y, 'coin').setDisplaySize(40, 40));
    this.coinTxt = this.add.text(80, y, fmt(S.coins), t(23, TXT.gold)).setOrigin(0, 0.5);
    this.head.add(this.coinTxt);

    this.head.add(this.add.image(284, y, 'gem').setDisplaySize(36, 36));
    this.gemTxt = this.add.text(310, y, fmt(S.gems), t(23, '#8ef0ff')).setOrigin(0, 0.5);
    this.head.add(this.gemTxt);

    this.head.add(this.add.image(496, y, 'gold').setDisplaySize(38, 38));
    this.cashTxtHud = this.add.text(524, y, goldFull(S.cash), t(20, TXT.gold)).setOrigin(0, 0.5);
    this.head.add(this.cashTxtHud);
  }

  protected refreshWallet(): void {
    this.coinTxt?.setText(fmt(S.coins));
    this.gemTxt?.setText(fmt(S.gems));
    this.cashTxtHud?.setText(goldFull(S.cash));
    this.pulse(this.coinTxt);
  }

  protected pulse(o?: Phaser.GameObjects.Text): void {
    if (!o) return;
    this.tweens.add({ targets: o, scaleX: 1.18, scaleY: 1.18, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Launch the simulated rewarded-ad scene; cb(true) when fully watched. */
  protected playAd(reason: string, cb: (ok: boolean) => void): void {
    if (this.scene.isActive('AdScene')) return;
    this.input.enabled = false;
    this.scene.launch('AdScene', {
      reason,
      done: (ok: boolean) => {
        this.input.enabled = true;
        if (ok) {
          S.adsWatched++;
          save();
        }
        cb(ok);
      },
    });
    this.scene.bringToTop('AdScene');
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    save();
    this.input.enabled = false;
    this.tweens.add({ targets: this.shade, fillAlpha: 0, duration: 220 });
    this.tweens.add({
      targets: [this.sheet, this.head],
      y: DH,
      duration: 260,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.game.events.emit('panel-closed');
        this.scene.stop();
      },
    });
  }

  /** Small helper: standard row card graphics inside the sheet. */
  protected row(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    stroke: number,
    fill = 0x141d30
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    rr(g, x, y, w, h, 22, fill, 1);
    rr(g, x + 3, y + 3, w - 6, h * 0.38, 19, 0xffffff, 0.04);
    rrs(g, x, y, w, h, 22, stroke, 2, 0.7);
    parent.add(g);
    return g;
  }

  protected btn(parent: Phaser.GameObjects.Container, b: Btn): Btn {
    parent.add(b);
    return b;
  }
}
