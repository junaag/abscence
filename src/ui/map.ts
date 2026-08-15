import * as L from 'leaflet';
import { DEFAULT_HOME_COORDINATES, normalizeMapUiState, updateMapViewport, type ExploredMapArea, type MapUiState } from '../app/map-state';

class FogCanvasLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private mapRef: L.Map | null = null;
  private areas: ExploredMapArea[];
  private readonly drawBound = (): void => this.draw();

  constructor(areas: ExploredMapArea[]) {
    super();
    this.areas = structuredClone(areas);
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

  setAreas(areas: ExploredMapArea[]): void {
    this.areas = structuredClone(areas);
    this.draw();
  }

  private radiusPixels(area: ExploredMapArea, map: L.Map): number {
    const earthRadiusM = 6378137;
    const latitudeOffset = area.radiusM / earthRadiusM * 180 / Math.PI;
    const center = map.latLngToContainerPoint([area.lat, area.lng]);
    const edge = map.latLngToContainerPoint([area.lat + latitudeOffset, area.lng]);
    return Math.max(1, Math.abs(edge.y - center.y));
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
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.x, size.y);
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgba(67,74,80,.97)';
    context.fillRect(0, 0, size.x, size.y);

    context.strokeStyle = 'rgba(255,255,255,.075)';
    context.lineWidth = 1;
    context.beginPath();
    const spacing = 17;
    for (let offset = -size.y; offset < size.x + size.y; offset += spacing) {
      context.moveTo(offset, 0);
      context.lineTo(offset - size.y, size.y);
    }
    context.stroke();

    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000';
    for (const area of this.areas) {
      const center = map.latLngToContainerPoint([area.lat, area.lng]);
      const radius = this.radiusPixels(area, map);
      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalCompositeOperation = 'source-over';
  }
}

export interface MapController {
  attach(slot: HTMLElement): void;
  detach(): void;
  sync(state: MapUiState): void;
  getState(): MapUiState;
  destroy(): void;
}

export function createMapController(initialState: MapUiState, persist: (state: MapUiState) => void): MapController {
  const host = document.createElement('div');
  host.className = 'leaflet-map';
  host.dataset.testid = 'leaflet-map';
  let state = normalizeMapUiState(initialState);
  let map: L.Map | null = null;
  let fog: FogCanvasLayer | null = null;
  let hideTimer: number | null = null;

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

  const ensureMap = (): void => {
    if (map) return;
    map = L.map(host, { zoomControl: false, preferCanvas: true, minZoom: 3, maxZoom: 20 }).setView([state.center.lat, state.center.lng], state.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors',
      updateWhenIdle: true,
      keepBuffer: 2,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    const fogPane = map.createPane('fogPane');
    fogPane.style.zIndex = '430';
    fogPane.style.pointerEvents = 'none';
    fog = new FogCanvasLayer(state.explored).addTo(map);

    const homeIcon = L.divIcon({ className: 'absence-home-marker', html: '<span aria-label="Maison">🏠</span>', iconSize: [36, 36], iconAnchor: [18, 18] });
    L.marker([DEFAULT_HOME_COORDINATES.lat, DEFAULT_HOME_COORDINATES.lng], { icon: homeIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup('<div class="map-popup"><strong>Maison</strong><button type="button" data-map-return-home>Revenir à la maison</button></div>');

    map.on('movestart zoomstart', startInteraction);
    map.on('moveend zoomend', endInteraction);
    map.on('moveend zoomend', saveViewport);
  };

  return {
    attach(slot): void {
      ensureMap();
      if (host.parentElement !== slot) slot.append(host);
      fog?.setAreas(state.explored);
      window.requestAnimationFrame(() => map?.invalidateSize({ animate: false }));
    },
    detach(): void {
      host.remove();
      document.body.classList.remove('map-moving');
    },
    sync(nextState): void {
      state = normalizeMapUiState(nextState);
      fog?.setAreas(state.explored);
      if (map) map.setView([state.center.lat, state.center.lng], state.zoom, { animate: false });
    },
    getState(): MapUiState {
      return structuredClone(state);
    },
    destroy(): void {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      document.body.classList.remove('map-moving');
      map?.remove();
      map = null;
      fog = null;
      host.remove();
    },
  };
}
