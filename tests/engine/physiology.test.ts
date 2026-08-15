import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import { advanceTime } from '../../src/engine/time';

describe('physiology over time', () => {
  it('adds 1 hunger point every 25 minutes', () => { const state=createInitialState(); const before=state.player.needs.hunger; advanceTime(state,25*60); expect(state.player.needs.hunger).toBeCloseTo(before+1,5); });
  it('adds 1 thirst point every 15 minutes', () => { const state=createInitialState(); const before=state.player.needs.thirst; advanceTime(state,15*60); expect(state.player.needs.thirst).toBeCloseTo(before+1,5); });
  it('adds 1 fatigue point every 20 minutes', () => { const state=createInitialState(); const before=state.player.needs.fatigue; advanceTime(state,20*60); expect(state.player.needs.fatigue).toBeCloseTo(before+1,5); });
});
