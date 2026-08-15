import type { GameState, PersistentEffect, PersistentEffectType, WorldEventRecord } from './model';
import { clampNeeds } from './state';

export interface EffectAdvanceResult {
  createdEffectIds: string[];
  resolvedEffectIds: string[];
  effectDamageBudgetAddedPv: number;
  startedEventIds: string[];
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function adjacentLocations(state: GameState, locationId: string): string[] {
  const result = new Set<string>();
  for (const connection of Object.values(state.connections)) {
    if (!connection.open) continue;
    if (connection.a === locationId) result.add(connection.b);
    else if (connection.b === locationId) result.add(connection.a);
  }
  return [...result];
}

export function activeEffectsAt(state: GameState, locationId: string): PersistentEffect[] {
  return state.world.effects.filter((effect) => effect.active && effect.locationId === locationId);
}

export function findActiveEffect(state: GameState, type: PersistentEffectType, locationId: string): PersistentEffect | undefined {
  return state.world.effects.find((effect) => effect.active && effect.type === type && effect.locationId === locationId);
}

export function addPersistentEffect(
  state: GameState,
  type: PersistentEffectType,
  locationId: string,
  intensity = 20,
  options: { source?: string; spreading?: boolean; atSeconds?: number } = {},
): PersistentEffect {
  const existing = findActiveEffect(state, type, locationId);
  if (existing) {
    existing.intensity = clamp(Math.max(existing.intensity, intensity));
    if (options.source !== undefined) existing.source = options.source;
    if (options.spreading !== undefined) existing.spreading = options.spreading;
    if (options.atSeconds !== undefined) existing.updatedAtSeconds = options.atSeconds;
    return existing;
  }

  const atSeconds = options.atSeconds ?? state.engine.elapsedSeconds;
  const effect: PersistentEffect = {
    id: `fx_${state.engine.nextEffectId++}`,
    type,
    locationId,
    intensity: clamp(intensity),
    active: true,
    spreading: options.spreading ?? true,
    createdAtSeconds: atSeconds,
    updatedAtSeconds: atSeconds,
  };
  if (options.source !== undefined) effect.source = options.source;
  state.world.effects.push(effect);
  return effect;
}

function resolveEffect(effect: PersistentEffect, atSeconds: number, reason = 'natural_decay'): void {
  effect.active = false;
  effect.intensity = 0;
  effect.updatedAtSeconds = atSeconds;
  effect.resolvedAtSeconds = atSeconds;
  effect.resolutionReason = reason;
}

function evolveEffect(state: GameState, effect: PersistentEffect, minutes: number, atSeconds: number, created: string[]): void {
  const location = state.locations[effect.locationId];
  const windowOpen = Boolean(state.world.windowsOpen[effect.locationId]);

  if (effect.type === 'water_puddle') {
    if (effect.source === 'leak' && state.world.leakActive) effect.intensity = clamp(effect.intensity + 4.5 * minutes);
    else effect.intensity = clamp(effect.intensity - 0.35 * minutes);

    if (effect.intensity >= 55 && effect.spreading) {
      for (const destination of adjacentLocations(state, effect.locationId)) {
        if (destination === 'garden' || findActiveEffect(state, 'water_puddle', destination)) continue;
        const spread = addPersistentEffect(state, 'water_puddle', destination, Math.min(22, effect.intensity * 0.25), { source: 'spread', atSeconds });
        created.push(spread.id);
      }
    }
  } else if (effect.type === 'smoke') {
    const ventilation = (location?.ventilation ?? 0) + (windowOpen ? 1.2 : 0);
    effect.intensity = clamp(effect.intensity - (0.8 + ventilation * 1.7) * minutes);

    if (effect.intensity >= 18 && effect.spreading) {
      for (const destination of adjacentLocations(state, effect.locationId)) {
        const transfer = Math.max(0, effect.intensity * 0.08 * minutes);
        if (transfer < 1) continue;
        const destinationEffect = findActiveEffect(state, 'smoke', destination);
        if (destinationEffect) destinationEffect.intensity = clamp(destinationEffect.intensity + transfer);
        else {
          const spread = addPersistentEffect(state, 'smoke', destination, Math.min(18, transfer), { source: 'spread', atSeconds });
          created.push(spread.id);
        }
      }
    }
  } else if (effect.type === 'fire') {
    effect.intensity = clamp(effect.intensity + 1.8 * minutes);
    const smoke = findActiveEffect(state, 'smoke', effect.locationId) ?? addPersistentEffect(state, 'smoke', effect.locationId, 8, { source: 'fire', atSeconds });
    if (smoke.createdAtSeconds === atSeconds && !created.includes(smoke.id)) created.push(smoke.id);
    smoke.intensity = clamp(smoke.intensity + 2.6 * minutes);

    if (effect.intensity >= 75 && effect.spreading) {
      for (const destination of adjacentLocations(state, effect.locationId)) {
        if (findActiveEffect(state, 'fire', destination)) continue;
        const spread = addPersistentEffect(state, 'fire', destination, 12, { source: 'spread', atSeconds });
        created.push(spread.id);
      }
    }
  } else if (effect.type === 'persistent_noise') {
    effect.intensity = clamp(effect.intensity - 0.12 * minutes);
  }

  effect.updatedAtSeconds = atSeconds;
}

function applyLocalEffects(state: GameState, minutes: number): number {
  const local = activeEffectsAt(state, state.player.locationId);
  const smoke = local.find((effect) => effect.type === 'smoke');
  const fire = local.find((effect) => effect.type === 'fire');
  const noise = local.find((effect) => effect.type === 'persistent_noise');
  const water = local.find((effect) => effect.type === 'water_puddle');

  if (smoke && smoke.intensity > 25) {
    state.player.needs.stress += 0.06 * smoke.intensity * minutes;
    state.player.needs.pain += 0.015 * smoke.intensity * minutes;
  }
  if (fire) state.player.needs.stress += 0.1 * fire.intensity * minutes;
  if (noise && noise.intensity > 35) state.player.needs.stress += 0.025 * noise.intensity * minutes;
  if (water && water.intensity > 70) state.player.needs.stress += 0.15 * minutes;

  let damageBudget = 0;
  if (smoke && smoke.intensity > 65) damageBudget += ((smoke.intensity - 65) / 35) * 0.22 * minutes;
  if (fire && fire.intensity > 35) damageBudget += ((fire.intensity - 35) / 65) * 0.8 * minutes;
  clampNeeds(state);
  return damageBudget;
}

function recordWorldEvent(state: GameState, type: WorldEventRecord['type'], locationId: string, atSeconds: number): void {
  state.world.eventHistory.push({
    id: `world_${state.world.eventHistory.length + 1}`,
    type,
    locationId,
    atSeconds,
  });
}

function processScheduledEventsAt(state: GameState, atSeconds: number): string[] {
  const started: string[] = [];
  for (const event of state.world.scheduledEvents) {
    if (event.processed || event.atSeconds > atSeconds) continue;
    event.processed = true;
    if (event.type === 'noise_source') {
      addPersistentEffect(state, 'persistent_noise', event.locationId, 58, { source: 'unattended_device', atSeconds: event.atSeconds });
      recordWorldEvent(state, 'WORLD_PERSISTENT_NOISE', event.locationId, event.atSeconds);
    } else if (event.type === 'water_leak') {
      state.world.leakActive = true;
      addPersistentEffect(state, 'water_puddle', event.locationId, 18, { source: 'leak', atSeconds: event.atSeconds });
      recordWorldEvent(state, 'WORLD_WATER_LEAK', event.locationId, event.atSeconds);
    } else if (event.type === 'smoke') {
      addPersistentEffect(state, 'smoke', event.locationId, 46, { source: 'distant_fire', atSeconds: event.atSeconds });
      recordWorldEvent(state, 'WORLD_SMOKE', event.locationId, event.atSeconds);
    }
    started.push(event.id);
  }
  return started;
}

function nextScheduledEventSecond(state: GameState, current: number, target: number): number | undefined {
  let next: number | undefined;
  for (const event of state.world.scheduledEvents) {
    if (event.processed || event.atSeconds <= current || event.atSeconds > target) continue;
    if (next === undefined || event.atSeconds < next) next = event.atSeconds;
  }
  return next;
}

export function advanceWorldEffects(state: GameState, seconds: number): EffectAdvanceResult {
  const elapsed = Math.max(0, Number(seconds) || 0);
  const target = state.engine.elapsedSeconds + elapsed;
  let current = state.engine.elapsedSeconds;
  let damageBudgetAdded = 0;
  const createdEffectIds: string[] = [];
  const resolvedEffectIds: string[] = [];
  const startedEventIds = processScheduledEventsAt(state, current);

  while (current < target) {
    const nextEvent = nextScheduledEventSecond(state, current, target);
    const boundary = nextEvent ?? target;

    while (current < boundary) {
      const stepSeconds = Math.min(60, boundary - current);
      const minutes = stepSeconds / 60;
      current += stepSeconds;
      const activeAtStart = state.world.effects.filter((effect) => effect.active);

      for (const effect of activeAtStart) evolveEffect(state, effect, minutes, current, createdEffectIds);
      damageBudgetAdded += applyLocalEffects(state, minutes);

      for (const effect of state.world.effects) {
        if (effect.active && effect.intensity <= 0.1) {
          resolveEffect(effect, current);
          resolvedEffectIds.push(effect.id);
        }
      }
    }

    startedEventIds.push(...processScheduledEventsAt(state, current));
  }

  state.engine.damageBudgetPv = round(state.engine.damageBudgetPv + damageBudgetAdded, 6);
  return {
    createdEffectIds: [...new Set(createdEffectIds)],
    resolvedEffectIds,
    effectDamageBudgetAddedPv: round(damageBudgetAdded, 6),
    startedEventIds: [...new Set(startedEventIds)],
  };
}
