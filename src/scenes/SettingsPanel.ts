import Phaser from 'phaser';
import { sfx, setMuted } from '../audio';
import { S, save, resetSave } from '../save';
import { fmt, goldFull } from '../format';
import { Btn, C, TXT, t, rr, rrs, toast } from '../ui';
import { Panel } from './Panel';
import { DW, DH } from './Game';

export class SettingsPanel extends Panel {
  constructor() {
    super('SettingsPanel');
  }

  init(): void {
    this.headerColor = C.grey;
    this.titleText = 'SETTINGS';
    this.subtitleText = 'Audio \u00b7 progress \u00b7 about';
    this.sheetTop = 320;
    this.showWallet = false;
    this.closing = false;
  }

  create(): void {
    this.buildChrome();
    const y0 = this.contentTop;
    const c = this.add.container(0, y0).setDepth(2);

    // sound toggle
    const soundBtn = new Btn(this, DW / 2, 44, {
      w: DW - 80,
      h: 88,
      label: S.muted ? '\ud83d\udd07  SOUND: OFF' : '\ud83d\udd0a  SOUND: ON',
      color: S.muted ? C.greyDk : C.blue,
      shadow: S.muted ? 0x11182a : C.blueDk,
      fontSize: 26,
      radius: 22,
      onClick: () => {
        S.muted = !S.muted;
        setMuted(S.muted);
        save();
        soundBtn.setLabel(S.muted ? '\ud83d\udd07  SOUND: OFF' : '\ud83d\udd0a  SOUND: ON');
        soundBtn.setColorTheme(S.muted ? C.greyDk : C.blue);
        if (!S.muted) sfx('click');
      },
    });
    c.add(soundBtn);

    // stats card
    const g = this.add.graphics();
    rr(g, 40, 108, DW - 80, 232, 24, 0x121b2c, 1);
    rrs(g, 40, 108, DW - 80, 232, 24, C.stroke, 2, 0.6);
    c.add(g);
    c.add(this.add.text(DW / 2, 140, 'YOUR PROGRESS', t(20, TXT.gold)).setOrigin(0.5));
    const rows: Array<[string, string]> = [
      ['Current level', 'Lv ' + fmt(S.level)],
      ['Rocks smashed', fmt(S.totalBroken)],
      ['Gold balance', goldFull(S.cash)],
      ['Withdrawals', String(S.withdrawals.length)],
    ];
    rows.forEach(([k, v], i) => {
      const yy = 182 + i * 40;
      c.add(this.add.text(70, yy, k, t(18, TXT.dim)).setOrigin(0, 0.5));
      c.add(this.add.text(DW - 70, yy, v, t(19, TXT.light)).setOrigin(1, 0.5));
    });

    // reset
    const reset = new Btn(this, DW / 2, 400, {
      w: DW - 80,
      h: 84,
      label: 'RESET PROGRESS',
      sub: 'Tap twice to confirm',
      color: C.red,
      shadow: C.redDk,
      fontSize: 25,
      subSize: 15,
      radius: 22,
      onClick: () => this.onReset(reset),
    });
    c.add(reset);

    c.add(
      this.add
        .text(DW / 2, 486, 'STONE TYCOON  \u00b7  v1.0', t(16, '#5d6b88'))
        .setOrigin(0.5)
    );
    c.add(
      this.add
        .text(
          DW / 2,
          520,
          'Demo game. Ads and payouts are simulated for\nentertainment only \u2014 no real money is involved.',
          { ...t(14, '#4d5975'), align: 'center', lineSpacing: 4 }
        )
        .setOrigin(0.5)
    );
  }

  private confirming = false;

  private onReset(btn: Btn): void {
    if (!this.confirming) {
      this.confirming = true;
      btn.setLabel('ARE YOU SURE?').setSub('This deletes everything');
      toast(this, 'Tap again to wipe save', C.red);
      this.time.delayedCall(3200, () => {
        if (!this.scene.isActive()) return;
        this.confirming = false;
        btn.setLabel('RESET PROGRESS').setSub('Tap twice to confirm');
      });
      return;
    }
    resetSave();
    save();
    sfx('break', 0.7);
    this.cameras.main.flash(200, 255, 80, 80, false);
    this.time.delayedCall(220, () => {
      this.game.events.emit('panel-closed');
      this.scene.stop();
      this.scene.stop('Game');
      this.scene.start('Title');
    });
  }
}
