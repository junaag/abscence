import { advanceWorldEffects, type EffectAdvanceResult } from './effects';
import { applyDueInfrastructureTransitions, secondsUntilNextInfrastructureTransition } from './infrastructure';
import type { GameState, NeedsState, ProceduralWorldEventTransition } from './model';
import { advancePerishables, type PerishableChange } from './perishables';
import { getPerceivedWorldEvents, type WorldEventPerception } from './perception';
import { advancePhysiology, BASE_RATES_PER_MINUTE, type PhysiologyAdvanceResult } from './physiology';
import { advanceItemResources, type ItemResourceChange } from './resources';
import { applyDueWorldEventTransitions, secondsUntilNextWorldEventBoundary } from './world-events';

export { BASE_RATES_PER_MINUTE } from './physiology';
export type { PhysiologyAdvanceResult } from './physiology';

const DAY_SECONDS = 24 * 60 * 60;

export interface TimeAdvanceResult extends PhysiologyAdvanceResult {
  itemResourceChanges: ItemResourceChange[];
  perishableChanges: PerishableChange[];
  effects: EffectAdvanceResult;
  worldEventTransitions: ProceduralWorldEventTransition[];
  perceivedWorldEvents: WorldEventPerception[];
}

function emptyNeeds(): NeedsState {
  return { hunger: 0, thirst: 0, fatigue: 0, stress: 0, pain: 0 };
}

function addNeeds(target: NeedsState, source: NeedsState): void {
  target.hunger += source.hunger;
  target.thirst += source.thirst;
  target.fatigue += source.fatigue;
  target.stress += source.stress;
  target.pain += source.pain;
}

function advanceClock(state: GameState, seconds: number): void {
  state.engine.elapsedSeconds += seconds;
  state.clock.secondOfDay += seconds;
  while (state.clock.secondOfDay >= DAY_SECONDS) {
    state.clock.secondOfDay -= DAY_SECONDS;
    state.clock.day += 1;
  }
}

function advanceTimeSegment(state: GameState, seconds: number): Omit<TimeAdvanceResult, 'worldEventTransitions' | 'perceivedWorldEvents'> {
  const elapsedSeconds = Math.max(0, Number(seconds) || 0);
  const effects = advanceWorldEffects(state, elapsedSeconds);
  const physiology = advancePhysiology(state, elapsedSeconds);
  const itemResourceChanges = advanceItemResources(state, elapsedSeconds);
  const perishableChanges = advancePerishables(state, elapsedSeconds);
  advanceClock(state, elapsedSeconds);
  return { ...physiology, itemResourceChanges, perishableChanges, effects };
}

export function advanceTime(state: GameState, seconds: number): TimeAdvanceResult {
  const elapsedSeconds = Math.max(0, Number(seconds) || 0);
  applyDueInfrastructureTransitions(state);
  const initialWorldTransitions = applyDueWorldEventTransitions(state);

  if (elapsedSeconds === 0) {
    const segment = advanceTimeSegment(state, 0);
    return {
      ...segment,
      worldEventTransitions: initialWorldTransitions,
      perceivedWorldEvents: getPerceivedWorldEvents(state, null, { markDiscovered: true }),
    };
  }

  const baseline = advancePhysiology(state, 0);
  const naturalChanges = emptyNeeds();
  const itemResourceChanges: ItemResourceChange[] = [];
  const perishableChanges: PerishableChange[] = [];
  const createdEffectIds = new Set<string>();
  const resolvedEffectIds = new Set<string>();
  const startedEventIds = new Set<string>();
  const worldEventTransitions: ProceduralWorldEventTransition[] = [...initialWorldTransitions];
  let effectDamageBudgetAddedPv = 0;
  let healthLostPv = 0;
  let remaining = elapsedSeconds;
  let lastPhysiology = baseline;
  let guard = 0;

  while (remaining > 0 && guard < 2000) {
    guard += 1;
    const untilInfrastructure = secondsUntilNextInfrastructureTransition(state, remaining);
    const untilWorldEvent = secondsUntilNextWorldEventBoundary(state, remaining);
    const segmentSeconds = Math.min(remaining, untilInfrastructure, untilWorldEvent);

    if (segmentSeconds <= 0) {
      const infrastructureApplied = applyDueInfrastructureTransitions(state);
      const worldApplied = applyDueWorldEventTransitions(state);
      worldEventTransitions.push(...worldApplied);
      if (infrastructureApplied.length === 0 && worldApplied.length === 0) break;
      continue;
    }

    const segment = advanceTimeSegment(state, segmentSeconds);
    lastPhysiology = segment;
    healthLostPv += segment.healthLostPv;
    addNeeds(naturalChanges, segment.naturalChanges);
    itemResourceChanges.push(...segment.itemResourceChanges);
    perishableChanges.push(...segment.perishableChanges);
    for (const id of segment.effects.createdEffectIds) createdEffectIds.add(id);
    for (const id of segment.effects.resolvedEffectIds) resolvedEffectIds.add(id);
    for (const id of segment.effects.startedEventIds) startedEventIds.add(id);
    effectDamageBudgetAddedPv += segment.effects.effectDamageBudgetAddedPv;

    remaining -= segmentSeconds;
    // Historical order: infrastructure is resolved before autonomous world events
    // when both transitions share the exact same timestamp.
    applyDueInfrastructureTransitions(state);
    worldEventTransitions.push(...applyDueWorldEventTransitions(state));
  }

  return {
    elapsedSeconds: elapsedSeconds - remaining,
    healthLostPv,
    naturalChanges,
    effectiveRatesPerMinute: lastPhysiology.effectiveRatesPerMinute,
    environment: lastPhysiology.environment,
    itemResourceChanges,
    perishableChanges,
    effects: {
      createdEffectIds: [...createdEffectIds],
      resolvedEffectIds: [...resolvedEffectIds],
      effectDamageBudgetAddedPv,
      startedEventIds: [...startedEventIds],
    },
    worldEventTransitions,
    perceivedWorldEvents: getPerceivedWorldEvents(state, null, { markDiscovered: true }),
  };
}

export function formatClock(state: GameState): string {
  const totalMinutes = Math.floor(state.clock.secondOfDay / 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

void BASE_RATES_PER_MINUTE;
