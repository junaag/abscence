import { activeEffectsAt, addPersistentEffect } from './effects';
import type { GameState, PersistentEffectType } from './model';
import { createInitialState } from './state';

export interface LocalPoint {
  x: number;
  y: number;
}

export type DestructibleKind = 'generic' | 'water_pipe' | 'power_box' | 'fuel_canister';

export interface DestructionEffectDefinition {
  type: PersistentEffectType;
  intensity: number;
}

export interface DestructibleObjectState {
  id: string;
  label: string;
  kind: DestructibleKind;
  position: LocalPoint;
  radiusM: number;
  maxHealthPv: number;
  healthPv: number;
  destroyed: boolean;
  destructionEffects: DestructionEffectDefinition[];
}

export interface VerticalSliceWeaponState {
  name: string;
  ammo: number;
  magazineCapacity: number;
  damagePv: number;
  rangeM: number;
  noiseIntensity: number;
}

export interface VerticalSliceSceneState {
  locationId: string;
  bounds: {
    widthM: number;
    heightM: number;
  };
  playerPosition: LocalPoint;
  playerRadiusM: number;
  moveStepLimitM: number;
  weapon: VerticalSliceWeaponState;
  destructibles: Record<string, DestructibleObjectState>;
}

export interface VerticalSliceState {
  game: GameState;
  scene: VerticalSliceSceneState;
}

export type VerticalSliceCommand =
  | { type: 'MOVE'; dxM: number; dyM: number }
  | { type: 'SHOOT'; targetId: string };

export type VerticalSliceEvent =
  | { type: 'moved'; from: LocalPoint; to: LocalPoint; distanceM: number }
  | { type: 'shot'; targetId: string; ammoRemaining: number; distanceM: number }
  | { type: 'damaged'; targetId: string; damagePv: number; healthPv: number }
  | { type: 'destroyed'; targetId: string; kind: DestructibleKind }
  | { type: 'effect_started'; effectId: string; effectType: PersistentEffectType; locationId: string };

export interface VerticalSliceResult {
  success: boolean;
  summary: string;
  events: VerticalSliceEvent[];
}

export interface VerticalSliceTransition {
  state: VerticalSliceState;
  result: VerticalSliceResult;
}

