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

export type EquipmentSlot = 'back' | 'waist';

export interface EquipmentComponent {
  slot: EquipmentSlot;
  capacityBonus: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  portable?: boolean;
  carryCost?: number;
  equipment?: EquipmentComponent;
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
    carryCost: 0.25,
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
    carryCost: 0.8,
    inspection: Object.freeze({
      role: 'Un contenant transportable pour conserver et boire de l’eau.',
      operation: 'Elle peut être bue par petites quantités et remplie à une source d’eau utilisable.',
    }),
  }),
  towel: Object.freeze({
    id: 'towel',
    name: 'Torchon',
    carryCost: 0.2,
    inspection: Object.freeze({
      role: 'Un textile absorbant utile pour éponger de petites quantités d’eau.',
      operation: 'Il s’utilise directement sur une zone humide accessible.',
    }),
  }),
  key: Object.freeze({
    id: 'key',
    name: 'Petite clé',
    carryCost: 0.05,
    inspection: Object.freeze({
      role: 'Une petite clé métallique. Sa serrure correspondante n’est pas identifiée.',
      operation: 'Il faudra trouver une serrure compatible avant de pouvoir déterminer son utilité exacte.',
    }),
  }),
  smartphone: Object.freeze({
    id: 'smartphone',
    name: 'Téléphone',
    carryCost: 0.4,
    inspection: Object.freeze({
      role: 'Un smartphone verrouillé mais utilisable. Son contenu peut révéler des informations sur la personne qui le possédait.',
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
  wristwatch: Object.freeze({
    id: 'wristwatch',
    name: 'Montre',
    carryCost: 0.05,
    inspection: Object.freeze({
      role: 'Une montre simple. Elle permet de connaître l’heure sans dépendre d’un réseau ou d’un téléphone.',
      operation: 'Il suffit de la garder avec vous pour consulter l’heure.',
    }),
  }),
  backpack: Object.freeze({
    id: 'backpack',
    name: 'Sac à dos',
    carryCost: 0.8,
    equipment: Object.freeze({ slot: 'back', capacityBonus: 8 }),
    inspection: Object.freeze({
      role: 'Un sac à dos classique qui augmente nettement ce que vous pouvez transporter.',
      operation: 'Il doit être équipé sur le dos pour fournir sa capacité supplémentaire.',
    }),
  }),
  waist_bag: Object.freeze({
    id: 'waist_bag',
    name: 'Sac banane',
    carryCost: 0.3,
    equipment: Object.freeze({ slot: 'waist', capacityBonus: 3 }),
    inspection: Object.freeze({
      role: 'Une petite sacoche portée à la taille. Elle ajoute un espace de transport accessible sans occuper le dos.',
      operation: 'Elle peut être équipée en même temps qu’un sac à dos.',
    }),
  }),
  hiking_backpack: Object.freeze({
    id: 'hiking_backpack',
    name: 'Sac de randonnée',
    carryCost: 1.2,
    equipment: Object.freeze({ slot: 'back', capacityBonus: 15 }),
    inspection: Object.freeze({
      role: 'Un grand sac de randonnée conçu pour emporter beaucoup plus de matériel.',
      operation: 'Il occupe l’emplacement du dos et remplace donc un sac à dos classique lorsqu’il est équipé.',
    }),
  }),
  flashlight: Object.freeze({
    id: 'flashlight',
    name: 'Lampe torche',
    carryCost: 0.5,
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
  bandage_pack: Object.freeze({
    id: 'bandage_pack',
    name: 'Paquet de bandages',
    carryCost: 0.25,
    inspection: Object.freeze({
      role: 'Des bandages propres encore emballés, utiles pour traiter une blessure légère.',
      operation: 'Le système de soins détaillé sera nécessaire pour exploiter correctement ce matériel.',
    }),
  }),
  first_aid_kit: Object.freeze({
    id: 'first_aid_kit',
    name: 'Trousse de premiers secours',
    carryCost: 1.1,
    inspection: Object.freeze({
      role: 'Une trousse contenant plusieurs fournitures médicales de base.',
      operation: 'Son contenu prendra toute son importance lorsque les soins et blessures seront plus détaillés.',
    }),
  }),
  crowbar: Object.freeze({
    id: 'crowbar',
    name: 'Pied-de-biche',
    carryCost: 1.4,
    inspection: Object.freeze({
      role: 'Un levier métallique robuste, lourd mais très utile pour des accès récalcitrants.',
      operation: 'Il réduit fortement le temps et le risque lorsqu’un accès doit être forcé.',
    }),
  }),
  tool_kit: Object.freeze({
    id: 'tool_kit',
    name: 'Caisse à outils',
    carryCost: 2,
    inspection: Object.freeze({
      role: 'Un assortiment d’outils mécaniques et de bricolage dans une caisse compacte.',
      operation: 'L’ensemble est lourd mais pourra servir à de nombreuses réparations et manipulations.',
    }),
  }),
  empty_fuel_can: Object.freeze({
    id: 'empty_fuel_can',
    name: 'Jerrican vide',
    carryCost: 1,
    inspection: Object.freeze({
      role: 'Un jerrican homologué pour transporter du carburant.',
      operation: 'Il est vide pour l’instant ; il deviendra utile lorsque le stockage de carburant sera exploitable.',
    }),
  }),
  canned_food: Object.freeze({
    id: 'canned_food',
    name: 'Boîte de conserve',
    carryCost: 0.65,
    inspection: Object.freeze({
      role: 'Une conserve alimentaire intacte, beaucoup plus durable qu’un produit frais.',
      operation: 'Elle devra être ouverte avant consommation ; cette interaction sera détaillée avec la cuisine et les outils.',
    }),
  }),
  work_gloves: Object.freeze({
    id: 'work_gloves',
    name: 'Gants de travail',
    carryCost: 0.15,
    inspection: Object.freeze({
      role: 'Des gants épais destinés à protéger les mains lors de manipulations salissantes ou coupantes.',
      operation: 'Ils pourront réduire certains risques lorsque l’équipement de protection sera détaillé.',
    }),
  }),
  wall_outlet: Object.freeze({
    id: 'wall_outlet',
    name: 'Prise électrique',
    portable: false,
    carryCost: 0,
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