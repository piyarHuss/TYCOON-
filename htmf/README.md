# STONE TYCOON — Plain HTML Build

Pure HTML + JavaScript. **Koi build step nahi, koi npm nahi, koi bundler nahi.**

---

## Do tareeke se chala sakte ho

### 1. `stone-tycoon-offline.html` — single file (sabse aasan)

Bas **double-click** karo. Bas itna hi.

- Sab kuch ek hi file me hai: Phaser, Howler, saare 19 sprites, 6 sounds, 2 fonts
- Internet ki zaroorat **nahi**
- Server ki zaroorat **nahi**
- WhatsApp / email / pendrive se bhej sakte ho — kisi bhi PC par chalega

### 2. Poora folder — agar edit karna ho

```
index.html          <- ye kholo
css/style.css
js/game.js          <- saara game code (plain JavaScript)
lib/phaser.min.js
lib/howler.min.js
lib/webfontloader.js
sprites/            19 PNG
sfx/                6 sounds
fonts/              2 TTF
```

`index.html` ko browser me kholo. Agar sprites load na hon (kuch browsers
`file://` par images block karte hain), to chhota sa local server chala lo:

```bash
# Python (zyada tar systems me pehle se hota hai)
python3 -m http.server 8000
# phir kholo: http://localhost:8000

# ya Node
npx serve .
```

---

## Game kaise khelein

| Action | Kya hota hai |
|---|---|
| Rock par tap | Pickaxe se damage — combo banao |
| MINERS button | Miners hire/upgrade karo, wo khud mining karte hain |
| Ad dekho | Naye characters unlock hote hain (1 se 5 ads) |
| UPGRADE | Tap Power, Gold Rush, Lucky Charm |
| REWARDS | Ad se cash, gems, ya x2 boost |
| CASH OUT | Withdrawal — PayPal / UPI / Bank / Crypto |

Har 10th level par **BOSS rock** aata hai — 30 second ka timer hota hai.

---

## Code edit karna

`js/game.js` kisi bhi editor me kholo (Notepad bhi chalega). Upar ki taraf
saari tuning values hain:

```js
const MINERS = [ … ]        // miner ke naam, DPS, cost, kitne ads chahiye
const TIERS  = [ … ]        // rock ke 6 types
function rockMaxHp(level)   // rock kitna mota hai
function coinReward(level)  // kitne coins milte hain
const AMOUNTS = [5,10,25,50,100]   // withdrawal options
const MIN_WITHDRAW = 5      // minimum cash out
const PAYOUTS = [ … ]       // payment methods
```

Number badlo → **save** → browser **refresh**. Bas.

---

## Technical

- **Engine:** Phaser 3.90 (vendored, CDN nahi)
- **Audio:** Howler 2.2
- **Fonts:** Russo One + Bangers (local TTF)
- **Save:** browser localStorage
- **Scripts:** classic `<script>` tags — koi ES module nahi, koi bundler nahi
- **Resolution:** 720x1280 portrait, auto-fit har screen par

> **Note:** Withdrawal system sirf demo hai — koi asli paisa involve nahi hai.
> Saare assets CC0 licensed hain.
