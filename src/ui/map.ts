import * as L from 'leaflet';
import {
  DEFAULT_HOME_COORDINATES,
  isMapPointExplored,
  normalizeMapUiState,
  updateMapViewport,
  type ExploredMapArea,
  type ExploredMapCorridor,
  type MapCoordinate,
  type MapUiState,
} from '../app/map-state';
import {
  fetchOverpassPois,
  mapDistanceMeters,
  mapPoiCacheKey,
  MAP_POI_MAX_HOME_DISTANCE_M,
  MAP_POI_MIN_ZOOM,
  type MapPoi,
} from './map-pois';
import { buildPoiBlueprint } from './poi-content';

class FogCanvasLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private mapRef: L.Map | null = null;
  private areas: ExploredMapArea[];
  private corridors: ExploredMapCorridor[];
  private readonly drawBound = (): void => this.draw();

  constructor(areas: ExploredMapArea[], corridors: ExploredMapCorridor[]) {
    super();
    this.areas = structuredClone(areas);
    this.corridors = structuredClone(corridors);
  }

  override onAdd(map: L.Map): this {
    this.mapRef = map;
    const pane = map.getPane('fogPane');
    if (!pane) throw new Error('Missing Leaflet fog pane');
    const canvas = document.createElement('canvas');
    canvas.className = 'absence-fog-canvas';
    canvas.dataset.testid = 'map-fog';
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    pane.append(canvas);
    this.canvas = canvas;
    map.on('move zoom resize', this.drawBound);
    this.draw();
    return this;
  }

  override onRemove(map: L.Map): this {
    map.off('move zoom resize', this.drawBound);
    this.canvas?.remove();
    this.canvas = null;
    this.mapRef = null;
    return this;
  }

  setExploration(areas: ExploredMapArea[], corridors: ExploredMapCorridor[]): void {
    this.areas = structuredClone(areas);
    this.corridors = structuredClone(corridors);
    this.draw();
  }

  private radiusPixels(point: MapCoordinate, radiusM: number, map: L.Map): number {
    const earthRadiusM = 6378137;
    const latitudeOffset = radiusM / earthRadiusM * 180 / Math.PI;
    const center = map.latLngToContainerPoint([point.lat, point.lng]);
    const edge = map.latLngToContainerPoint([point.lat + latitudeOffset, point.lng]);
    return Math.max(1, Math.abs(edge.y - center.y));
  }

  private drawCorridor(context: CanvasRenderingContext2D, corridor: ExploredMapCorridor, map: L.Map): void {
    if (corridor.points.length < 2) return;
    const firstPoint = corridor.points[0]!;
    context.save();
    context.strokeStyle = '#000';
    context.lineWidth = Math.max(2, this.radiusPixels(firstPoint, corridor.radiusM, map) * 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    corridor.points.forEach((point, index) => {
      const projected = map.latLngToContainerPoint([point.lat, point.lng]);
      if (index === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    });
    context.stroke();
    context.restore();
  }

  private draw(): void {
    const map = this.mapRef;
    const canvas = this.canvas;
    if (!map || !canvas) return;
    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.x * dpr);
    canvas.height = Math.round(size.y * dpr);
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    canvas.dataset.exploredAreas = String(this.areas.length);
    canvas.dataset.exploredCorridors = String(this.corridors.length);
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.x, size.y);
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgba(62,68,73,.985)';
    context.fillRect(0, 0, size.x, size.y);

    context.strokeStyle = 'rgba(255,255,255,.07)';
    context.lineWidth = 1;
    context.beginPath();
    const spacing = 15;
    for (let offset = -size.y; offset < size.x + size.y; offset += spacing) {
      context.moveTo(offset, 0);
      context.lineTo(offset - size.y, size.y);
    }
    context.stroke();

    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000';
    for (const area of this.areas) {
      const center = map.latLngToContainerPoint([area.lat, area.lng]);
      const radius = this.radiusPixels(area, area.radiusM, map);
      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    for (const corridor of this.corridors) this.drawCorridor(context, corridor, map);
    context.globalCompositeOperation = 'source-over';
  }
}

function poiSymbol(poi: MapPoi): string {
  switch (poi.typeLabel) {
    case 'Habitation': return '🏠';
    case 'Supermarché': return '🛒';
    case 'Épicerie': return '🛒';
    case 'Boulangerie': return '🥖';
    case 'Primeur': return '🍎';
    case 'Librairie': return '📚';
    case 'Centre commercial': return '🏬';
    case 'Pharmacie': return '💊';
    case 'Hôpital': return '🏥';
    case 'Clinique': return '🏥';
    case 'Médecins': return '🩺';
    case 'Station service': return '⛽';
    case 'Garage / réparation auto': return '🔧';
    case 'Police': return '🚓';
    case 'Pompiers': return '🚒';
    case 'Mairie': return '🏛️';
    case 'Entrepôt': return '📦';
    case 'Site industriel': return '🏭';
    default: return '📍';
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

type TravelTarget = { id: string; name: string; lat: number; lng: number; category?: MapPoi['category']; typeLabel?: string };

function encodeTravelTarget(target: TravelTarget): string {
  const hasProfile = target.category !== undefined && target.typeLabel !== undefined;
  return encodeURIComponent(JSON.stringify({
    id: target.id,
    name: target.name,
    lat: target.lat,
    lon: target.lng,
    ...(target.category ? { category: target.category } : {}),
    ...(target.typeLabel ? { typeLabel: target.typeLabel } : {}),
    ...(hasProfile ? { blueprint: buildPoiBlueprint(target as MapPoi) } : {}),
  }));
}

function actionButton(label: string, actionId: 'TRAVEL_TO_MAP_POI' | 'WALK_TO_MAP_POINT', encodedTarget: string, handler: (encodedTarget: string) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.action = actionId;
  button.dataset.target = encodedTarget;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler(encodedTarget);
  });
  return button;
}

