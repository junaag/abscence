import { getItemDefinition } from '../content/items';
import type { GameState } from './model';

export function describeItemExamination(state: GameState, itemId: string): string {
  const item = state.items[itemId];
  if (!item) return '';

  const definition = getItemDefinition(item.definitionId);
  const details: string[] = [];

  if (definition?.inspection?.role) details.push(definition.inspection.role);
  if (definition?.inspection?.operation) details.push(definition.inspection.operation);
  if (definition?.powerSource) {
    const electricity = state.infrastructure.electricity;
    const powered = electricity.available && electricity.voltagePercent >= definition.powerSource.minimumVoltagePct;
    details.push(powered
      ? `Alimentation : réseau disponible (${Math.round(electricity.voltagePercent)} %).`
      : 'Alimentation : hors tension.');
  }
  if (item.condition) details.push(`État : ${item.condition}.`);
  if (item.freshnessPercent !== undefined) details.push(`Fraîcheur : ${item.freshnessPercent.toFixed(1)} %.`);
  if (item.capacityMl !== undefined) details.push(`Contenu actuel : ${item.liquidMl ?? 0}/${item.capacityMl} ml.`);
  if (item.batteryPercent !== undefined) details.push(`Batterie : ${item.batteryPercent.toFixed(1)} %.`);
  if (item.enabled !== undefined) details.push(`Fonctionnement actuel : ${item.enabled ? 'allumé' : 'éteint'}.`);

  if (details.length === 0) return 'Rien d’anormal ne ressort de cet examen et son utilité n’est pas encore évidente.';
  return details.join(' ');
}
