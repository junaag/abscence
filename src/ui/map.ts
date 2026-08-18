import {
  normalizeMapUiState,
  updateMapViewport,
  type MapCoordinate,
  type MapUiState,
} from '../app/map-state';
import {
  ZONE_ALPHA_BOUNDS,
  ZONE_ALPHA_POIS,
  ZONE_ALPHA_ROADS,
  type ZoneAlphaPoi,
} from '../content/zone-alpha';
import { buildPoiBlueprint } from './poi-content';

type TravelTarget = {
  id: string;
  name: string;
  x: number;
  y: number;
  category?: ZoneAlphaPoi['category'];
  typeLabel?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function encodeTravelTarget(target: TravelTarget): string {
  const poi = target.category && target.typeLabel ? target as ZoneAlphaPoi : null;
  return encodeURIComponent(JSON.stringify({
    id: target.id,
    name: target.name,
    x: target.x,
    y: target.y,
    ...(target.category ? { category: target.category } : {}),
    ...(target.typeLabel ? { typeLabel: target.typeLabel } : {}),
    ...(poi ? { blueprint: buildPoiBlueprint(poi) } : {}),
  }));
}

function poiSymbol(poi: ZoneAlphaPoi): string {
  switch (poi.typeLabel) {
    case 'Habitation': return '⌂';
    case 'Pharmacie': return '✚';
    case 'Boulangerie': return '🥖';
    case 'Alimentation': return '🛒';
    case 'Station service': return '⛽';
    case 'Caserne de pompiers': return '🚒';
    default: return '●';
  }
}

function poiClass(poi: ZoneAlphaPoi): string {
  if (poi.category === 'Résidentiel') return 'residential';
  if (poi.category === 'Santé') return 'health';
  if (poi.category === 'Automobile') return 'automobile';
  if (poi.category === 'Services publics') return 'public';
  return 'commerce';
}

function screenY(y: number): number {
  return ZONE_ALPHA_BOUNDS.heightM - y;
}

function rectScreenY(y: number, heightM: number): number {
  return ZONE_ALPHA_BOUNDS.heightM - y - heightM;
}

function gridMarkup(): string {
  const vertical: string[] = [];
  const horizontal: string[] = [];
  for (let x = 0; x <= ZONE_ALPHA_BOUNDS.widthM; x += 50) {
    vertical.push(`<line x1="${x}" y1="0" x2="${x}" y2="${ZONE_ALPHA_BOUNDS.heightM}" />`);
    if (x > 0 && x < ZONE_ALPHA_BOUNDS.widthM) vertical.push(`<text x="${x + 3}" y="${ZONE_ALPHA_BOUNDS.heightM - 5}">${x}</text>`);
  }
  for (let y = 0; y <= ZONE_ALPHA_BOUNDS.heightM; y += 50) {
    const sy = screenY(y);
    horizontal.push(`<line x1="0" y1="${sy}" x2="${ZONE_ALPHA_BOUNDS.widthM}" y2="${sy}" />`);
    if (y > 0 && y < ZONE_ALPHA_BOUNDS.heightM) horizontal.push(`<text x="5" y="${Math.max(12, sy - 3)}">${y}</text>`);
  }
  return `<g class="zone-grid" aria-hidden="true">${vertical.join('')}${horizontal.join('')}</g>`;
}

function roadMarkup(): string {
  return ZONE_ALPHA_ROADS.map((road) => `<rect class="zone-road zone-road-${road.kind}" x="${road.x}" y="${rectScreenY(road.y, road.heightM)}" width="${road.widthM}" height="${road.heightM}" rx="2" />`).join('');
}

function buildingMarkup(): string {
  return ZONE_ALPHA_POIS.map((poi) => {
    const x = poi.x - poi.widthM / 2;
    const y = screenY(poi.y) - poi.heightM / 2;
    return `<rect class="zone-building zone-building-${poiClass(poi)}" x="${x}" y="${y}" width="${poi.widthM}" height="${poi.heightM}" rx="4" />`;
  }).join('');
}

function fogMarkup(state: MapUiState): string {
  const areas = state.explored.map((area) => `<circle cx="${area.x}" cy="${screenY(area.y)}" r="${area.radiusM}" fill="black" />`).join('');
  const corridors = state.exploredCorridors.map((corridor) => {
    const points = corridor.points.map((point) => `${point.x},${screenY(point.y)}`).join(' ');
    return `<polyline points="${points}" fill="none" stroke="black" stroke-width="${corridor.radiusM * 2}" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join('');
  return `
    <defs>
      <pattern id="absenceFogTexture" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="14" height="14" fill="#3e4449" />
        <line x1="0" y1="0" x2="0" y2="14" stroke="#596168" stroke-width="2" opacity=".35" />
      </pattern>
      <mask id="absenceFogMask">
        <rect width="100%" height="100%" fill="white" />
        ${areas}${corridors}
      </mask>
    </defs>
    <rect data-testid="map-fog" data-explored-areas="${state.explored.length}" data-explored-corridors="${state.exploredCorridors.length}" x="0" y="0" width="${ZONE_ALPHA_BOUNDS.widthM}" height="${ZONE_ALPHA_BOUNDS.heightM}" fill="url(#absenceFogTexture)" mask="url(#absenceFogMask)" opacity=".985" />
  `;
}

function poiMarkup(): string {
  return ZONE_ALPHA_POIS.map((poi) => {
    const y = screenY(poi.y);
    const label = poi.category === 'Résidentiel' ? poi.name : poi.typeLabel;
    return `
      <g class="zone-alpha-poi zone-alpha-poi-${poiClass(poi)}" data-poi-id="${escapeHtml(poi.id)}" role="button" tabindex="0" aria-label="${escapeHtml(`${poi.name} — ${poi.typeLabel}`)}">
        <circle cx="${poi.x}" cy="${y}" r="12" />
        <text class="zone-alpha-poi-symbol" x="${poi.x}" y="${y + 4}" text-anchor="middle">${poiSymbol(poi)}</text>
        <text class="zone-alpha-poi-label" x="${poi.x}" y="${y + 23}" text-anchor="middle">${escapeHtml(label)}</text>
      </g>
    `;
  }).join('');
}

function playerMarkup(playerPosition: MapCoordinate | null): string {
  if (!playerPosition) return '';
  return `<g class="zone-alpha-player" data-testid="map-player"><circle cx="${playerPosition.x}" cy="${screenY(playerPosition.y)}" r="8" /><circle cx="${playerPosition.x}" cy="${screenY(playerPosition.y)}" r="3" /></g>`;
}

function mapSvg(state: MapUiState, playerPosition: MapCoordinate | null): string {
  const width = Math.round(ZONE_ALPHA_BOUNDS.widthM * state.zoom);
  const height = Math.round(ZONE_ALPHA_BOUNDS.heightM * state.zoom);
  return `
    <div class="zone-alpha-scroll" data-zone-scroll>
      <svg class="zone-alpha-map" data-zone-map data-testid="zone-alpha-map" viewBox="0 0 ${ZONE_ALPHA_BOUNDS.widthM} ${ZONE_ALPHA_BOUNDS.heightM}" width="${width}" height="${height}" aria-label="Zone Alpha, coordonnées locales en mètres">
        <rect class="zone-ground" width="${ZONE_ALPHA_BOUNDS.widthM}" height="${ZONE_ALPHA_BOUNDS.heightM}" />
        ${gridMarkup()}
        ${roadMarkup()}
        ${buildingMarkup()}
        ${fogMarkup(state)}
        ${poiMarkup()}
        ${playerMarkup(playerPosition)}
        <g class="zone-axis" aria-hidden="true"><text x="${ZONE_ALPHA_BOUNDS.widthM - 28}" y="${ZONE_ALPHA_BOUNDS.heightM - 8}">X →</text><text x="8" y="18">Y ↑</text><text x="${ZONE_ALPHA_BOUNDS.widthM - 55}" y="22">N ↑</text></g>
      </svg>
    </div>
  `;
}

function poiPopup(poi: ZoneAlphaPoi): string {
  const target = encodeTravelTarget(poi);
  return `
    <div class="zone-alpha-popup" data-zone-popup>
      <div class="zone-alpha-popup-copy"><strong>${escapeHtml(poi.name)}</strong><span>${escapeHtml(poi.typeLabel)} · X ${Math.round(poi.x)} · Y ${Math.round(poi.y)}</span></div>
      <button type="button" data-zone-travel="${target}">S’y rendre</button>
      <button type="button" class="zone-popup-close" data-zone-popup-close aria-label="Fermer">×</button>
    </div>
  `;
}

function walkPopup(point: MapCoordinate): string {
  const target = encodeTravelTarget({ id: 'walk', name: 'Rue / extérieur', x: point.x, y: point.y });
  return `
    <div class="zone-alpha-popup" data-zone-popup>
      <div class="zone-alpha-popup-copy"><strong>Déplacement à pied</strong><span>X ${Math.round(point.x)} · Y ${Math.round(point.y)}</span></div>
      <button type="button" data-zone-walk="${target}">Marcher ici</button>
      <button type="button" class="zone-popup-close" data-zone-popup-close aria-label="Fermer">×</button>
    </div>
  `;
}

export interface MapController {
  attach(slot: HTMLElement): void;
  detach(): void;
  sync(state: MapUiState, playerPosition?: MapCoordinate | null): void;
  getState(): MapUiState;
  destroy(): void;
}

export function createMapController(
  initialState: MapUiState,
  persist: (state: MapUiState) => void,
  onTravel: (encodedTarget: string) => void = () => undefined,
  onWalk: (encodedTarget: string) => void = () => undefined,
  initialPlayerPosition: MapCoordinate | null = null,
): MapController {
  const host = document.createElement('div');
  host.className = 'zone-alpha-host';
  host.dataset.testid = 'zone-alpha-host';
  let state = normalizeMapUiState(initialState);
  let playerPosition = initialPlayerPosition ? { ...initialPlayerPosition } : null;
  let popup = '';
  let attachedOnce = false;

  const render = (): void => {
    host.innerHTML = `<div class="zone-alpha-toolbar"><div><strong>Zone Alpha</strong><span>Repère local métrique</span></div><div class="zone-alpha-zoom"><button type="button" data-zone-zoom="out">−</button><span>${Math.round(state.zoom * 100)} %</span><button type="button" data-zone-zoom="in">+</button></div></div>${mapSvg(state, playerPosition)}${popup}`;
  };

  const persistZoom = (zoom: number): void => {
    state = updateMapViewport(state, state.center.x, state.center.y, zoom);
    persist(structuredClone(state));
    render();
  };

  const mapPointFromEvent = (event: MouseEvent, svg: SVGSVGElement): MapCoordinate | null => {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const screenX = (event.clientX - rect.left) / rect.width * ZONE_ALPHA_BOUNDS.widthM;
    const screenMapY = (event.clientY - rect.top) / rect.height * ZONE_ALPHA_BOUNDS.heightM;
    const x = Math.max(0, Math.min(ZONE_ALPHA_BOUNDS.widthM, screenX));
    const y = Math.max(0, Math.min(ZONE_ALPHA_BOUNDS.heightM, ZONE_ALPHA_BOUNDS.heightM - screenMapY));
    return { x, y };
  };

  host.addEventListener('click', (event) => {
    const target = event.target as Element;
    const zoomButton = target.closest<HTMLButtonElement>('[data-zone-zoom]');
    if (zoomButton) {
      event.preventDefault();
      const delta = zoomButton.dataset.zoneZoom === 'in' ? 0.2 : -0.2;
      persistZoom(state.zoom + delta);
      return;
    }

    const close = target.closest('[data-zone-popup-close]');
    if (close) {
      popup = '';
      render();
      return;
    }

    const travel = target.closest<HTMLButtonElement>('[data-zone-travel]');
    if (travel?.dataset.zoneTravel) {
      const encoded = travel.dataset.zoneTravel;
      popup = '';
      render();
      onTravel(encoded);
      return;
    }

    const walk = target.closest<HTMLButtonElement>('[data-zone-walk]');
    if (walk?.dataset.zoneWalk) {
      const encoded = walk.dataset.zoneWalk;
      popup = '';
      render();
      onWalk(encoded);
      return;
    }

    const poiElement = target.closest<SVGGElement>('[data-poi-id]');
    if (poiElement?.dataset.poiId) {
      const poi = ZONE_ALPHA_POIS.find((candidate) => candidate.id === poiElement.dataset.poiId);
      if (poi) {
        popup = poiPopup(poi);
        render();
      }
      return;
    }

    const svg = target.closest<SVGSVGElement>('[data-zone-map]');
    if (!svg) return;
    const point = mapPointFromEvent(event, svg);
    if (!point) return;
    popup = walkPopup(point);
    render();
  });

  host.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as Element;
    const poiElement = target.closest<SVGGElement>('[data-poi-id]');
    if (!poiElement?.dataset.poiId) return;
    const poi = ZONE_ALPHA_POIS.find((candidate) => candidate.id === poiElement.dataset.poiId);
    if (!poi) return;
    event.preventDefault();
    popup = poiPopup(poi);
    render();
  });

  const scrollToStateCenter = (): void => {
    const scroll = host.querySelector<HTMLElement>('[data-zone-scroll]');
    if (!scroll) return;
    const scale = state.zoom;
    const targetX = state.center.x * scale;
    const targetY = screenY(state.center.y) * scale;
    scroll.scrollLeft = Math.max(0, targetX - scroll.clientWidth / 2);
    scroll.scrollTop = Math.max(0, targetY - scroll.clientHeight / 2);
  };

  render();

  return {
    attach(slot): void {
      if (host.parentElement !== slot) slot.append(host);
      render();
      if (!attachedOnce) {
        attachedOnce = true;
        window.requestAnimationFrame(scrollToStateCenter);
      }
    },
    detach(): void { host.remove(); },
    sync(nextState, nextPlayerPosition): void {
      state = normalizeMapUiState(nextState);
      if (nextPlayerPosition !== undefined) playerPosition = nextPlayerPosition ? { ...nextPlayerPosition } : null;
      render();
    },
    getState(): MapUiState { return structuredClone(state); },
    destroy(): void { host.remove(); popup = ''; },
  };
}
