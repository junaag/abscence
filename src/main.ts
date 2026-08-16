import { createBrowserPersistence } from './app/storage';
import { mountApp } from './ui/render';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root');

const persistence = createBrowserPersistence(window.localStorage);
const initialState = persistence.load();
const preferences = persistence.loadPreferences();
const mapState = persistence.loadMapState();

mountApp(root, initialState, {
  persist: (state) => persistence.save(state),
  preferences,
  persistPreferences: (nextPreferences) => persistence.savePreferences(nextPreferences),
  mapState,
  persistMapState: (nextMapState) => persistence.saveMapState(nextMapState),
  initialPersistenceWarning: persistence.hasStorageFailure(),
});
