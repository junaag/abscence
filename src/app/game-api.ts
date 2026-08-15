// Presentation-safe game API.
//
// UI modules import gameplay capabilities only from this boundary. The broader
// engine facade intentionally exposes simulation/admin helpers for app wiring
// and tests, but those helpers must never be callable directly by presentation
// code.
export {
  containerContents,
  containersAtCurrentLocation,
  currentLocation,
  formatClock,
  getContainerActions,
  getContextActions,
  getItemActions,
  getMobileNetworkState,
  getWeatherState,
  inventoryItems,
  looseItemsAtCurrentLocation,
  performAction,
  phoneCalls,
  phoneDeviceItemId,
  phoneMessages,
} from '../engine';

export type {
  ActionOption,
  ActionResult,
  GameAction,
  GameState,
  WeatherCondition,
} from '../engine';
