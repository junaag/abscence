import { createBrowserPersistence } from './app/storage';
import { mountApp } from './ui/render';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root');

const persistence = createBrowserPersistence(window.localStorage);
mountApp(root, persistence.load(), {
  persist: (state) => persistence.save(state),
  preferences: persistence.loadPreferences(),
  persistPreferences: (preferences) => persistence.savePreferences(preferences),
  mapState: persistence.loadMapState(),
  persistMapState: (mapState) => persistence.saveMapState(mapState),
});
