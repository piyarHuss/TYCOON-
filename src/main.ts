import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { Game, DW, DH } from './scenes/Game';
import { AdScene } from './scenes/AdScene';
import { MinersPanel } from './scenes/MinersPanel';
import { UpgradePanel } from './scenes/UpgradePanel';
import { RewardsPanel } from './scenes/RewardsPanel';
import { CashPanel } from './scenes/CashPanel';
import { SettingsPanel } from './scenes/SettingsPanel';
import { S, save } from './save';
import { setMuted } from './audio';
import { adminConfig, applyAdminConfig } from './data';

setMuted(S.muted);
applyAdminConfig(adminConfig());
window.addEventListener('stone-tycoon-config-updated', (e) => {
  applyAdminConfig((e as CustomEvent).detail || adminConfig());
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05070d',
  width: DW,
  height: DH,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: { activePointers: 3 },
  scene: [Boot, Title, Game, AdScene, MinersPanel, UpgradePanel, RewardsPanel, CashPanel, SettingsPanel],
});

// persist on tab hide / close
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
window.addEventListener('pagehide', () => save());

export default game;
