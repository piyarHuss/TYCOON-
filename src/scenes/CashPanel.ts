import Phaser from 'phaser';
import { sfx } from '../audio';
import { S, save, Withdrawal } from '../save';
import { goldFull, mask, dateStr, txnId, fmt } from '../format';
import { PAYOUTS, AMOUNTS, PayoutMethod, getMinWithdraw, getAdCashReward } from '../data';
import { Btn, C, TXT, FONT, FONT_D, t, rr, rrs, toast, attachScroll, lighten, hex } from '../ui';
import { Panel } from './Panel';
import { DW, DH } from './Game';

export class CashPanel extends Panel {
  private method!: PayoutMethod;
  private amount = 5;
  private list!: Phaser.GameObjects.Container;
  private redraws: Array<() => void> = [];
  private balTxt!: Phaser.GameObjects.Text;
  private accountTxt!: Phaser.GameObjects.Text;
  private hintTxt!: Phaser.GameObjects.Text;
  private etaTxt!: Phaser.GameObjects.Text;
  private feeTxt!: Phaser.GameObjects.Text;
  private netTxt!: Phaser.GameObjects.Text;
  private submitBtn!: Btn;
  private progG!: Phaser.GameObjects.Graphics;
  private progTxt!: Phaser.GameObjects.Text;

  constructor() {
    super('CashPanel');
  }

  init(): void {
    this.headerColor = C.green;
    this.titleText = 'WITHDRAW GOLD';
    this.subtitleText = 'Withdraw your mined GOLD';
    this.sheetTop = 118;
    this.showWallet = false;
    this.closing = false;
    this.redraws = [];
    this.method = PAYOUTS.find((p) => p.id === S.lastMethod) ?? PAYOUTS[0];
    this.amount = AMOUNTS.find((a) => a <= S.cash) ?? getMinWithdraw();
  }

  create(): void {
    this.buildChrome();

    const vy = this.sheetTop + 112;
    const vh = DH - vy - 16;
    this.list = this.add.container(0, vy).setDepth(2);

    let y = 6;
    y = this.buildBalanceCard(y);
    y = this.buildMethods(y);
    y = this.buildAmounts(y);
    y = this.buildAccount(y);
    y = this.buildSummary(y);
    y = this.buildSubmit(y);
    y = this.buildHistory(y);

    attachScroll(this, this.list, 0, vy, DW, vh, y + 40);
    this.refreshAll();
  }

