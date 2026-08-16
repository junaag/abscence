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
  describeItemExamination,
  equipmentState,
  formatClock,
  getCarryCapacity,
  getCarryLoad,
  getContainerActions,
  getContextActions,
  getEncumbranceProfile,
  getItemActions,
  getMobileNetworkState,
  getPhoneCapabilities,
  getWeatherState,
  inventoryItems,
  isItemEquipped,
  looseItemsAtCurrentLocation,
  performAction,
  phoneCalls,
  phoneContacts,
  phoneDeviceItemId,
  phoneMessages,
} from '../engine';

export type {
  ActionOption,
  ActionResult,
  EncumbranceProfile,
  EncumbranceTier,
  GameAction,
  GameState,
  PhoneContactOption,
  WeatherCondition,
} from '../engine';
