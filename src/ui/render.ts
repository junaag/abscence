import {
  addExploredMapArea,
  addExploredMapCorridor,
  updateMapViewport,
  type MapCoordinate,
  type MapUiState,
} from '../app/map-state';
import type { UiPreferences } from '../app/preferences';
import {
  currentLocation,
  performAction,
  phoneDeviceItemId,
  type GameAction,
  type GameState,
} from '../app/game-api';
import type { MapController } from './map';
import { menuOverlay, type MenuPanel } from './menu';
import { renderPersistenceWarning } from './persistence-warning';
import {
  escapeHtml,
  renderHomeView,
  renderHud,
  renderInventoryView,
  renderMapView,
  renderNavigation,
  renderPhoneView,
  renderTargetPopup,
  type PhoneTab,
  type UiState,
  type ViewId,
} from './presentation';

export type { ViewId } from './presentation';

interface MountOptions {
  persist(state: GameState): boolean;
  preferences: UiPreferences;
  persistPreferences(preferences: UiPreferences): boolean;
  mapState: MapUiState;
  persistMapState(state: MapUiState): boolean;
  initialPersistenceWarning?: boolean;
}

function viewMarkup(state: GameState, ui: UiState): string {
  switch (ui.view) {
    case 'home': return renderHomeView(state, ui);
    case 'inventory': return renderInventoryView(state, ui);
    case 'phone': return renderPhoneView(state, ui);
    case 'map': return `${renderHomeView(state, { ...ui, view: 'home' })}${renderMapView(ui)}`;
  }
}

function locationMapCoordinate(state: GameState): MapCoordinate | null {
  const position = currentLocation(state).position;
  if (!position || !('x' in position) || !('y' in position)) return null;
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  return { x: position.x, y: position.y };
}

