import type { MapUiState } from '../app/map-state';
import type { UiPreferences } from '../app/preferences';
import { performAction, type GameAction, type GameState } from '../app/game-api';
import type { MapController } from './map';
import { menuOverlay, type MenuPanel } from './menu';
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
  persist(state: GameState): void;
  preferences: UiPreferences;
  persistPreferences(preferences: UiPreferences): void;
  mapState: MapUiState;
  persistMapState(state: MapUiState): void;
}

function viewMarkup(state: GameState, ui: UiState): string {
  switch (ui.view) {
    case 'home': return renderHomeView(state, ui);
    case 'inventory': return renderInventoryView(state, ui);
    case 'phone': return renderPhoneView(state, ui);
    case 'map': return renderMapView();
  }
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
  let mapController: MapController | null = null;
  let mapControllerPromise: Promise<MapController> | null = null;

  const getMapController = (): Promise<MapController> => {
    if (mapController) return Promise.resolve(mapController);
    if (!mapControllerPromise) {
      mapControllerPromise = import('./map').then(({ createMapController }) => {
        const controller = createMapController(options.mapState, options.persistMapState);
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
        const slot = root.querySelector<HTMLElement>('[data-map-slot]');
        if (slot) controller.attach(slot);
      })
      .catch((error: unknown) => {
        console.error('ABSENCE map module failed to load.', error);
      });
  };

  const render = (): void => {
    root.innerHTML = [
      renderHud(state),
      viewMarkup(state, ui),
      renderNavigation(ui.view),
      renderTargetPopup(state, ui),
      menuOverlay(menuPanel, preferences),
    ].join('');

    if (ui.view === 'map') attachMapWhenReady();
    else mapController?.detach();
  };

  const execute = (action: GameAction): void => {
    const transition = performAction(state, action);
    state = transition.state;
    ui.result = transition.result;
    options.persist(state);
    render();
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;

    const navId = button.dataset.nav as ViewId | undefined;
    if (navId) {
      ui = { view: navId, phoneTab: ui.phoneTab, popupTarget: undefined, result: ui.result };
      menuPanel = null;
      render();
      return;
    }

    if (button.dataset.mapReturnHome !== undefined) {
      ui = { view: 'home', phoneTab: ui.phoneTab, popupTarget: undefined, result: ui.result };
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
      options.persistPreferences(preferences);
      render();
      return;
    }

    if (button.dataset.closePopup !== undefined) {
      ui.popupTarget = undefined;
      menuPanel = null;
      render();
      return;
    }
    if (button.dataset.openItem) {
      ui.popupTarget = { kind: 'item', id: button.dataset.openItem };
      render();
      return;
    }
    if (button.dataset.openContainer) {
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
