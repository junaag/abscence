import {
  containerContents,
  containersAtCurrentLocation,
  currentLocation,
  describeItemExamination,
  formatClock,
  getContainerActions,
  getContextActions,
  getItemActions,
  getMobileNetworkState,
  getWeatherState,
  inventoryItems,
  looseItemsAtCurrentLocation,
  phoneCalls,
  phoneDeviceItemId,
  phoneMessages,
  type ActionOption,
  type ActionResult,
  type GameState,
  type WeatherCondition,
} from '../app/game-api';
import { describeCurrentLocation } from '../narrative/location';

export type ViewId = 'home' | 'map' | 'inventory' | 'phone';
export type PhoneTab = 'home' | 'calls' | 'messages' | 'weather';

export interface UiState {
  view: ViewId;
  phoneTab: PhoneTab;
  popupTarget: { kind: 'item' | 'container'; id: string } | undefined;
  result: ActionResult | undefined;
}

const STAT_META = [
  ['healthPv', '❤️', 'Santé', 'Points de vie. À 0 PV, le personnage meurt.'],
  ['hunger', '🍽️', 'Faim', 'Plus le pourcentage monte, plus la faim devient critique.'],
  ['thirst', '💧', 'Soif', '0 % = aucune soif ; 100 % = situation critique.'],
  ['fatigue', '💤', 'Fatigue', 'Représente le besoin de repos et de sommeil.'],
  ['stress', '🧠', 'Stress', 'Le stress peut perturber certaines décisions et actions.'],
  ['pain', '🩹', 'Douleur', 'La douleur reflète blessures et inconfort physique.'],
] as const;