function poiIcon(poi: MapPoi): L.DivIcon {
  const category = escapeHtml(poi.category);
  return L.divIcon({
    className: `absence-poi-marker absence-poi-${poi.category.toLowerCase().replaceAll(' ', '-').replaceAll('é', 'e')}`,
    html: `<span data-poi-category="${category}" aria-label="${escapeHtml(`${poi.category} — ${poi.typeLabel}`)}">${poiSymbol(poi)}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -19],
  });
}

function poiPopup(poi: MapPoi, onTravel: (encodedTarget: string) => void): HTMLElement {
  const popup = document.createElement('div');
  popup.className = 'map-popup poi-popup';
  const category = document.createElement('strong'); category.textContent = poi.category;
  const name = document.createElement('span'); name.textContent = poi.name;
  const type = document.createElement('small'); type.textContent = poi.typeLabel;
  popup.append(category, name, type, actionButton('S’y rendre', 'TRAVEL_TO_MAP_POI', encodeTravelTarget(poi), onTravel));
  return popup;
}

function walkPopup(point: MapCoordinate, onWalk: (encodedTarget: string) => void): HTMLElement {
  const popup = document.createElement('div');
  popup.className = 'map-popup walk-popup';
  const title = document.createElement('strong'); title.textContent = 'Déplacement à pied';
  const note = document.createElement('small'); note.textContent = 'Avancer progressivement dans le quartier.';
  const target = encodeTravelTarget({ id: 'walk', name: 'Rue / extérieur', lat: point.lat, lng: point.lng });
  popup.append(title, note, actionButton('Marcher ici', 'WALK_TO_MAP_POINT', target, onWalk));
  return popup;
}

function homePoi(): MapPoi {
  return { id: 'home', name: 'Domicile', category: 'Résidentiel', typeLabel: 'Habitation', lat: DEFAULT_HOME_COORDINATES.lat, lng: DEFAULT_HOME_COORDINATES.lng };
}

function playerIcon(): L.DivIcon {
  return L.divIcon({ className: 'absence-player-marker', html: '<span aria-label="Votre position"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
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
  host.className = 'leaflet-map';
  host.dataset.testid = 'leaflet-map';
  let state = normalizeMapUiState(initialState);
  let playerPosition = initialPlayerPosition ? { ...initialPlayerPosition } : null;
  let map: L.Map | null = null;
  let fog: FogCanvasLayer | null = null;
  let poiLayer: L.LayerGroup | null = null;
  let playerMarker: L.Marker | null = null;
  let hideTimer: number | null = null;
  let poiTimer: number | null = null;
  let poiAbort: AbortController | null = null;
  let poiRequestSequence = 0;
  let lastPois: MapPoi[] = [];
  const poiCache = new Map<string, MapPoi[]>();

  const startInteraction = (): void => {
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    document.body.classList.add('map-moving');
  };
  const endInteraction = (): void => {
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => document.body.classList.remove('map-moving'), 250);
  };
  const saveViewport = (): void => {
    if (!map) return;
    const center = map.getCenter();
    state = updateMapViewport(state, center.lat, center.lng, map.getZoom());
    persist(structuredClone(state));
  };

  const renderPlayer = (): void => {
    if (!map) return;
    if (!playerPosition) {
      playerMarker?.remove();
      playerMarker = null;
      return;
    }
    if (!playerMarker) {
      playerMarker = L.marker([playerPosition.lat, playerPosition.lng], { icon: playerIcon(), pane: 'playerPane', keyboard: false, interactive: false, zIndexOffset: 2000 }).addTo(map);
    } else playerMarker.setLatLng([playerPosition.lat, playerPosition.lng]);
  };

  const renderPois = (pois: readonly MapPoi[]): void => {
    if (!map || !poiLayer) return;
    lastPois = [...pois].map((poi) => ({ ...poi }));
    poiLayer.clearLayers();
    const home = homePoi();
    const candidates = [
      home,
      ...pois.filter((poi) => poi.id !== 'home' && !(poi.category === 'Résidentiel' && mapDistanceMeters(poi, home) < 35)),
    ];
    for (const poi of candidates) {
      if (!isMapPointExplored(state, poi)) continue;
      L.marker([poi.lat, poi.lng], { icon: poiIcon(poi), pane: 'poiPane', keyboard: true, title: poi.name, bubblingMouseEvents: false })
        .bindPopup(poiPopup(poi, onTravel))
        .addTo(poiLayer);
    }
  };

  const rememberPois = (key: string, pois: MapPoi[]): void => {
    if (poiCache.has(key)) poiCache.delete(key);
    poiCache.set(key, structuredClone(pois));
    while (poiCache.size > 4) {
      const oldest = poiCache.keys().next().value as string | undefined;
      if (!oldest) break;
      poiCache.delete(oldest);
    }
  };

  const clearPoiRequest = (): void => {
    if (poiTimer !== null) window.clearTimeout(poiTimer);
    poiTimer = null;
    poiAbort?.abort();
    poiAbort = null;
  };

  const loadPois = async (): Promise<void> => {
    poiTimer = null;
    if (!map || !host.isConnected || map.getZoom() < MAP_POI_MIN_ZOOM) {
      poiLayer?.clearLayers();
      return;
    }
    const center = map.getCenter();
    const centerPoint = { lat: center.lat, lng: center.lng };
    if (mapDistanceMeters(centerPoint, DEFAULT_HOME_COORDINATES) > MAP_POI_MAX_HOME_DISTANCE_M) {
      poiLayer?.clearLayers();
      return;
    }
    const key = mapPoiCacheKey(centerPoint);
    const cached = poiCache.get(key);
    if (cached) { renderPois(cached); return; }

    poiAbort?.abort();
    const controller = new AbortController();
    poiAbort = controller;
    const sequence = ++poiRequestSequence;
    const timeout = window.setTimeout(() => controller.abort(), 4500);
    try {
      const pois = await fetchOverpassPois(centerPoint, controller.signal);
      if (sequence !== poiRequestSequence) return;
      rememberPois(key, pois);
      if (map && host.isConnected && mapPoiCacheKey({ lat: map.getCenter().lat, lng: map.getCenter().lng }) === key) renderPois(pois);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn('ABSENCE map POIs unavailable.', error);
    } finally {
      window.clearTimeout(timeout);
      if (poiAbort === controller) poiAbort = null;
    }
  };

  const schedulePoiLoad = (delayMs = 700): void => {
    if (poiTimer !== null) window.clearTimeout(poiTimer);
    poiTimer = window.setTimeout(() => { void loadPois(); }, delayMs);
  };

  const ensureMap = (): void => {
    if (map) return;
    map = L.map(host, { zoomControl: false, preferCanvas: true, minZoom: 3, maxZoom: 20 }).setView([state.center.lat, state.center.lng], state.zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20, attribution: '&copy; OpenStreetMap contributors &copy; CARTO', updateWhenIdle: true, keepBuffer: 2,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    const fogPane = map.createPane('fogPane'); fogPane.style.zIndex = '430'; fogPane.style.pointerEvents = 'none';
    const poiPane = map.createPane('poiPane'); poiPane.style.zIndex = '650';
    const playerPane = map.createPane('playerPane'); playerPane.style.zIndex = '700'; playerPane.style.pointerEvents = 'none';
    fog = new FogCanvasLayer(state.explored, state.exploredCorridors).addTo(map);
    poiLayer = L.layerGroup().addTo(map);
    renderPois([]);
    renderPlayer();

    map.on('click', (event) => {
      const point = { lat: event.latlng.lat, lng: event.latlng.lng };
      L.popup({ closeButton: true, autoPan: true }).setLatLng(event.latlng).setContent(walkPopup(point, onWalk)).openOn(map!);
    });
    map.on('movestart zoomstart', startInteraction);
    map.on('moveend zoomend', endInteraction);
    map.on('moveend zoomend', saveViewport);
    map.on('moveend zoomend', () => schedulePoiLoad());
  };

  return {
    attach(slot): void {
      ensureMap();
      if (host.parentElement !== slot) slot.append(host);
      fog?.setExploration(state.explored, state.exploredCorridors);
      renderPois(lastPois);
      renderPlayer();
      window.requestAnimationFrame(() => { map?.invalidateSize({ animate: false }); schedulePoiLoad(); });
    },
    detach(): void { clearPoiRequest(); host.remove(); document.body.classList.remove('map-moving'); },
    sync(nextState, nextPlayerPosition): void {
      state = normalizeMapUiState(nextState);
      if (nextPlayerPosition !== undefined) playerPosition = nextPlayerPosition ? { ...nextPlayerPosition } : null;
      fog?.setExploration(state.explored, state.exploredCorridors);
      renderPois(lastPois);
      renderPlayer();
      if (map) map.setView([state.center.lat, state.center.lng], state.zoom, { animate: false });
      schedulePoiLoad();
    },
    getState(): MapUiState { return structuredClone(state); },
    destroy(): void {
      clearPoiRequest();
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      document.body.classList.remove('map-moving');
      map?.remove(); map = null; fog = null; poiLayer = null; playerMarker = null; host.remove();
    },
  };
}