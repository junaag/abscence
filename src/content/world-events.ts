import type { SensoryProfile, WorldEventDefinitionId } from '../engine/model';

export type WorldEventCondition =
  | { type: 'infrastructure_available'; systemType: 'water'; zoneId: 'home' }
  | { type: 'infrastructure_available'; systemType: 'electricity'; zoneId: 'home'; minimumLevelPct: number };

export interface WorldEventDefinition {
  id: WorldEventDefinitionId;
  category: 'hazard' | 'signal' | 'life' | 'ambient';
  defaultDurationSeconds: number;
  defaultMinDelaySeconds: number;
  defaultMaxDelaySeconds: number;
  defaultProbability: number;
  sensory: Readonly<SensoryProfile>;
  conditions: readonly WorldEventCondition[];
  narrativeEvent: string;
  tags: readonly string[];
}

export const WORLD_EVENT_DEFINITIONS: Readonly<Record<WorldEventDefinitionId, WorldEventDefinition>> = Object.freeze({
  water_leak: Object.freeze({
    id: 'water_leak',
    category: 'hazard',
    defaultDurationSeconds: 4 * 3600,
    defaultMinDelaySeconds: 12 * 3600,
    defaultMaxDelaySeconds: 72 * 3600,
    defaultProbability: 0.45,
    sensory: Object.freeze({ audibleRangeM: 35, visibleRangeM: 12, smellRangeM: 0 }),
    conditions: Object.freeze([{ type: 'infrastructure_available', systemType: 'water', zoneId: 'home' }]),
    narrativeEvent: 'WORLD_WATER_LEAK',
    tags: Object.freeze(['water', 'leak', 'hazard']),
  }),
  security_alarm: Object.freeze({
    id: 'security_alarm',
    category: 'signal',
    defaultDurationSeconds: 45 * 60,
    defaultMinDelaySeconds: 1 * 3600,
    defaultMaxDelaySeconds: 24 * 3600,
    defaultProbability: 0.4,
    sensory: Object.freeze({ audibleRangeM: 600, visibleRangeM: 0, smellRangeM: 0 }),
    conditions: Object.freeze([{ type: 'infrastructure_available', systemType: 'electricity', zoneId: 'home', minimumLevelPct: 20 }]),
    narrativeEvent: 'WORLD_SECURITY_ALARM',
    tags: Object.freeze(['alarm', 'noise']),
  }),
  smoke_plume: Object.freeze({
    id: 'smoke_plume',
    category: 'hazard',
    defaultDurationSeconds: 3 * 3600,
    defaultMinDelaySeconds: 6 * 3600,
    defaultMaxDelaySeconds: 72 * 3600,
    defaultProbability: 0.3,
    sensory: Object.freeze({ audibleRangeM: 80, visibleRangeM: 2000, smellRangeM: 250 }),
    conditions: Object.freeze([]),
    narrativeEvent: 'WORLD_SMOKE_PLUME',
    tags: Object.freeze(['smoke', 'fire', 'hazard']),
  }),
  animal_noise: Object.freeze({
    id: 'animal_noise',
    category: 'life',
    defaultDurationSeconds: 15 * 60,
    defaultMinDelaySeconds: 2 * 3600,
    defaultMaxDelaySeconds: 18 * 3600,
    defaultProbability: 0.75,
    sensory: Object.freeze({ audibleRangeM: 250, visibleRangeM: 80, smellRangeM: 0 }),
    conditions: Object.freeze([]),
    narrativeEvent: 'WORLD_ANIMAL_ACTIVITY',
    tags: Object.freeze(['animal', 'noise']),
  }),
  unattended_noise: Object.freeze({
    id: 'unattended_noise',
    category: 'ambient',
    defaultDurationSeconds: 5 * 60,
    defaultMinDelaySeconds: 30 * 60,
    defaultMaxDelaySeconds: 12 * 3600,
    defaultProbability: 0.55,
    sensory: Object.freeze({ audibleRangeM: 180, visibleRangeM: 0, smellRangeM: 0 }),
    conditions: Object.freeze([]),
    narrativeEvent: 'WORLD_UNATTENDED_NOISE',
    tags: Object.freeze(['noise', 'ambient']),
  }),
});

export function getWorldEventDefinition(id: WorldEventDefinitionId): WorldEventDefinition {
  return WORLD_EVENT_DEFINITIONS[id];
}