  // ─────────────────────────────── balance hero card
  private buildBalanceCard(y: number): number {
    const H = 214;
    const g = this.add.graphics();
    g.fillGradientStyle(0x0d3c2a, 0x0d3c2a, 0x11624a, 0x0a2e22, 1);
    g.fillRoundedRect(18, y, DW - 36, H, 26);
    rrs(g, 18, y, DW - 36, H, 26, C.green, 3, 0.75);
    rr(g, 22, y + 4, DW - 44, 70, 22, 0xffffff, 0.06);
    this.list.add(g);

    // shimmer
    const shine = this.add.rectangle(-120, y + H / 2, 90, H, 0xffffff, 0.07).setAngle(14);
    this.list.add(shine);
    this.tweens.add({
      targets: shine,
      x: DW + 140,
      duration: 2600,
      repeat: -1,
      repeatDelay: 1600,
      ease: 'Sine.easeInOut',
    });

    this.list.add(this.add.text(46, y + 34, 'AVAILABLE GOLD', t(17, '#8fe4b8')).setOrigin(0, 0.5));
    this.list.add(this.add.image(DW - 72, y + 46, 'gold').setDisplaySize(60, 60));

    this.balTxt = this.add
      .text(46, y + 96, goldFull(S.cash), { fontFamily: FONT_D, fontSize: '68px', color: '#ffffff' })
      .setOrigin(0, 0.5)
      .setStroke('#04241a', 8);
    this.list.add(this.balTxt);

    // progress toward minimum
    this.progG = this.add.graphics();
    this.list.add(this.progG);
    this.progTxt = this.add.text(46, y + 186, '', t(15, '#a9ecc9')).setOrigin(0, 0.5);
    this.list.add(this.progTxt);

    const drawProg = (): void => {
      const r = Phaser.Math.Clamp(S.cash / getMinWithdraw(), 0, 1);
      this.progG.clear();
      rr(this.progG, 46, y + 148, DW - 128, 16, 8, 0x04241a, 1);
      if (r > 0.01) rr(this.progG, 48, y + 150, (DW - 132) * r, 12, 6, 0x38e08a, 1);
      rrs(this.progG, 46, y + 148, DW - 128, 16, 8, 0x38e08a, 2, 0.45);
      this.progTxt.setText(
        S.cash >= getMinWithdraw()
          ? '\u2705  Minimum reached \u2014 you can withdraw now'
          : `${goldFull(getMinWithdraw() - S.cash)} more to reach the ${goldFull(getMinWithdraw())} minimum`
      );
      this.balTxt.setText(goldFull(S.cash));
    };
    this.redraws.push(drawProg);

    // quick "earn more" ad button
    const earn = new Btn(this, DW / 2, y + H + 52, {
      w: DW - 36,
      h: 82,
      label: '\ud83d\udcfa  WATCH AD  \u2192  +' + goldFull(getAdCashReward()),
      color: C.purple,
      shadow: C.purpleDk,
      fontSize: 25,
      radius: 22,
      onClick: () => {
        this.playAd('Gold bonus ' + goldFull(getAdCashReward()), (ok) => {
          if (!ok) return;
          S.cash += getAdCashReward();
          save();
          sfx('coin', 1.15);
          toast(this, 'Added ' + goldFull(getAdCashReward()) + ' to balance', C.gold);
          this.tweens.add({
            targets: this.balTxt,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 130,
            yoyo: true,
            ease: 'Back.easeOut',
          });
          this.refreshAll();
        });
      },
    });
    this.list.add(earn);

    return y + H + 106;
  }

