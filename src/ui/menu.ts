import type { UiPreferences } from '../app/preferences';

export type MenuPanel = 'menu' | 'settings' | 'about' | null;

function menuButton(label: string, detail: string, attribute: string): string {
  return `<button class="action" type="button" ${attribute}><div class="row-main"><div class="row-title">${label}</div><div class="row-sub">${detail}</div></div><div class="chev">›</div></button>`;
}

function shell(title: string, subtitle: string, body: string, back = false): string {
  return `<div class="overlay"><section class="sheet" role="dialog" aria-modal="true" data-testid="menu-sheet"><div class="sheet-head"><div><div class="sheet-title">${title}</div><div class="sheet-sub">${subtitle}</div></div><button type="button" class="close" data-close-popup>×</button></div>${back?'<button type="button" class="phone-back menu-back" data-menu-back>‹ Menu</button>':''}${body}</section></div>`;
}

export function menuOverlay(panel: MenuPanel, preferences: UiPreferences): string {
  if (panel === null) return '';
  if (panel === 'settings') {
    const status = preferences.soundEnabled ? 'Activé' : 'Coupé';
    return shell('Paramètres', 'Préférences de l’application', `<div class="settings-list"><button type="button" class="settings-row" data-toggle-sound role="switch" aria-checked="${preferences.soundEnabled}"><div><div class="row-title">Son</div><div class="row-sub">Effets sonores et ambiance du jeu.</div></div><span class="settings-value" data-testid="sound-setting">${status}</span></button></div>`, true);
  }
  if (panel === 'about') {
    return shell('À propos', 'ABSENCE · v0.2.0-dev', '<div class="about-copy"><p>Jeu de survie mobile centré sur un monde soudainement vidé de toute présence humaine.</p><p>Création : Julien Imbert.</p><p>Cette version est une refonte technique en cours et ne remplace pas encore la version stable.</p></div>', true);
  }
  return shell('Menu', 'ABSENCE · v0.2.0-dev', `<div class="section-title">Navigation</div>${menuButton('Accueil','Revenir à la situation actuelle.','data-menu-home')}${menuButton('Paramètres','Son et préférences de l’application.','data-open-settings')}${menuButton('À propos','Version, projet et créateur.','data-open-about')}`);
}
