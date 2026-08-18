import { ZONE_ALPHA_BOUNDS, ZONE_ALPHA_HOME_POSITION } from '../content/zone-alpha-core';

export const MAP_STATE_KEY = 'absence-v030-map-state-zone-alpha-r1';
export const DEFAULT_HOME_COORDINATES = Object.freeze({ ...ZONE_ALPHA_HOME_POSITION });

export interface MapCoordinate {
  x: number;
  y: number;
}

export interface ExploredMapArea extends MapCoordinate {
  radiusM: number;
}

export interface ExploredMapCorridor {
  points: MapCoordinate[];
  radiusM: number;
}

export interface MapUiState {
  center: MapCoordinate;
  zoom: number;
  explored: ExploredMapArea[];
  exploredCorridors: ExploredMapCorridor[];
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

function normalizeCoordinate(value: unknown): MapCoordinate | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MapCoordinate>;
  const x = finite(candidate.x, Number.NaN);
  const y = finite(candidate.y, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x, -100, ZONE_ALPHA_BOUNDS.widthM + 100),
    y: clamp(y, -100, ZONE_ALPHA_BOUNDS.heightM + 100),
  };
}

function normalizeArea(value: unknown): ExploredMapArea | null {
  const coordinate = normalizeCoordinate(value);
  if (!coordinate || !value || typeof value !== 'object') return null;
  const radiusM = finite((value as Partial<ExploredMapArea>).radiusM, Number.NaN);
  if (!Number.isFinite(radiusM) || radiusM <= 0) return null;
  return { ...coordinate, radiusM: clamp(radiusM, 2, 500) };
}

function normalizeCorridor(value: unknown): ExploredMapCorridor | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ExploredMapCorridor>;
  const radiusM = finite(candidate.radiusM, Number.NaN);
  if (!Number.isFinite(radiusM) || radiusM <= 0 || !Array.isArray(candidate.points)) return null;
  const points = candidate.points
    .map(normalizeCoordinate)
    .filter((point): point is MapCoordinate => point !== null)
    .filter((point, index, all) => index === 0 || Math.abs(point.x - all[index - 1]!.x) >= 0.01 || Math.abs(point.y - all[index - 1]!.y) >= 0.01)
    .slice(0, 64);
  if (points.length < 2) return null;
  return { points, radiusM: clamp(radiusM, 2, 100) };
}

export function createDefaultMapUiState(): MapUiState {
  return {
    center: { ...DEFAULT_HOME_COORDINATES },
    zoom: 1.35,
    explored: [{ ...DEFAULT_HOME_COORDINATES, radiusM: 18 }],
    exploredCorridors: [],
  };
}

export function normalizeMapUiState(value: unknown): MapUiState {
  const fallback = createDefaultMapUiState();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<MapUiState>;
  const centerCandidate = normalizeCoordinate(candidate.center) ?? fallback.center;
  const zoom = clamp(finite(candidate.zoom, fallback.zoom), 0.8, 2.8);
  const explored = Array.isArray(candidate.explored)
    ? candidate.explored.map(normalizeArea).filter((area): area is ExploredMapArea => area !== null).slice(-500)
    : fallback.explored;
  const exploredCorridors = Array.isArray(candidate.exploredCorridors)
    ? candidate.exploredCorridors.map(normalizeCorridor).filter((corridor): corridor is ExploredMapCorridor => corridor !== null).slice(-250)
    : [];
  return {
    center: centerCandidate,
    zoom,
    explored: explored.length > 0 ? explored : fallback.explored,
    exploredCorridors,
  };
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

export function updateMapViewport(state: MapUiState, x: number, y: number, zoom: number): MapUiState {
  const next = normalizeMapUiState(state);
  next.center = normalizeCoordinate({ x, y }) ?? next.center;
  next.zoom = clamp(finite(zoom, next.zoom), 0.8, 2.8);
  return next;
}

export function addExploredMapArea(state: MapUiState, area: ExploredMapArea): MapUiState {
  const next = normalizeMapUiState(state);
  const normalized = normalizeArea(area);
  if (!normalized) return next;
  const duplicate = next.explored.some((entry) => Math.abs(entry.x - normalized.x) < 0.01 && Math.abs(entry.y - normalized.y) < 0.01 && Math.abs(entry.radiusM - normalized.radiusM) < 0.1);
  if (!duplicate) next.explored = [...next.explored, normalized].slice(-500);
  return next;
}

export function addExploredMapCorridor(state: MapUiState, corridor: ExploredMapCorridor): MapUiState {
  const next = normalizeMapUiState(state);
  const normalized = normalizeCorridor(corridor);
  if (!normalized) return next;
  const signature = JSON.stringify(normalized);
  const duplicate = next.exploredCorridors.some((entry) => JSON.stringify(entry) === signature);
  if (!duplicate) next.exploredCorridors = [...next.exploredCorridors, normalized].slice(-250);
  return next;
}
