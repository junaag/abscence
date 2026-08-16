import { describe, expect, it } from 'vitest';
import { loadState, SAVE_KEY } from '../../src/engine/persistence';
import { createInitialState } from '../../src/engine/state';
import { advanceTime } from '../../src/engine/time';
import {
  addWorldEventSource,
  createWorldEventSource,
  deterministicWorldEventUnit,
  setWorldEventSeed,
  WORLD_EVENT_SEED,
} from '../../src/engine/world-events';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function proceduralHistory(state: ReturnType<typeof createInitialState>) {
  return state.world.eventHistory.filter((entry) => !('id' in entry));
}

describe('autonomous world-event scheduler', () => {
  it('starts with historical seed 1801 but no implicit content sources', () => {
    const state = createInitialState();
    expect(state.engine.worldEventSeed).toBe(WORLD_EVENT_SEED);
    expect(state.engine.worldEventSimulationEnabled).toBe(true);
    expect(state.world.eventSources).toEqual({});
    expect(state.world.events).toEqual([]);
  });

  it('uses the exact deterministic FNV/xorshift stream for schedule and probability keys', () => {
    expect(deterministicWorldEventUnit(1801, 'world-event:test:time:0')).toBe(
      deterministicWorldEventUnit(1801, 'world-event:test:time:0'),
    );
    expect(deterministicWorldEventUnit(1801, 'world-event:test:time:0')).not.toBe(
      deterministicWorldEventUnit(1801, 'world-event:test:roll:0'),
    );
  });

  it('runs planned -> active -> resolved at exact time boundaries', () => {
    const state = createInitialState();
    addWorldEventSource(state, createWorldEventSource('noise_exact', 'unattended_noise', {
      position: { x: 90, y: 0 },
      probability: 1,
      minDelaySeconds: 60,
      maxDelaySeconds: 60,
      durationSeconds: 120,
    }));

    const result = advanceTime(state, 180);
    expect(result.worldEventTransitions.map((entry) => [entry.type, entry.worldElapsedSeconds])).toEqual([
      ['started', 60],
      ['resolved', 180],
    ]);
    expect(state.world.events?.[0]?.status).toBe('resolved');
  });

  it('evaluates infrastructure first when a power loss and alarm share a boundary', () => {
    const state = createInitialState();
    state.infrastructure.transitions = [{
      id: 'manual_power_loss',
      network: 'electricity',
      atSeconds: 60,
      processed: false,
      available: false,
      voltagePercent: 0,
    }];
    addWorldEventSource(state, createWorldEventSource('alarm_same_boundary', 'security_alarm', {
      locationId: 'bedroom',
      probability: 1,
      minDelaySeconds: 60,
      maxDelaySeconds: 60,
    }));

    const result = advanceTime(state, 60);
    expect(state.infrastructure.electricity.available).toBe(false);
    expect(result.worldEventTransitions).toHaveLength(1);
    expect(result.worldEventTransitions[0]).toMatchObject({ type: 'skipped', reason: 'CONDITIONS', worldElapsedSeconds: 60 });
    expect(state.world.events).toHaveLength(0);
  });

  it('is independent of advanceTime chunk size', () => {
    function makeState() {
      const state = createInitialState();
      state.infrastructure.transitions = [];
      state.engine.infrastructureSimulationEnabled = false;
      setWorldEventSeed(state, 424242, true);
      addWorldEventSource(state, createWorldEventSource('smoke_source', 'smoke_plume', {
        position: { x: 500, y: 0 },
        probability: 1,
        minDelaySeconds: 3600,
        maxDelaySeconds: 3600,
        durationSeconds: 7200,
      }));
      return state;
    }

    const whole = makeState();
    const chunked = makeState();
    advanceTime(whole, 5 * 3600);
    for (let index = 0; index < 5 * 60; index += 1) advanceTime(chunked, 60);

    expect(proceduralHistory(whole)).toEqual(proceduralHistory(chunked));
    expect(whole.world.events).toEqual(chunked.world.events);
  });

  it('reschedules sources reproducibly when the seed changes', () => {
    const state = createInitialState();
    const source = addWorldEventSource(state, createWorldEventSource('seeded_noise', 'unattended_noise', {
      probability: 1,
      minDelaySeconds: 10,
      maxDelaySeconds: 1000,
    }));
    const before = source.nextTriggerAtSeconds;
    setWorldEventSeed(state, 99991, true);
    const after = state.world.eventSources?.seeded_noise?.nextTriggerAtSeconds;

    expect(state.engine.worldEventSeed).toBe(99991);
    expect(after).not.toBe(before);
    const mirror = createInitialState();
    addWorldEventSource(mirror, createWorldEventSource('seeded_noise', 'unattended_noise', {
      probability: 1,
      minDelaySeconds: 10,
      maxDelaySeconds: 1000,
    }));
    setWorldEventSeed(mirror, 99991, true);
    expect(mirror.world.eventSources?.seeded_noise?.nextTriggerAtSeconds).toBe(after);
  });

  it('records probability failures without creating a visible world event', () => {
    const state = createInitialState();
    addWorldEventSource(state, createWorldEventSource('never_happens', 'animal_noise', {
      position: { x: 20, y: 0 },
      probability: 0,
      minDelaySeconds: 30,
      maxDelaySeconds: 30,
    }));
    const result = advanceTime(state, 30);
    expect(result.worldEventTransitions[0]).toMatchObject({ type: 'skipped', reason: 'PROBABILITY' });
    expect(state.world.events).toHaveLength(0);
    expect(result.perceivedWorldEvents).toHaveLength(0);
  });

  it('migrates older v0.2-dev saves without scheduler fields', () => {
    const storage = new MemoryStorage();
    const legacy = createInitialState() as ReturnType<typeof createInitialState> & {
      engine: ReturnType<typeof createInitialState>['engine'] & { worldEventSeed?: number; worldEventSimulationEnabled?: boolean };
      world: ReturnType<typeof createInitialState>['world'] & { eventSources?: unknown; events?: unknown };
    };
    delete legacy.engine.worldEventSeed;
    delete legacy.engine.worldEventSimulationEnabled;
    delete legacy.world.eventSources;
    delete legacy.world.events;
    storage.setItem(SAVE_KEY, JSON.stringify(legacy));

    const loaded = loadState(storage);
    expect(loaded.engine.worldEventSeed).toBe(1801);
    expect(loaded.engine.worldEventSimulationEnabled).toBe(true);
    expect(loaded.world.eventSources).toEqual({});
    expect(loaded.world.events).toEqual([]);
  });
});