const WEATHER_META: Record<WeatherCondition, { icon: string; label: string }> = {
  clear: { icon: '☀️', label: 'Ciel dégagé' },
  partly_cloudy: { icon: '🌤️', label: 'Éclaircies' },
  cloudy: { icon: '☁️', label: 'Couvert' },
  rain: { icon: '🌧️', label: 'Pluie' },
  storm: { icon: '⛈️', label: 'Orage' },
  fog: { icon: '🌫️', label: 'Brouillard' },
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function statValue(state: GameState, key: (typeof STAT_META)[number][0]): string {
  return key === 'healthPv'
    ? `${Math.round(state.player.healthPv)} PV`
    : `${Math.round(state.player.needs[key])} %`;
}

export function renderHud(state: GameState): string {
  const location = currentLocation(state);
  const stats = STAT_META.map(([key, icon, label, description]) => `
    <button class="stat" type="button" data-stat="${key}" data-stat-label="${label}" data-stat-description="${description}">
      <span class="icon">${icon}</span>
      <span class="value">${statValue(state, key)}</span>
    </button>
  `).join('');

  return `
    <header class="hud" data-testid="hud">
      <div class="hud-top">
        <div>
          <div class="clock">${formatClock(state)}</div>
          <div class="place">${escapeHtml(location.name)}</div>
        </div>
        <button class="close" type="button" data-menu aria-label="Menu">☰</button>
      </div>
      <div class="stats">${stats}</div>
    </header>
  `;
}

function actionButton(action: ActionOption): string {
  return `
    <button class="action" type="button" data-action="${action.id}"
      ${action.targetId ? `data-target="${escapeHtml(action.targetId)}"` : ''}
      ${action.sourceId ? `data-source="${escapeHtml(action.sourceId)}"` : ''}
      ${action.amountMl !== undefined ? `data-amount="${action.amountMl}"` : ''}
      ${action.seconds !== undefined ? `data-seconds="${action.seconds}"` : ''}>
      <div class="row-main">
        <div class="row-title">${escapeHtml(action.label)}</div>
        ${action.detail ? `<div class="row-sub">${escapeHtml(action.detail)}</div>` : ''}
      </div>
      <div class="chev">›</div>
    </button>
  `;
}

function objectRow(kind: 'item' | 'container', id: string, icon: string, title: string, sub: string): string {
  return `
    <button class="row" type="button" data-open-${kind}="${escapeHtml(id)}">
      <div class="row-icon">${icon}</div>
      <div class="row-main">
        <div class="row-title">${escapeHtml(title)}</div>
        <div class="row-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="chev">›</div>
    </button>
  `;
}

function resultCard(result: ActionResult | undefined): string {
  if (!result) return '';
  return `
    <div class="card result">
      <div class="result-title">${escapeHtml(result.title)}</div>
      <div class="result-body">${escapeHtml(result.body)}</div>
    </div>
  `;
}

export function renderHomeView(state: GameState, ui: UiState): string {
  const location = currentLocation(state);
  const looseItems = looseItemsAtCurrentLocation(state);
  const containers = containersAtCurrentLocation(state);
  const actions = getContextActions(state);
  const objectRows = [
    ...containers.map((container) => objectRow(
      'container',
      container.id,
      '🗄️',
      container.name,
      container.open ? 'Ouvert' : container.locked ? 'Verrouillé' : 'Fermé',
    )),
    ...looseItems.map((item) => objectRow('item', item.id, '📦', item.name, 'Objet à portée de main')),
  ].join('');

  return `
    <main data-testid="home-view">
      <section class="card hero">
        <div class="eyebrow">Situation</div>
        <h1>${escapeHtml(location.name)}</h1>
        <div class="copy">${escapeHtml(describeCurrentLocation(state))}</div>
      </section>
      ${resultCard(ui.result)}
      <div class="section-title">Objets et contenants présents</div>
      ${objectRows || '<div class="empty">Aucun objet visible ici.</div>'}
      <div class="section-title">Actions</div>
      ${actions.map(actionButton).join('')}
    </main>
  `;
}

export function renderInventoryView(state: GameState, ui: UiState): string {
  const items = inventoryItems(state);
  const rows = items.length > 0
    ? items.map((item) => objectRow('item', item.id, '🎒', item.name, item.examined ? 'Examiné' : 'Non examiné')).join('')
    : '<div class="empty">Inventaire vide.</div>';

  return `
    <main data-testid="inventory-view">
      <section class="card">
        <div class="eyebrow">Inventaire</div>
        <h1>Objets transportés</h1>
        <div class="copy">Les actions liées aux objets sont accessibles uniquement en touchant l’objet.</div>
      </section>
      ${resultCard(ui.result)}
      ${rows}
    </main>
  `;
}

function phoneContact(name: string, meta: string): string {
  return `
    <div class="phone-contact">
      <div class="phone-avatar" aria-hidden="true">${escapeHtml(name.slice(0, 1))}</div>
      <div class="phone-contact-copy">
        <div class="phone-contact-name">${escapeHtml(name)}</div>
        <div class="phone-contact-meta">${escapeHtml(meta)}</div>
      </div>
    </div>
  `;
}

function phoneHome(): string {
  return `
    <div class="phone-title">Téléphone</div>
    <div class="phone-apps">
      <button type="button" class="phone-app" data-phone-tab="calls"><span class="phone-app-icon">☎</span><span>Appels</span></button>
      <button type="button" class="phone-app" data-phone-tab="messages"><span class="phone-app-icon">✉</span><span>Messages</span></button>
      <button type="button" class="phone-app" data-phone-tab="weather"><span class="phone-app-icon">☁</span><span>Météo</span></button>
      <div class="phone-app phone-app-disabled" aria-disabled="true"><span class="phone-app-icon">⚙</span><span>Réglages</span><small>À reconnecter</small></div>
    </div>
    <div class="phone-note">L’historique et la météo du monde enregistrés sur l’appareil restent consultables même sans réseau.</div>
  `;
}

function phoneHistory(title: string, entries: ReadonlyArray<{ name: string; meta: string }>): string {
  return `
    <button type="button" class="phone-back" data-phone-tab="home">‹ Accueil</button>
    <div class="phone-title">${escapeHtml(title)}</div>
    <div class="phone-history">${entries.map((entry) => phoneContact(entry.name, entry.meta)).join('')}</div>
  `;
}

function phoneWeather(state: GameState): string {
  const weather = getWeatherState(state);
  const meta = WEATHER_META[weather.condition];
  return `
    <button type="button" class="phone-back" data-phone-tab="home">‹ Accueil</button>
    <div class="phone-title">Météo</div>
    <div class="phone-weather" data-testid="phone-weather">
      <div class="phone-weather-main">
        <div class="phone-weather-icon" aria-hidden="true">${meta.icon}</div>
        <div>
          <div class="phone-weather-temp">${weather.temperatureC.toFixed(1).replace('.0', '')} °C</div>
          <div class="phone-weather-condition">${escapeHtml(meta.label)}</div>
        </div>
      </div>
      <div class="phone-weather-grid">
        <div class="phone-weather-stat"><span>Humidité</span><strong>${Math.round(weather.humidityPct)} %</strong></div>
        <div class="phone-weather-stat"><span>Vent</span><strong>${weather.windKph.toFixed(1).replace('.0', '')} km/h</strong></div>
        <div class="phone-weather-stat"><span>Précipitations</span><strong>${weather.precipitationMmPerHour.toFixed(1).replace('.0', '')} mm/h</strong></div>
        <div class="phone-weather-stat"><span>Source</span><strong>Monde simulé</strong></div>
      </div>
    </div>
  `;
}

export function renderPhoneView(state: GameState, ui: UiState): string {
  const phone = state.items[phoneDeviceItemId(state)];
  const battery = phone?.batteryPercent;
  const mobile = getMobileNetworkState(state);
  const network = mobile.available ? `Réseau ${mobile.signalBars}/4` : 'Aucun réseau';
  const calls = phoneCalls(state).map((call) => ({ name: call.contactName, meta: call.displayTime }));
  const messages = phoneMessages(state).map((message) => ({
    name: message.contactName,
    meta: `${message.preview} · ${message.displayTime}`,
  }));
  const content = ui.phoneTab === 'calls'
    ? phoneHistory('Appels récents', calls)
    : ui.phoneTab === 'messages'
      ? phoneHistory('Messages', messages)
      : ui.phoneTab === 'weather'
        ? phoneWeather(state)
        : phoneHome();

  return `
    <main data-testid="phone-view">
      <section class="phone-shell">
        <div class="phone-status" data-testid="phone-status">
          <span>${formatClock(state)}</span>
          <span>${battery === undefined ? 'Batterie ?' : `Batterie ${battery.toFixed(1).replace('.0', '')} %`} · ${network}</span>
        </div>
        ${content}
      </section>
    </main>
  `;
}

export function renderMapView(): string {
  return '<main class="map-main" data-testid="map-view"><div class="map-shell" data-map-slot></div></main>';
}

export function renderNavigation(view: ViewId): string {
  const entries: Array<[ViewId, string, string]> = [
    ['home', '🏠', 'Accueil'],
    ['map', '🗺️', 'Carte'],
    ['inventory', '🎒', 'Inventaire'],
    ['phone', '📱', 'Téléphone'],
  ];
  return `<nav>${entries.map(([id, icon, label]) => `
    <button type="button" class="nav${view === id ? ' active' : ''}" data-nav="${id}">
      <span>${icon}</span>${label}
    </button>
  `).join('')}</nav>`;
}

export function renderTargetPopup(state: GameState, ui: UiState): string {
  const target = ui.popupTarget;
  if (!target) return '';

  if (target.kind === 'container') {
    const container = state.containers[target.id];
    if (!container) return '';
    const actions = getContainerActions(state, container.id);
    const contents = containerContents(state, container.id);
    const contentRows = contents.length > 0
      ? contents.map((item) => objectRow('item', item.id, '📦', item.name, 'Dans le contenant')).join('')
      : '<div class="empty">Ce contenant est vide.</div>';

    return `
      <div class="overlay">
        <section class="sheet" role="dialog" aria-modal="true">
          <div class="sheet-head">
            <div>
              <div class="sheet-title">${escapeHtml(container.name)}</div>
              <div class="sheet-sub">${container.open ? 'Ouvert' : container.locked ? 'Verrouillé' : 'Fermé'}</div>
            </div>
            <button type="button" class="close" data-close-popup>×</button>
          </div>
          ${actions.map(actionButton).join('')}
          ${container.open ? `<div class="section-title">Contenu</div>${contentRows}` : ''}
        </section>
      </div>
    `;
  }

  const item = state.items[target.id];
  if (!item) return '';
  const actions = getItemActions(state, item.id);
  const details = item.examined
    ? describeItemExamination(state, item.id)
    : 'Touchez « Examiner » pour découvrir son rôle, son fonctionnement et son état.';

  return `
    <div class="overlay">
      <section class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-head">
          <div>
            <div class="sheet-title">${escapeHtml(item.name)}</div>
            <div class="sheet-sub" data-testid="item-examination">${escapeHtml(details)}</div>
          </div>
          <button type="button" class="close" data-close-popup>×</button>
        </div>
        ${actions.map(actionButton).join('')}
      </section>
    </div>
  `;
}