  // ─────────────────────────────── payout methods
  private buildMethods(y: number): number {
    this.list.add(this.add.text(30, y + 10, 'PAYOUT METHOD', t(19, TXT.gold)).setOrigin(0, 0.5));
    const top = y + 36;
    const w = (DW - 36 - 3 * 12) / 4;
    const H = 118;

    PAYOUTS.forEach((p, i) => {
      const x = 18 + i * (w + 12);
      const g = this.add.graphics();
      this.list.add(g);

      const badge = this.add.graphics();
      this.list.add(badge);
      const short = this.add
        .text(x + w / 2, top + 42, p.short, { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
        .setOrigin(0.5);
      this.list.add(short);
      const nm = this.add.text(x + w / 2, top + 92, p.name, t(16, TXT.dim)).setOrigin(0.5);
      this.list.add(nm);

      const zone = this.add.zone(x + w / 2, top + H / 2, w, H).setInteractive({ useHandCursor: true });
      this.list.add(zone);
      zone.on('pointerdown', () => {
        if (this.method.id === p.id) return;
        sfx('click');
        this.method = p;
        S.lastMethod = p.id;
        save();
        this.refreshAll();
        this.tweens.add({ targets: [short, nm], scaleX: 1.12, scaleY: 1.12, duration: 110, yoyo: true });
      });

      const redraw = (): void => {
        const sel = this.method.id === p.id;
        g.clear();
        rr(g, x, top, w, H, 20, sel ? 0x16283f : 0x111a2b, 1);
        rrs(g, x, top, w, H, 20, sel ? p.color : C.stroke, sel ? 3 : 2, sel ? 1 : 0.5);
        badge.clear();
        rr(badge, x + w / 2 - 28, top + 20, 56, 44, 12, p.color, sel ? 1 : 0.5);
        nm.setColor(sel ? TXT.light : TXT.dim);
        short.setAlpha(sel ? 1 : 0.7);
      };
      redraw();
      this.redraws.push(redraw);
    });

    return top + H + 22;
  }

  // ─────────────────────────────── amount chips
  private buildAmounts(y: number): number {
    this.list.add(this.add.text(30, y + 10, 'SELECT AMOUNT', t(19, TXT.gold)).setOrigin(0, 0.5));
    const top = y + 36;
    const w = (DW - 36 - 4 * 10) / 5;
    const H = 74;

    AMOUNTS.forEach((a, i) => {
      const x = 18 + i * (w + 10);
      const g = this.add.graphics();
      this.list.add(g);
      const lbl = this.add
        .text(x + w / 2, top + H / 2 - 6, goldFull(a), { fontFamily: FONT, fontSize: '24px', color: '#ffffff' })
        .setOrigin(0.5);
      this.list.add(lbl);
      const sub = this.add.text(x + w / 2, top + H - 16, '', t(12, '#7f92b5')).setOrigin(0.5);
      this.list.add(sub);

      const zone = this.add.zone(x + w / 2, top + H / 2, w, H).setInteractive({ useHandCursor: true });
      this.list.add(zone);
      zone.on('pointerdown', () => {
        if (S.cash < a) {
          toast(this, 'Need ' + goldFull(a - S.cash) + ' more', C.red);
          sfx('click', 0.7);
          return;
        }
        sfx('click', 1.2);
        this.amount = a;
        this.refreshAll();
        this.tweens.add({ targets: lbl, scaleX: 1.2, scaleY: 1.2, duration: 110, yoyo: true, ease: 'Back.easeOut' });
      });

      const redraw = (): void => {
        const sel = this.amount === a;
        const afford = S.cash >= a;
        g.clear();
        rr(g, x, top, w, H, 18, sel ? 0x0f3826 : afford ? 0x111a2b : 0x0c111c, 1);
        rrs(g, x, top, w, H, 18, sel ? C.green : afford ? C.stroke : 0x1d2536, sel ? 3 : 2, sel ? 1 : 0.6);
        lbl.setColor(sel ? '#7bf0ae' : afford ? '#ffffff' : '#4a5674');
        sub.setText(afford ? '' : '\ud83d\udd12');
      };
      redraw();
      this.redraws.push(redraw);
    });

    return top + H + 22;
  }

  // ─────────────────────────────── account field
  private buildAccount(y: number): number {
    const H = 116;
    const g = this.add.graphics();
    rr(g, 18, y, DW - 36, H, 22, 0x111a2b, 1);
    rrs(g, 18, y, DW - 36, H, 22, C.stroke, 2, 0.6);
    this.list.add(g);

    this.hintTxt = this.add.text(40, y + 30, '', t(15, TXT.dim)).setOrigin(0, 0.5);
    this.list.add(this.hintTxt);
    this.accountTxt = this.add.text(40, y + 72, '', t(24, TXT.light)).setOrigin(0, 0.5);
    this.list.add(this.accountTxt);

    const edit = new Btn(this, DW - 108, y + H / 2, {
      w: 150,
      h: 68,
      label: 'EDIT',
      color: C.blue,
      shadow: C.blueDk,
      fontSize: 22,
      radius: 18,
      onClick: () => this.promptAccount(),
    });
    this.list.add(edit);

    const redraw = (): void => {
      this.hintTxt.setText(this.method.hint);
      const v = S.account[this.method.id] ?? '';
      this.accountTxt.setText(v ? mask(v) : this.method.placeholder).setColor(v ? TXT.light : '#54628350');
      this.accountTxt.setColor(v ? TXT.light : '#546283');
    };
    redraw();
    this.redraws.push(redraw);

    return y + H + 18;
  }

  // ─────────────────────────────── summary
  private buildSummary(y: number): number {
    const H = 152;
    const g = this.add.graphics();
    rr(g, 18, y, DW - 36, H, 22, 0x0e1626, 1);
    rrs(g, 18, y, DW - 36, H, 22, C.stroke, 2, 0.5);
    this.list.add(g);

    const mk = (yy: number, label: string, color: string, size: number) => {
      const l = this.add.text(44, yy, label, t(17, TXT.dim)).setOrigin(0, 0.5);
      const v = this.add.text(DW - 44, yy, '', t(size, color)).setOrigin(1, 0.5);
      this.list.add([l, v]);
      return v;
    };
    this.feeTxt = mk(y + 32, 'Processing fee', '#ffb37a', 18);
    this.etaTxt = mk(y + 72, 'Estimated arrival', '#8ef0ff', 17);

    const sep = this.add.graphics();
    sep.lineStyle(2, 0x24314c, 1);
    sep.lineBetween(44, y + 100, DW - 44, y + 100);
    this.list.add(sep);

    this.netTxt = mk(y + 126, 'YOU RECEIVE', '#7bf0ae', 26);

    const redraw = (): void => {
      const fee = this.method.fee;
      this.feeTxt.setText('FREE');
      this.feeTxt.setColor('#7bf0ae');
      this.etaTxt.setText(this.method.eta);
      this.netTxt.setText(goldFull(this.amount));
    };
    redraw();
    this.redraws.push(redraw);

    return y + H + 18;
  }

  // ─────────────────────────────── submit
  private buildSubmit(y: number): number {
    this.submitBtn = new Btn(this, DW / 2, y + 52, {
      w: DW - 36,
      h: 100,
      label: 'WITHDRAW',
      sub: '',
      color: C.green,
      shadow: C.greenDk,
      fontSize: 32,
      subSize: 16,
      radius: 26,
      onClick: () => this.submit(),
    });
    this.list.add(this.submitBtn);

    const note = this.add
      .text(
        DW / 2,
        y + 122,
        '\ud83d\udd12  Simulated GOLD withdrawal record only',
        t(14, '#5d6b88')
      )
      .setOrigin(0.5);
    this.list.add(note);

    const redraw = (): void => {
      const hasAcc = !!S.account[this.method.id];
      const enough = S.cash >= this.amount;
      const okMin = this.amount >= getMinWithdraw();
      this.submitBtn.setEnabled(hasAcc && enough && okMin);
      this.submitBtn.setLabel('WITHDRAW ' + goldFull(this.amount));
      this.submitBtn.setSub(
        !enough
          ? 'Insufficient balance'
          : !hasAcc
            ? 'Add your ' + this.method.name + ' details first'
            : 'via ' + this.method.name + ' \u00b7 ' + this.method.eta
      );
    };
    redraw();
    this.redraws.push(redraw);

    return y + 150;
  }

  // ─────────────────────────────── history
  private buildHistory(y: number): number {
    this.list.add(this.add.text(30, y + 16, 'TRANSACTION HISTORY', t(19, TXT.gold)).setOrigin(0, 0.5));
    let yy = y + 42;

    if (S.withdrawals.length === 0) {
      const g = this.add.graphics();
      rr(g, 18, yy, DW - 36, 108, 22, 0x0e1626, 1);
      rrs(g, 18, yy, DW - 36, 108, 22, C.stroke, 2, 0.4);
      this.list.add(g);
      this.list.add(
        this.add.text(DW / 2, yy + 40, 'No withdrawals yet', t(19, TXT.dim)).setOrigin(0.5)
      );
      this.list.add(
        this.add.text(DW / 2, yy + 72, 'Break rocks to earn GOLD nuggets', t(15, '#5d6b88')).setOrigin(0.5)
      );
      return yy + 130;
    }

    S.withdrawals.slice(0, 10).forEach((w) => {
      const H = 104;
      const pm = PAYOUTS.find((p) => p.id === w.method) ?? PAYOUTS[0];
      const g = this.add.graphics();
      rr(g, 18, yy, DW - 36, H, 20, 0x111a2b, 1);
      rrs(g, 18, yy, DW - 36, H, 20, C.stroke, 2, 0.45);
      rr(g, 18, yy, 7, H, 3, pm.color, 0.9);
      this.list.add(g);

      const badge = this.add.graphics();
      rr(badge, 42, yy + 26, 56, 52, 14, pm.color, 0.85);
      this.list.add(badge);
      this.list.add(
        this.add.text(70, yy + 52, pm.short, { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5)
      );

      this.list.add(this.add.text(116, yy + 32, goldFull(w.amount), t(24, TXT.light)).setOrigin(0, 0.5));
      this.list.add(this.add.text(116, yy + 58, w.id, t(14, '#6d7d9c')).setOrigin(0, 0.5));
      this.list.add(this.add.text(116, yy + 80, dateStr(w.date), t(13, '#54628a')).setOrigin(0, 0.5));

      const sg = this.add.graphics();
      const isPending = w.status === 'PENDING';
      const col = isPending ? C.gold : C.green;
      rr(sg, DW - 176, yy + 34, 140, 40, 20, col, 0.16);
      rrs(sg, DW - 176, yy + 34, 140, 40, 20, col, 2, 0.8);
      this.list.add(sg);
      this.list.add(
        this.add
          .text(DW - 106, yy + 54, w.status, t(16, isPending ? TXT.gold : TXT.green))
          .setOrigin(0.5)
      );

      yy += H + 12;
    });

    return yy + 20;
  }

  // ─────────────────────────────── actions
  private refreshAll(): void {
    this.redraws.forEach((r) => r());
  }

  /** In-canvas keypad / text entry overlay (no DOM inputs needed). */
  private promptAccount(): void {
    this.data.set('modal', true);
    const layer = this.add.container(0, 0).setDepth(900);
    const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x02040a, 0.9).setInteractive();
    layer.add(shade);

    const numeric = this.method.id === 'bank';
    const PW = DW - 60;
    const PH = numeric ? 720 : 620;
    const px = 30;
    const py = (DH - PH) / 2;

    const g = this.add.graphics();
    rr(g, px, py, PW, PH, 28, 0x101827, 1);
    rrs(g, px, py, PW, PH, 28, this.method.color, 3, 0.9);
    rr(g, px, py, PW, 84, 28, this.method.color, 1);
    g.fillStyle(this.method.color, 1);
    g.fillRect(px, py + 50, PW, 34);
    layer.add(g);
    layer.add(
      this.add
        .text(DW / 2, py + 42, this.method.name.toUpperCase() + ' DETAILS', {
          fontFamily: FONT_D,
          fontSize: '34px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setStroke('#00000055', 5)
    );

    layer.add(this.add.text(DW / 2, py + 116, this.method.hint, t(17, TXT.dim)).setOrigin(0.5));

    let value = S.account[this.method.id] ?? '';
    const fieldG = this.add.graphics();
    layer.add(fieldG);
    const valTxt = this.add
      .text(DW / 2, py + 176, '', { fontFamily: FONT, fontSize: '26px', color: '#eaf1ff' })
      .setOrigin(0.5);
    layer.add(valTxt);
    const caret = this.add.rectangle(0, py + 176, 3, 30, 0x7bf0ae);
    layer.add(caret);
    this.tweens.add({ targets: caret, alpha: 0, duration: 480, yoyo: true, repeat: -1 });

    const drawField = (): void => {
      fieldG.clear();
      rr(fieldG, px + 26, py + 146, PW - 52, 62, 16, 0x070c16, 1);
      rrs(fieldG, px + 26, py + 146, PW - 52, 62, 16, value ? C.green : C.stroke, 2, 0.85);
      const shown = value || this.method.placeholder;
      valTxt.setText(shown.length > 26 ? '\u2026' + shown.slice(-25) : shown);
      valTxt.setColor(value ? '#eaf1ff' : '#546283');
      caret.setX(valTxt.x + valTxt.width / 2 + 8).setVisible(!!value);
    };
    drawField();

    // keypad
    const keys: string[] = numeric
      ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'DEL']
      : ['@', '.', '_', '-', 'CLR', 'DEL'];

    const kw = numeric ? (PW - 52 - 3 * 10) / 3 : (PW - 52 - 5 * 8) / 6;
    const kh = numeric ? 68 : 60;
    const ky = py + 236;

    keys.forEach((k, i) => {
      const col = numeric ? i % 3 : i;
      const rowI = numeric ? Math.floor(i / 3) : 0;
      const x = px + 26 + col * (kw + (numeric ? 10 : 8)) + kw / 2;
      const yy = ky + rowI * (kh + 10) + kh / 2;
      const isAct = k === 'CLR' || k === 'DEL';
      const b = new Btn(this, x, yy, {
        w: kw,
        h: kh,
        label: k === 'DEL' ? '\u232b' : k,
        color: isAct ? C.grey : C.panelLite,
        shadow: isAct ? 0x1b2436 : 0x0f1626,
        fontSize: numeric ? 26 : 22,
        radius: 14,
        onClick: () => {
          if (k === 'CLR') value = '';
          else if (k === 'DEL') value = value.slice(0, -1);
          else if (value.length < 34) value += k;
          drawField();
          save();
        },
      });
      layer.add(b);
    });

    // letters row for non-numeric (quick presets)
    const presetY = numeric ? ky + 4 * (kh + 10) + 6 : ky + kh + 24;
    if (!numeric) {
      const presets =
        this.method.id === 'paypal'
          ? ['gmail.com', 'yahoo.com', 'outlook.com']
          : this.method.id === 'upi'
            ? ['@okaxis', '@okhdfcbank', '@paytm']
            : ['TRC20', 'TX9f', 'USDT'];
      const pw2 = (PW - 52 - 2 * 10) / 3;
      presets.forEach((p, i) => {
        const b = new Btn(this, px + 26 + i * (pw2 + 10) + pw2 / 2, presetY + 30, {
          w: pw2,
          h: 58,
          label: p,
          color: C.blueDk,
          shadow: 0x0c2a5c,
          fontSize: 17,
          radius: 14,
          onClick: () => {
            if (value.length < 30) value += p;
            drawField();
          },
        });
        layer.add(b);
      });
    }

    // hidden DOM input so real keyboards work too
    const dom = document.createElement('input');
    dom.type = numeric ? 'tel' : 'text';
    dom.value = value;
    dom.style.cssText =
      'position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px;border:0;padding:0;';
    dom.maxLength = 34;
    document.body.appendChild(dom);
    const syncFromDom = (): void => {
      value = dom.value.slice(0, 34);
      drawField();
    };
    dom.addEventListener('input', syncFromDom);
    setTimeout(() => {
      try {
        dom.focus();
      } catch {
        /* ignore */
      }
    }, 120);

    const cleanup = (): void => {
      dom.removeEventListener('input', syncFromDom);
      dom.remove();
      layer.destroy();
      this.data.set('modal', false);
    };

    const kbHint = this.add
      .text(DW / 2, presetY + (numeric ? 6 : 76), 'You can also type with your keyboard', t(14, '#5d6b88'))
      .setOrigin(0.5);
    layer.add(kbHint);

    const saveBtn = new Btn(this, DW / 2, py + PH - 58, {
      w: PW - 52,
      h: 82,
      label: 'SAVE DETAILS',
      color: C.green,
      shadow: C.greenDk,
      fontSize: 26,
      radius: 22,
      onClick: () => {
        const v = value.trim();
        if (v.length < 4) {
          toast(this, 'Enter valid details', C.red);
          return;
        }
        if (this.method.id === 'paypal' && !v.includes('@')) {
          toast(this, 'E-mail must contain @', C.red);
          return;
        }
        S.account[this.method.id] = v;
        save();
        sfx('confirm');
        toast(this, this.method.name + ' details saved', C.green);
        cleanup();
        this.refreshAll();
      },
    });
    layer.add(saveBtn);

    const cancel = this.add
      .text(DW / 2, py + PH + 34, 'Cancel', t(19, '#8ea1c2'))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    cancel.on('pointerdown', () => {
      sfx('click');
      cleanup();
    });
    layer.add(cancel);

    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 200 });
  }

  private submit(): void {
    const amt = this.amount;
    if (S.cash < amt) {
      toast(this, 'Insufficient balance', C.red);
      return;
    }
    const acc = S.account[this.method.id];
    if (!acc) {
      this.promptAccount();
      return;
    }
    this.processing(amt, acc);
  }

  /** Bank-style processing overlay with staged status, then receipt. */
  private processing(amt: number, acc: string): void {
    this.data.set('modal', true);
    const layer = this.add.container(0, 0).setDepth(1000);
    const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x02040a, 0.94).setInteractive();
    layer.add(shade);

    const ring = this.add.graphics();
    layer.add(ring);
    const pctTxt = this.add
      .text(DW / 2, DH / 2 - 90, '0%', { fontFamily: FONT, fontSize: '40px', color: '#7bf0ae' })
      .setOrigin(0.5);
    layer.add(pctTxt);

    const title = this.add
      .text(DW / 2, DH / 2 + 60, 'PROCESSING PAYOUT', { fontFamily: FONT_D, fontSize: '42px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#0b1020', 7);
    layer.add(title);

    const steps = [
      'Verifying account\u2026',
      'Checking balance\u2026',
      'Contacting ' + this.method.name + '\u2026',
      'Encrypting transfer\u2026',
      'Queuing payout\u2026',
    ];
    const stepTxt = this.add.text(DW / 2, DH / 2 + 116, steps[0], t(20, '#8ea1c2')).setOrigin(0.5);
    layer.add(stepTxt);

    const checkG = this.add.graphics();
    layer.add(checkG);

    let p = 0;
    let stepI = 0;
    const total = 2600;
    let elapsed = 0;

    const timer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        elapsed += 16;
        p = Phaser.Math.Clamp(elapsed / total, 0, 1);
        const cx = DW / 2;
        const cy = DH / 2 - 90;
        ring.clear();
        ring.lineStyle(14, 0x14243a, 1);
        ring.strokeCircle(cx, cy, 92);
        ring.lineStyle(14, 0x2fd074, 1);
        ring.beginPath();
        ring.arc(cx, cy, 92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false);
        ring.strokePath();
        pctTxt.setText(Math.round(p * 100) + '%');

        const si = Math.min(steps.length - 1, Math.floor(p * steps.length));
        if (si !== stepI) {
          stepI = si;
          stepTxt.setText(steps[si]);
          sfx('click', 1.5, 0.4);
          checkG.clear();
          for (let k = 0; k < si; k++) {
            checkG.fillStyle(0x2fd074, 1);
            checkG.fillCircle(DW / 2 - 60 + k * 30, DH / 2 + 156, 7);
          }
        }

        if (p >= 1) {
          timer.remove();
          layer.destroy();
          this.completeWithdrawal(amt, acc);
        }
      },
    });

    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 180 });
  }

  private completeWithdrawal(amt: number, acc: string): void {
    S.cash = Math.max(0, S.cash - amt);
    const w: Withdrawal = {
      id: txnId(),
      amount: amt,
      method: this.method.id,
      methodName: this.method.name,
      account: acc,
      date: Date.now(),
      status: 'PENDING',
    };
    S.withdrawals.unshift(w);
    S.withdrawals = S.withdrawals.slice(0, 30);
    save();
    sfx('unlock', 0.9);
    this.receipt(w);
  }

  private receipt(w: Withdrawal): void {
    this.data.set('modal', true);
    const layer = this.add.container(0, 0).setDepth(1100);
    const shade = this.add.rectangle(DW / 2, DH / 2, DW, DH, 0x02040a, 0.93).setInteractive();
    layer.add(shade);

    const PW = DW - 76;
    const PH = 660;
    const px = 38;
    const py = (DH - PH) / 2;

    const g = this.add.graphics();
    rr(g, px, py, PW, PH, 28, 0x0f1626, 1);
    rrs(g, px, py, PW, PH, 28, C.green, 3, 0.85);
    g.fillStyle(0x11412d, 1);
    g.fillRoundedRect(px, py, PW, 150, { tl: 28, tr: 28, bl: 0, br: 0 });
    layer.add(g);

    // perforated bottom edge
    const perf = this.add.graphics();
    perf.fillStyle(0x02040a, 1);
    for (let i = 0; i < 16; i++) perf.fillCircle(px + 14 + i * ((PW - 28) / 15), py + PH, 9);
    layer.add(perf);

    // success tick
    const tick = this.add.graphics();
    tick.fillStyle(0x2fd074, 1);
    tick.fillCircle(DW / 2, py + 74, 44);
    tick.lineStyle(9, 0x0f1626, 1);
    tick.beginPath();
    tick.moveTo(DW / 2 - 20, py + 74);
    tick.lineTo(DW / 2 - 5, py + 90);
    tick.lineTo(DW / 2 + 22, py + 58);
    tick.strokePath();
    layer.add(tick);
    tick.setScale(0);
    this.tweens.add({ targets: tick, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.easeOut' });

    layer.add(
      this.add
        .text(DW / 2, py + 184, 'WITHDRAWAL REQUESTED', { fontFamily: FONT_D, fontSize: '38px', color: '#7bf0ae' })
        .setOrigin(0.5)
        .setStroke('#052018', 6)
    );
    layer.add(
      this.add
        .text(DW / 2, py + 252, goldFull(w.amount), { fontFamily: FONT_D, fontSize: '76px', color: '#ffffff' })
        .setOrigin(0.5)
        .setStroke('#0b1020', 8)
    );

    const rows: Array<[string, string]> = [
      ['Transaction ID', w.id],
      ['Method', w.methodName],
      ['Account', mask(w.account)],
      ['Fee', 'FREE'],
      ['You receive', goldFull(w.amount)],
      ['Status', w.status],
      ['Arrival', this.method.eta],
      ['Date', dateStr(w.date)],
    ];
    rows.forEach(([k, v], i) => {
      const yy = py + 316 + i * 34;
      layer.add(this.add.text(px + 30, yy, k, t(16, TXT.dim)).setOrigin(0, 0.5));
      layer.add(
        this.add
          .text(px + PW - 30, yy, v, t(17, i === 5 ? TXT.gold : i === 4 ? TXT.green : TXT.light))
          .setOrigin(1, 0.5)
      );
    });

    const burst = this.add.particles(DW / 2, py + 74, 'spark', {
      speed: { min: 160, max: 480 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.7, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1000,
      quantity: 34,
      blendMode: 'ADD',
      tint: [0x2fd074, 0xffffff, 0x9df2ff],
      emitting: false,
    });
    layer.add(burst);
    burst.explode(38);
    this.cameras.main.flash(200, 120, 255, 190, false);

    const done = new Btn(this, DW / 2, py + PH + 66, {
      w: PW,
      h: 88,
      label: 'DONE',
      color: C.green,
      shadow: C.greenDk,
      fontSize: 30,
      radius: 24,
      onClick: () => {
        layer.destroy();
        this.scene.restart();
      },
    });
    layer.add(done);

    layer.setAlpha(0).setScale(0.95);
    this.tweens.add({ targets: layer, alpha: 1, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
  }
}
