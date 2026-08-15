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

export interface PerishableComponent {
  initialFreshnessPercent: number;
  degradationPercentPerHourAmbient: number;
  refrigeratedMultiplier?: number;
}

export interface InspectionComponent {
  role: string;
  operation?: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  portable?: boolean;
  inspection?: InspectionComponent;
  battery?: BatteryComponent;
  usable?: UsableComponent;
  powerSource?: PowerSourceComponent;
  perishable?: PerishableComponent;
}

export const ITEM_DEFINITIONS: Readonly<Record<string, ItemDefinition>> = Object.freeze({
  apple: Object.freeze({
    id: 'apple',
    name: 'Pomme',
    inspection: Object.freeze({
      role: 'Un aliment consommable qui calme la faim et apporte aussi un peu d’eau.',
      operation: 'Elle se mange directement et ne nécessite aucun outil.',
    }),
    perishable: Object.freeze({
      initialFreshnessPercent: 94,
      degradationPercentPerHourAmbient: 0.2,
      refrigeratedMultiplier: 0.25,
    }),
  }),
  water_bottle: Object.freeze({
    id: 'water_bottle',
    name: 'Bouteille d’eau',
    inspection: Object.freeze({
      role: 'Un contenant transportable pour conserver et boire de l’eau.',
      operation: 'Elle peut être bue par petites quantités et remplie à une source d’eau utilisable.',
    }),
  }),
  towel: Object.freeze({
    id: 'towel',
    name: 'Torchon',
    inspection: Object.freeze({
      role: 'Un textile absorbant utile pour éponger de petites quantités d’eau.',
      operation: 'Il s’utilise directement sur une zone humide accessible.',
    }),
  }),
  key: Object.freeze({
    id: 'key',
    name: 'Petite clé',
    inspection: Object.freeze({
      role: 'Une petite clé métallique. Sa serrure correspondante n’est pas identifiée.',
      operation: 'Il faudra trouver une serrure compatible avant de pouvoir déterminer son utilité exacte.',
    }),
  }),
  smartphone: Object.freeze({
    id: 'smartphone',
    name: 'Téléphone',
    inspection: Object.freeze({
      role: 'Votre téléphone personnel. Il donne accès aux informations enregistrées et aux fonctions de communication.',
      operation: 'Il fonctionne sur batterie ; les appels, SMS et données dépendent aussi de l’état du réseau mobile.',
    }),
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
    inspection: Object.freeze({
      role: 'Une source de lumière portable alimentée par batterie.',
      operation: 'Un interrupteur permet de l’allumer ou de l’éteindre ; la batterie se décharge lorsqu’elle reste allumée.',
    }),
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
    portable: false,
    inspection: Object.freeze({
      role: 'Une prise murale fixe pouvant alimenter ou recharger un appareil compatible.',
      operation: 'Elle ne fournit du courant que si le réseau électrique du lieu est encore disponible.',
    }),
    powerSource: Object.freeze({ minimumVoltagePct: 1 }),
  }),
});

export function getItemDefinition(definitionId: string): ItemDefinition | undefined {
  return ITEM_DEFINITIONS[definitionId];
}
