export interface EnvironmentControllerComponent {
  minimumVoltagePercent: number;
  targetTemperatureC: number;
}

export interface ContainerDefinition {
  id: string;
  name: string;
  environmentController?: EnvironmentControllerComponent;
}

export const CONTAINER_DEFINITIONS: Readonly<Record<string, ContainerDefinition>> = Object.freeze({
  drawer: Object.freeze({ id: 'drawer', name: 'Tiroir' }),
  refrigerator: Object.freeze({
    id: 'refrigerator',
    name: 'Réfrigérateur',
    environmentController: Object.freeze({
      minimumVoltagePercent: 70,
      targetTemperatureC: 4,
    }),
  }),
});

export function getContainerDefinition(definitionId: string): ContainerDefinition | undefined {
  return CONTAINER_DEFINITIONS[definitionId];
}
