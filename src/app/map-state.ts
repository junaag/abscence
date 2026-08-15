export const MAP_STATE_KEY = 'absence-v020-map-state';
export const DEFAULT_HOME_COORDINATES = Object.freeze({ lat: 43.4053, lng: 5.0548 });

export interface ExploredMapArea {
  lat: number;
  lng: number;
  radiusM: number;
}

export interface MapUiState {
  center: { lat: number; lng: number };
  zoom: number;
  explored: ExploredMapArea[];
}

export interface MapStateReadStorage { getItem(key: string): string | null; }
export interface MapStateWriteStorage { setItem(key: string, value: string): void; }

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeArea(value: unknown): ExploredMapArea | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ExploredMapArea>;
  const lat = finite(candidate.lat, Number.NaN);
  const lng = finite(candidate.lng, Number.NaN);
  const radiusM = finite(candidate.radiusM, Number.NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusM) || radiusM <= 0) return null;
  return { lat: clamp(lat, -85, 85), lng: clamp(lng, -180, 180), radiusM: clamp(radiusM, 2, 5000) };
}

export function createDefaultMapUiState(): MapUiState {
  return {
    center: { ...DEFAULT_HOME_COORDINATES },
    zoom: 17,
    explored: [{ ...DEFAULT_HOME_COORDINATES, radiusM: 85 }],
  };
}

export function normalizeMapUiState(value: unknown): MapUiState {
  const fallback = createDefaultMapUiState();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<MapUiState>;
  const centerCandidate = candidate.center && typeof candidate.center === 'object' ? candidate.center : fallback.center;
  const lat = clamp(finite(centerCandidate.lat, fallback.center.lat), -85, 85);
  const lng = clamp(finite(centerCandidate.lng, fallback.center.lng), -180, 180);
  const zoom = clamp(Math.round(finite(candidate.zoom, fallback.zoom)), 3, 20);
  const explored = Array.isArray(candidate.explored) ? candidate.explored.map(normalizeArea).filter((area): area is ExploredMapArea => area !== null).slice(-500) : fallback.explored;
  return { center: { lat, lng }, zoom, explored: explored.length > 0 ? explored : fallback.explored };
}

export function loadMapUiState(storage: MapStateReadStorage): MapUiState {
  try {
    const raw = storage.getItem(MAP_STATE_KEY);
    return raw ? normalizeMapUiState(JSON.parse(raw) as unknown) : createDefaultMapUiState();
  } catch {
    return createDefaultMapUiState();
  }
}

export function saveMapUiState(state: MapUiState, storage: MapStateWriteStorage): void {
  storage.setItem(MAP_STATE_KEY, JSON.stringify(normalizeMapUiState(state)));
}

export function updateMapViewport(state: MapUiState, lat: number, lng: number, zoom: number): MapUiState {
  const next = normalizeMapUiState(state);
  next.center = { lat: clamp(finite(lat, next.center.lat), -85, 85), lng: clamp(finite(lng, next.center.lng), -180, 180) };
  next.zoom = clamp(Math.round(finite(zoom, next.zoom)), 3, 20);
  return next;
}

export function addExploredMapArea(state: MapUiState, area: ExploredMapArea): MapUiState {
  const next = normalizeMapUiState(state);
  const normalized = normalizeArea(area);
  if (!normalized) return next;
  const duplicate = next.explored.some((entry) => Math.abs(entry.lat - normalized.lat) < 0.000001 && Math.abs(entry.lng - normalized.lng) < 0.000001 && Math.abs(entry.radiusM - normalized.radiusM) < 0.1);
  if (!duplicate) next.explored = [...next.explored, normalized].slice(-500);
  return next;
}
