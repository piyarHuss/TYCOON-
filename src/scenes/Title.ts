import Phaser from 'phaser';
import { initAudio, sfx, setMuted } from '../audio';
import { S, save } from '../save';
import { fmt, goldFull } from '../format';
import { Btn, C, TXT, FONT, FONT_D, t, rr, rrs, card } from '../ui';

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    // background
    const bg = this.add.image(cx, H / 2, 'bg_mine');
    const sc = Math.max(W / bg.width, H / bg.height) * 1.06;
    bg.setScale(sc).setTint(0x8fa0c8);
    this.tweens.add({ targets: bg, scale: sc * 1.06, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const vig = this.add.graphics();
    vig.fillStyle(0x05070f, 0.62);
    vig.fillRect(0, 0, W, H);

    // floating dust
    for (let i = 0; i < 26; i++) {
      const d = this.add
        .image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'glow')
        .setDisplaySize(Phaser.Math.Between(4, 12), Phaser.Math.Between(4, 12))
        .setAlpha(Phaser.Math.FloatBetween(0.08, 0.3))
        .setTint(0xffd98a);
      this.tweens.add({
        targets: d,
        y: d.y - Phaser.Math.Between(70, 220),
        x: d.x + Phaser.Math.Between(-40, 40),
        alpha: 0,
        duration: Phaser.Math.Between(5000, 11000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 4000),
        onRepeat: () => {
          d.setPosition(Phaser.Math.Between(0, W), H + 20).setAlpha(Phaser.Math.FloatBetween(0.08, 0.3));
        },
      });
    }

    // ---- Title lockup ----
    const titleY = H * 0.19;
    const glowRing = this.add.image(cx, titleY + 8, 'glow').setDisplaySize(W * 1.1, 340).setTint(0xffb02a).setAlpha(0.22);
    this.tweens.add({ targets: glowRing, alpha: 0.34, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const tSize = Math.min(W * 0.155, 96);
    const l1 = this.add
      .text(cx, titleY - tSize * 0.44, 'STONE', {
        fontFamily: FONT_D,
        fontSize: `${tSize}px`,
        color: '#ffd76a',
      })
      .setOrigin(0.5)
      .setStroke('#4a2604', 10)
      .setShadow(0, 8, '#000000aa', 10);
    const l2 = this.add
      .text(cx, titleY + tSize * 0.46, 'TYCOON', {
        fontFamily: FONT_D,
        fontSize: `${tSize * 1.12}px`,
        color: '#ffc23d',
      })
      .setOrigin(0.5)
      .setStroke('#4a2604', 10)
      .setShadow(0, 8, '#000000aa', 10);
    this.tweens.add({ targets: [l1, l2], scaleX: 1.035, scaleY: 1.035, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add
      .text(cx, titleY + tSize * 1.05, 'IDLE MINING \u00b7 EARN GOLD \u00b7 WITHDRAW', t(Math.min(W * 0.035, 20), TXT.dim))
      .setOrigin(0.5)
      .setAlpha(0.9);

    // ---- Hero rock + miner ----
    const heroY = H * 0.455;
    const rockS = Math.min(W * 0.44, 250);
    const rock = this.add.image(cx + W * 0.06, heroY, 'rock_gold').setDisplaySize(rockS, rockS);
    this.tweens.add({ targets: rock, angle: 4, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const rGlow = this.add.image(rock.x, heroY, 'glow').setDisplaySize(rockS * 1.9, rockS * 1.9).setTint(0xffc23d).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: rGlow, alpha: 0.36, duration: 1200, yoyo: true, repeat: -1 });

    const mS = Math.min(W * 0.38, 215);
    const miner = this.add.image(cx - W * 0.24, heroY + 18, 'miner1').setDisplaySize(mS, mS);
    this.tweens.add({ targets: miner, angle: -14, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // sparks between them
    this.time.addEvent({
      delay: 460,
      loop: true,
      callback: () => {
        for (let i = 0; i < 5; i++) {
          const p = this.add
            .image(rock.x - rockS * 0.4, heroY, 'spark')
            .setDisplaySize(12, 12)
            .setTint(0xffe066)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: p,
            x: p.x + Phaser.Math.Between(-70, 30),
            y: p.y + Phaser.Math.Between(-70, 60),
            alpha: 0,
            scale: 0,
            duration: 620,
            ease: 'Quad.easeOut',
            onComplete: () => p.destroy(),
          });
        }
      },
    });

    // ---- Stats strip ----
    const has = S.totalBroken > 0 || S.cash > 0;
    if (has) {
      const sy = H * 0.63;
      const sw = Math.min(W * 0.88, 460);
      card(this, cx, sy, sw, 78, { fill: 0x0c1322, stroke: C.stroke, radius: 18, alpha: 0.93 });
      const cols: Array<[string, string, string]> = [
        ['LEVEL', String(S.bestLevel), TXT.gold],
        ['COINS', fmt(S.coins), TXT.light],
        ['GOLD', goldFull(S.cash), TXT.gold],
      ];
      cols.forEach((c2, i) => {
        const x = cx - sw / 2 + sw * ((i + 0.5) / 3);
        this.add.text(x, sy - 17, c2[0], t(13, TXT.dim)).setOrigin(0.5);
        this.add.text(x, sy + 11, c2[1], t(25, c2[2])).setOrigin(0.5);
        if (i < 2) {
          const g = this.add.graphics();
          g.lineStyle(1, C.stroke, 0.6);
          g.lineBetween(cx - sw / 2 + (sw * (i + 1)) / 3, sy - 24, cx - sw / 2 + (sw * (i + 1)) / 3, sy + 24);
        }
      });
    }

    // ---- Play button ----
    const playY = has ? H * 0.755 : H * 0.71;
    const bw = Math.min(W * 0.74, 380);
    const playBtn = new Btn(this, cx, playY, {
      w: bw,
      h: 94,
      label: has ? 'CONTINUE' : 'START MINING',
      color: C.green,
      shadow: C.greenDk,
      fontSize: 36,
      textColor: '#ffffff',
      radius: 26,
      sound: false,
      onClick: () => this.start(),
    });
    this.tweens.add({ targets: playBtn, scaleX: 1.035, scaleY: 1.035, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // tap-anywhere hint
    const hint = this.add
      .text(cx, playY + 76, 'Tap the rock to mine \u00b7 Miners dig for you', t(16, TXT.dim))
      .setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 1100, yoyo: true, repeat: -1 });

    // ---- Sound toggle · help · HTML download ----
    const btnY = H - 56;
    const soundBtn = new Btn(this, cx - 158, btnY, {
      w: 142,
      h: 56,
      label: S.muted ? 'SOUND OFF' : 'SOUND ON',
      color: S.muted ? C.grey : C.blue,
      fontSize: 15,
      radius: 16,
      onClick: () => {
        S.muted = !S.muted;
        setMuted(S.muted);
        save();
        soundBtn.setLabel(S.muted ? 'SOUND OFF' : 'SOUND ON').setColorTheme(S.muted ? C.grey : C.blue);
      },
    });
    new Btn(this, cx, btnY, {
      w: 142,
      h: 56,
      label: 'HOW TO PLAY',
      color: C.panelLite,
      fontSize: 15,
      radius: 16,
      onClick: () => this.showHelp(),
    });
    new Btn(this, cx + 158, btnY, {
      w: 142,
      h: 56,
      label: '\u2b07 GET HTML',
      color: C.green,
      shadow: C.greenDk,
      fontSize: 15,
      radius: 16,
      onClick: () => {
        // Opens the download page shipped alongside the game. Falls back to a
        // direct hit on the single-file build when opened from file://.
        const target =
          window.location.protocol === 'file:' ? 'stone-tycoon-offline.html' : 'download.html';
        window.open(target, '_blank');
      },
    });

    // whole-screen tap also starts (but not over buttons)
    this.input.once('pointerdown', () => {
      initAudio();
      setMuted(S.muted);
    });

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private start(): void {
    initAudio();
    setMuted(S.muted);
    sfx('confirm');
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
  }

  private showHelp(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const layer = this.add.container(0, 0).setDepth(5000);
    const shade = this.add.rectangle(cx, H / 2, W, H, 0x03060e, 0.86).setInteractive();
    layer.add(shade);

    const pw = Math.min(W * 0.9, 470);
    const ph = Math.min(H * 0.66, 520);
    const panel = this.add.container(cx, H / 2);
    const g = this.add.graphics();
    rr(g, -pw / 2, -ph / 2, pw, ph, 26, 0x101827, 0.99);
    rrs(g, -pw / 2, -ph / 2, pw, ph, 26, C.gold, 3, 0.85);
    rr(g, -pw / 2, -ph / 2, pw, 66, 26, C.gold, 1);
    rr(g, -pw / 2, -ph / 2 + 40, pw, 26, 0, C.gold, 1);
    panel.add(g);
    panel.add(this.add.text(0, -ph / 2 + 33, 'HOW TO PLAY', { fontFamily: FONT, fontSize: '28px', color: '#231301' }).setOrigin(0.5));

    const lines: Array<[string, string]> = [
      ['\u26cf\ufe0f', 'Tap the rock to swing your pickaxe and deal damage.'],
      ['\ud83d\udc77', 'Hire miners \u2014 they auto-mine for you every second, even while idle.'],
      ['\ud83d\udcfa', 'Watch ads to unlock new miners. Each miner needs more ad views.'],
      ['\ud83e\ude99', 'Break a rock \u2192 earn coins + GOLD nuggets. Every 10th rock is a BOSS.'],
      ['\ud83d\udcb5', 'Tap WITHDRAW GOLD at the bottom to request a gold withdrawal.'],
    ];
    let y = -ph / 2 + 100;
    lines.forEach(([ic, txt]) => {
      panel.add(this.add.text(-pw / 2 + 26, y, ic, { fontSize: '26px' }).setOrigin(0, 0));
      const tx = this.add.text(-pw / 2 + 70, y + 2, txt, {
        fontFamily: FONT,
        fontSize: '17px',
        color: TXT.light,
        wordWrap: { width: pw - 100 },
        lineSpacing: 4,
      });
      panel.add(tx);
      y += Math.max(52, tx.height + 20);
    });

    layer.add(panel);
    const close = new Btn(this, cx, H / 2 + ph / 2 - 44, {
      w: pw - 60,
      h: 62,
      label: 'GOT IT',
      color: C.green,
      shadow: C.greenDk,
      fontSize: 24,
      radius: 18,
      onClick: () => layer.destroy(),
    });
    layer.add(close);
    shade.on('pointerdown', () => layer.destroy());

    panel.setScale(0.88).setAlpha(0);
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
  }
}
