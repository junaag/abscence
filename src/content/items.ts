export interface BatteryComponent {
  initialChargePct: number;
  useCostPct: number;
  rechargeable?: boolean;
  chargeRatePctPerMinute?: number;
  passiveDrainPctPerMinuteWhenEnabled?: number;
}

export interface UsableComponent {
  durationSeconds: number;
  toggleEnabled?: boolean;
  uiIntent?: string;
}

export interface PowerSourceComponent {
  minimumVoltagePct: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  battery?: BatteryComponent;
  usable?: UsableComponent;
  powerSource?: PowerSourceComponent;
}

export const ITEM_DEFINITIONS: Readonly<Record<string, ItemDefinition>> = Object.freeze({
  smartphone: Object.freeze({
    id: 'smartphone',
    name: 'Téléphone',
    battery: Object.freeze({
      initialChargePct: 78,
      useCostPct: 0.03,
      rechargeable: true,
      chargeRatePctPerMinute: 2,
    }),
    usable: Object.freeze({ durationSeconds: 3, uiIntent: 'OPEN_PHONE' }),
  }),
  flashlight: Object.freeze({
    id: 'flashlight',
    name: 'Lampe torche',
    battery: Object.freeze({
      initialChargePct: 64,
      useCostPct: 0.02,
      passiveDrainPctPerMinuteWhenEnabled: 0.25,
    }),
    usable: Object.freeze({ durationSeconds: 1, toggleEnabled: true }),
  }),
  wall_outlet: Object.freeze({
    id: 'wall_outlet',
    name: 'Prise électrique',
    powerSource: Object.freeze({ minimumVoltagePct: 1 }),
  }),
});

export function getItemDefinition(definitionId: string): ItemDefinition | undefined {
  return ITEM_DEFINITIONS[definitionId];
}
