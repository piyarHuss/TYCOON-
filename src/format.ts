const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];

/** Compact idle-game number formatting: 1.23K / 45.6M / 7.89B */
export function fmt(n: number): string {
  if (!isFinite(n)) return '\u221e';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) {
    if (n < 10 && Math.floor(n) !== n) return n.toFixed(1);
    return String(Math.floor(n));
  }
  let i = 0;
  let v = n;
  while (v >= 1000 && i < SUF.length - 1) {
    v /= 1000;
    i++;
  }
  const s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.floor(v));
  return s + SUF[i];
}

/** $1,234.56 */
export function money(n: number): string {
  const neg = n < 0;
  const s = Math.abs(n).toFixed(2);
  const parts = s.split('.');
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-$' : '$') + whole + '.' + parts[1];
}

export function gold(n: number): string {
  return fmt(n) + ' GOLD';
}

export function goldFull(n: number): string {
  const whole = Math.floor(Math.max(0, n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return whole + ' GOLD';
}

export function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
}

export function dateStr(ts: number): string {
  const d = new Date(ts);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${pad2(d.getDate())} ${M[d.getMonth()]} ${d.getFullYear()} \u00b7 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function mask(s: string): string {
  if (!s) return '\u2014';
  if (s.length <= 6) return s;
  return s.slice(0, 3) + '\u2022'.repeat(Math.min(8, s.length - 5)) + s.slice(-3);
}

export function txnId(): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += c[Math.floor(Math.random() * c.length)];
  return 'STX-' + out.slice(0, 4) + '-' + out.slice(4, 10);
}