export interface VerticalSliceSnapshot {
  locationId: string;
  playerPosition: LocalPoint;
  weapon: {
    name: string;
    ammo: number;
    magazineCapacity: number;
  };
  targets: Array<{
    id: string;
    label: string;
    kind: DestructibleKind;
    position: LocalPoint;
    healthPv: number;
    maxHealthPv: number;
    destroyed: boolean;
  }>;
  effects: Array<{
    id: string;
    type: PersistentEffectType;
    intensity: number;
  }>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function distance(a: LocalPoint, b: LocalPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function createDefaultDestructibles(): Record<string, DestructibleObjectState> {
  return {
    wood_panel: {
      id: 'wood_panel',
      label: 'Panneau en bois',
      kind: 'generic',
      position: { x: 5, y: 2 },
      radiusM: 0.45,
      maxHealthPv: 30,
      healthPv: 30,
      destroyed: false,
      destructionEffects: [],
    },
    water_pipe: {
      id: 'water_pipe',
      label: "Conduite d'eau",
      kind: 'water_pipe',
      position: { x: 7, y: 4 },
      radiusM: 0.35,
      maxHealthPv: 30,
      healthPv: 30,
      destroyed: false,
      destructionEffects: [{ type: 'water_puddle', intensity: 28 }],
    },
    power_box: {
      id: 'power_box',
      label: 'Coffret électrique',
      kind: 'power_box',
      position: { x: 8, y: 2 },
      radiusM: 0.4,
      maxHealthPv: 40,
      healthPv: 40,
      destroyed: false,
      destructionEffects: [{ type: 'smoke', intensity: 24 }],
    },
    fuel_canister: {
      id: 'fuel_canister',
      label: 'Bidon de carburant',
      kind: 'fuel_canister',
      position: { x: 9, y: 5 },
      radiusM: 0.4,
      maxHealthPv: 20,
      healthPv: 20,
      destroyed: false,
      destructionEffects: [{ type: 'fire', intensity: 20 }],
    },
  };
}

export function createVerticalSliceState(gameState: GameState = createInitialState()): VerticalSliceState {
  const game = structuredClone(gameState);
  return {
    game,
    scene: {
      locationId: game.player.locationId,
      bounds: { widthM: 12, heightM: 8 },
      playerPosition: { x: 2, y: 4 },
      playerRadiusM: 0.35,
      moveStepLimitM: 1.5,
      weapon: {
        name: 'Pistolet de test',
        ammo: 12,
        magazineCapacity: 12,
        damagePv: 20,
        rangeM: 12,
        noiseIntensity: 72,
      },
      destructibles: createDefaultDestructibles(),
    },
  };
}

function failed(state: VerticalSliceState, summary: string): VerticalSliceTransition {
  return {
    state,
    result: {
      success: false,
      summary,
      events: [],
    },
  };
}

function movePlayer(state: VerticalSliceState, dxM: number, dyM: number): VerticalSliceTransition {
  if (!Number.isFinite(dxM) || !Number.isFinite(dyM)) return failed(state, 'Déplacement invalide.');

  const requestedDistance = Math.hypot(dxM, dyM);
  if (requestedDistance <= 0) return failed(state, 'Aucun déplacement.');

  const scale = Math.min(1, state.scene.moveStepLimitM / requestedDistance);
  const from = { ...state.scene.playerPosition };
  const radius = state.scene.playerRadiusM;
  const to = {
    x: clamp(from.x + dxM * scale, radius, state.scene.bounds.widthM - radius),
    y: clamp(from.y + dyM * scale, radius, state.scene.bounds.heightM - radius),
  };
  const movedDistance = distance(from, to);
  state.scene.playerPosition = to;

  return {
    state,
    result: {
      success: true,
      summary: `Déplacement de ${round(movedDistance)} m.`,
      events: [{ type: 'moved', from, to: { ...to }, distanceM: round(movedDistance) }],
    },
  };
}

function triggerShotNoise(state: VerticalSliceState, events: VerticalSliceEvent[]): void {
  const effect = addPersistentEffect(
    state.game,
    'persistent_noise',
    state.scene.locationId,
    state.scene.weapon.noiseIntensity,
    { source: 'gunshot', spreading: false },
  );
  events.push({
    type: 'effect_started',
    effectId: effect.id,
    effectType: effect.type,
    locationId: effect.locationId,
  });
}

function triggerDestructionEffects(
  state: VerticalSliceState,
  target: DestructibleObjectState,
  events: VerticalSliceEvent[],
): void {
  for (const definition of target.destructionEffects) {
    const effect = addPersistentEffect(
      state.game,
      definition.type,
      state.scene.locationId,
      definition.intensity,
      { source: `destroyed:${target.id}`, spreading: true },
    );
    events.push({
      type: 'effect_started',
      effectId: effect.id,
      effectType: effect.type,
      locationId: effect.locationId,
    });
  }
}

function shootTarget(state: VerticalSliceState, targetId: string): VerticalSliceTransition {
  const target = state.scene.destructibles[targetId];
  if (!target) return failed(state, 'Cible introuvable.');
  if (target.destroyed) return failed(state, `${target.label} est déjà détruit.`);
  if (state.scene.weapon.ammo <= 0) return failed(state, 'Chargeur vide.');

  const targetDistance = distance(state.scene.playerPosition, target.position);
  if (targetDistance > state.scene.weapon.rangeM) return failed(state, 'Cible hors de portée.');

  state.scene.weapon.ammo -= 1;
  const events: VerticalSliceEvent[] = [{
    type: 'shot',
    targetId,
    ammoRemaining: state.scene.weapon.ammo,
    distanceM: round(targetDistance),
  }];
  triggerShotNoise(state, events);

  const damage = Math.min(state.scene.weapon.damagePv, target.healthPv);
  target.healthPv = Math.max(0, target.healthPv - damage);
  events.push({ type: 'damaged', targetId, damagePv: damage, healthPv: target.healthPv });

  if (target.healthPv === 0) {
    target.destroyed = true;
    events.push({ type: 'destroyed', targetId, kind: target.kind });
    triggerDestructionEffects(state, target, events);
  }

  return {
    state,
    result: {
      success: true,
      summary: target.destroyed
        ? `${target.label} détruit.`
        : `${target.label} touché : ${target.healthPv}/${target.maxHealthPv} PV.`,
      events,
    },
  };
}

export function dispatchVerticalSlice(
  current: VerticalSliceState,
  command: VerticalSliceCommand,
): VerticalSliceTransition {
  const state = structuredClone(current);
  if (command.type === 'MOVE') return movePlayer(state, command.dxM, command.dyM);
  return shootTarget(state, command.targetId);
}

export function getVerticalSliceSnapshot(state: VerticalSliceState): VerticalSliceSnapshot {
  return {
    locationId: state.scene.locationId,
    playerPosition: { ...state.scene.playerPosition },
    weapon: {
      name: state.scene.weapon.name,
      ammo: state.scene.weapon.ammo,
      magazineCapacity: state.scene.weapon.magazineCapacity,
    },
    targets: Object.values(state.scene.destructibles).map((target) => ({
      id: target.id,
      label: target.label,
      kind: target.kind,
      position: { ...target.position },
      healthPv: target.healthPv,
      maxHealthPv: target.maxHealthPv,
      destroyed: target.destroyed,
    })),
    effects: activeEffectsAt(state.game, state.scene.locationId).map((effect) => ({
      id: effect.id,
      type: effect.type,
      intensity: effect.intensity,
    })),
  };
}
