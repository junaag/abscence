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

export interface PowerSourceComponent { minimumVoltagePct: number; }
export interface PerishableComponent { initialFreshnessPercent: number; degradationPercentPerHourAmbient: number; refrigeratedMultiplier?: number; }
export interface InspectionComponent { role: string; operation?: string; }
export type EquipmentSlot = 'back' | 'waist';
export interface EquipmentComponent { slot: EquipmentSlot; capacityBonus: number; }

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
    id: 'apple', name: 'Pomme', carryCost: 0.25,
    inspection: Object.freeze({ role: 'Un fruit frais : nourriture et un peu d’eau.', operation: 'Se mange directement.' }),
    perishable: Object.freeze({ initialFreshnessPercent: 94, degradationPercentPerHourAmbient: 0.2, refrigeratedMultiplier: 0.25 }),
  }),
  water_bottle: Object.freeze({
    id: 'water_bottle', name: 'Bouteille d’eau', carryCost: 0.8,
    inspection: Object.freeze({ role: 'Un contenant transportable.', operation: 'Peut être bu ou rempli.' }),
  }),
  towel: Object.freeze({ id: 'towel', name: 'Torchon', carryCost: 0.2, inspection: Object.freeze({ role: 'Un textile absorbant.', operation: 'Permet d’éponger.' }) }),
  key: Object.freeze({ id: 'key', name: 'Petite clé', carryCost: 0.05, inspection: Object.freeze({ role: 'Une clé dont la serrure reste inconnue.' }) }),
  smartphone: Object.freeze({
    id: 'smartphone', name: 'Téléphone', carryCost: 0.4,
    inspection: Object.freeze({ role: 'Un smartphone utilisable.', operation: 'Il fonctionne sur batterie ; le réseau conditionne ses fonctions.' }),
    battery: Object.freeze({ initialChargePct: 78, useCostPct: 0.03, rechargeable: true, chargeRatePctPerMinute: 2 }),
    usable: Object.freeze({ durationSeconds: 3, uiIntent: 'OPEN_PHONE' }),
  }),
  wristwatch: Object.freeze({ id: 'wristwatch', name: 'Montre', carryCost: 0.05, inspection: Object.freeze({ role: 'Une montre simple permettant de connaître l’heure.' }) }),
  backpack: Object.freeze({
    id: 'backpack', name: 'Sac à dos', carryCost: 0.8, equipment: Object.freeze({ slot: 'back', capacityBonus: 8 }),
    inspection: Object.freeze({ role: 'Un sac dorsal augmentant la capacité de transport.' }),
  }),
  waist_bag: Object.freeze({
    id: 'waist_bag', name: 'Sac banane', carryCost: 0.3, equipment: Object.freeze({ slot: 'waist', capacityBonus: 3 }),
    inspection: Object.freeze({ role: 'Une petite sacoche de taille, compatible avec un sac dorsal.' }),
  }),
  hiking_backpack: Object.freeze({
    id: 'hiking_backpack', name: 'Sac de randonnée', carryCost: 1.2, equipment: Object.freeze({ slot: 'back', capacityBonus: 15 }),
    inspection: Object.freeze({ role: 'Un grand sac dorsal à forte capacité.' }),
  }),
  flashlight: Object.freeze({
    id: 'flashlight', name: 'Lampe torche', carryCost: 0.5,
    inspection: Object.freeze({ role: 'Une lampe portable sur batterie.' }),
    battery: Object.freeze({ initialChargePct: 64, useCostPct: 0.02, passiveDrainPctPerMinuteWhenEnabled: 0.25 }),
    usable: Object.freeze({ durationSeconds: 1, toggleEnabled: true }),
  }),
  bandage_pack: Object.freeze({ id: 'bandage_pack', name: 'Paquet de bandages', carryCost: 0.25, inspection: Object.freeze({ role: 'Des bandages propres encore emballés.' }) }),
  first_aid_kit: Object.freeze({ id: 'first_aid_kit', name: 'Trousse de premiers secours', carryCost: 1.1, inspection: Object.freeze({ role: 'Des fournitures médicales de base.' }) }),
  crowbar: Object.freeze({ id: 'crowbar', name: 'Pied-de-biche', carryCost: 1.4, inspection: Object.freeze({ role: 'Un levier robuste qui facilite les accès forcés.' }) }),
  tool_kit: Object.freeze({ id: 'tool_kit', name: 'Caisse à outils', carryCost: 2, inspection: Object.freeze({ role: 'Un assortiment d’outils, lourd mais polyvalent.' }) }),
  empty_fuel_can: Object.freeze({ id: 'empty_fuel_can', name: 'Jerrican vide', carryCost: 1, inspection: Object.freeze({ role: 'Un jerrican destiné au carburant.' }) }),
  canned_food: Object.freeze({ id: 'canned_food', name: 'Boîte de conserve', carryCost: 0.65, inspection: Object.freeze({ role: 'Une conserve alimentaire intacte.' }) }),
  work_gloves: Object.freeze({ id: 'work_gloves', name: 'Gants de travail', carryCost: 0.15, inspection: Object.freeze({ role: 'Des gants épais de protection.' }) }),
  wall_outlet: Object.freeze({
    id: 'wall_outlet', name: 'Prise électrique', portable: false, carryCost: 0,
    inspection: Object.freeze({ role: 'Une prise murale.', operation: 'Fonctionne si le réseau électrique est disponible.' }),
    powerSource: Object.freeze({ minimumVoltagePct: 1 }),
  }),
});

export function getItemDefinition(definitionId: string): ItemDefinition | undefined { return ITEM_DEFINITIONS[definitionId]; }