export function mountApp(root: HTMLElement, initialState: GameState, options: MountOptions): void {
  let state = initialState;
  let ui: UiState = {
    view: 'home',
    phoneTab: 'home',
    popupTarget: undefined,
    result: undefined,
  };
  let menuPanel: MenuPanel = null;
  let preferences: UiPreferences = { ...options.preferences };
  let persistenceWarning = Boolean(options.initialPersistenceWarning);
  let mapState: MapUiState = structuredClone(options.mapState);
  let mapController: MapController | null = null;
  let mapControllerPromise: Promise<MapController> | null = null;
  let popupContainerContextId: string | undefined;

  const markPersistenceFailure = (success: boolean): void => {
    if (!success) persistenceWarning = true;
  };

  const persistMapState = (nextMapState: MapUiState): void => {
    mapState = structuredClone(nextMapState);
    markPersistenceFailure(options.persistMapState(mapState));
    if (persistenceWarning) render();
  };

  const getMapController = (): Promise<MapController> => {
    if (mapController) return Promise.resolve(mapController);
    if (!mapControllerPromise) {
      mapControllerPromise = import('./map').then(({ createMapController }) => {
        const controller = createMapController(
          mapState,
          persistMapState,
          (encodedTarget) => execute({ id: 'TRAVEL_TO_MAP_POI', targetId: encodedTarget }),
          (encodedTarget) => execute({ id: 'WALK_TO_MAP_POINT', targetId: encodedTarget }),
          locationMapCoordinate(state),
        );
        mapController = controller;
        return controller;
      });
    }
    return mapControllerPromise;
  };

  const attachMapWhenReady = (): void => {
    void getMapController()
      .then((controller) => {
        if (ui.view !== 'map') {
          controller.detach();
          return;
        }
        controller.sync(mapState, locationMapCoordinate(state));
        const slot = root.querySelector<HTMLElement>('[data-map-slot]');
        if (slot) controller.attach(slot);
      })
      .catch((error: unknown) => console.error(error));
  };

  function render(): void {
    root.innerHTML = [
      renderHud(state),
      renderPersistenceWarning(persistenceWarning),
      viewMarkup(state, ui),
      renderNavigation(ui.view, state),
      renderTargetPopup(state, ui),
      menuOverlay(menuPanel, preferences),
    ].join('');

    if (ui.view === 'map') attachMapWhenReady();
    else mapController?.detach();
  }

  const revealMovementOnMap = (previousState: GameState): void => {
    const destination = locationMapCoordinate(state);
    const origin = locationMapCoordinate(previousState);
    if (!destination || !origin) return;

    let nextMapState = addExploredMapArea(mapState, { ...destination, radiusM: 16 });
    const moved = Math.abs(origin.x - destination.x) > 0.01 || Math.abs(origin.y - destination.y) > 0.01;
    if (moved) nextMapState = addExploredMapCorridor(nextMapState, { points: [origin, destination], radiusM: 7 });
    nextMapState = updateMapViewport(nextMapState, destination.x, destination.y, nextMapState.zoom);
    persistMapState(nextMapState);
    mapController?.sync(mapState, destination);
  };

  const closePopupContext = (): void => {
    const targetContainerId = ui.popupTarget?.kind === 'container' ? ui.popupTarget.id : popupContainerContextId;
    if (targetContainerId && state.containers[targetContainerId]?.open) {
      const transition = performAction(state, { id: 'OPEN_CONTAINER', targetId: targetContainerId });
      if (transition.result.success) {
        state = transition.state;
        markPersistenceFailure(options.persist(state));
      }
    }
    popupContainerContextId = undefined;
    ui.popupTarget = undefined;
  };

  const execute = (action: GameAction): void => {
    const previousState = state;
    const transition = performAction(state, action);
    state = transition.state;
    ui.result = transition.result;
    markPersistenceFailure(options.persist(state));

    const location = currentLocation(state);
    const outdoorMove = action.id === 'MOVE' && (location.poiSite ? location.poiSite.phase === 'outside' : location.ventilation >= 0.8);
    if (transition.result.success && (action.id === 'TRAVEL_TO_MAP_POI' || action.id === 'WALK_TO_MAP_POINT' || outdoorMove)) revealMovementOnMap(previousState);

    if (transition.result.success && (action.id === 'TRAVEL_TO_MAP_POI' || action.id === 'WALK_TO_MAP_POINT')) {
      ui.view = 'home';
    }

    if (transition.result.success && action.targetId && state.items[action.targetId]?.location.kind === 'consumed') {
      closePopupContext();
    }

    if (transition.result.success && action.id === 'USE_ITEM' && action.targetId === phoneDeviceItemId(state)) {
      ui.view = 'phone';
      ui.phoneTab = 'home';
      ui.popupTarget = undefined;
      popupContainerContextId = undefined;
    }
    render();
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;

    if (button.dataset.closeMap !== undefined) {
      ui.view = 'home';
      render();
      return;
    }

    const navId = button.dataset.nav as ViewId | undefined;
    if (navId) {
      closePopupContext();
      ui = { view: navId, phoneTab: ui.phoneTab, popupTarget: undefined, result: ui.result };
      menuPanel = null;
      render();
      return;
    }

    const phoneTab = button.dataset.phoneTab as PhoneTab | undefined;
    if (phoneTab) {
      ui.phoneTab = phoneTab;
      render();
      return;
    }

    if (button.dataset.menu !== undefined) {
      menuPanel = 'menu';
      render();
      return;
    }
    if (button.dataset.menuHome !== undefined) {
      closePopupContext();
      ui = { view: 'home', phoneTab: ui.phoneTab, popupTarget: undefined, result: ui.result };
      menuPanel = null;
      render();
      return;
    }
    if (button.dataset.openSettings !== undefined) {
      menuPanel = 'settings';
      render();
      return;
    }
    if (button.dataset.openAbout !== undefined) {
      menuPanel = 'about';
      render();
      return;
    }
    if (button.dataset.menuBack !== undefined) {
      menuPanel = 'menu';
      render();
      return;
    }
    if (button.dataset.toggleSound !== undefined) {
      preferences = { ...preferences, soundEnabled: !preferences.soundEnabled };
      markPersistenceFailure(options.persistPreferences(preferences));
      render();
      return;
    }

    if (button.dataset.closePopup !== undefined) {
      closePopupContext();
      menuPanel = null;
      render();
      return;
    }
    if (button.dataset.openItem) {
      const item = state.items[button.dataset.openItem];
      if (ui.popupTarget?.kind === 'container') popupContainerContextId = ui.popupTarget.id;
      else if (item?.location.kind === 'container' && state.containers[item.location.id]?.open) popupContainerContextId = item.location.id;
      else popupContainerContextId = undefined;
      ui.popupTarget = { kind: 'item', id: button.dataset.openItem };
      render();
      return;
    }
    if (button.dataset.openContainer) {
      popupContainerContextId = button.dataset.openContainer;
      ui.popupTarget = { kind: 'container', id: button.dataset.openContainer };
      render();
      return;
    }

    if (button.dataset.stat) {
      root.querySelector('.stat-popover')?.remove();
      const rect = button.getBoundingClientRect();
      const popover = document.createElement('div');
      popover.className = 'stat-popover';
      popover.style.top = `${Math.min(window.innerHeight - 120, rect.bottom + 6)}px`;
      popover.style.left = '12px';
      popover.innerHTML = `<strong>${escapeHtml(button.dataset.statLabel ?? '')}</strong><p>${escapeHtml(button.dataset.statDescription ?? '')}</p>`;
      document.body.append(popover);
      window.setTimeout(() => popover.remove(), 2600);
      return;
    }

    const actionId = button.dataset.action as GameAction['id'] | undefined;
    if (!actionId) return;

    const action: GameAction = { id: actionId };
    if (button.dataset.target) action.targetId = button.dataset.target;
    if (button.dataset.source) action.sourceId = button.dataset.source;
    if (button.dataset.amount) action.amountMl = Number(button.dataset.amount);
    if (button.dataset.seconds) action.seconds = Number(button.dataset.seconds);
    execute(action);
  });

  render();
}
