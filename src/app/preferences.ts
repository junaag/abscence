export const UI_PREFERENCES_KEY = 'absence-v020-ui-preferences';

export interface UiPreferences {
  soundEnabled: boolean;
}

export interface PreferenceReadStorage {
  getItem(key: string): string | null;
}

export interface PreferenceWriteStorage {
  setItem(key: string, value: string): void;
}

export function createDefaultUiPreferences(): UiPreferences {
  return { soundEnabled: true };
}

export function loadUiPreferences(storage: PreferenceReadStorage): UiPreferences {
  const fallback = createDefaultUiPreferences();
  try {
    const raw = storage.getItem(UI_PREFERENCES_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const candidate = parsed as Partial<UiPreferences>;
    return { soundEnabled: typeof candidate.soundEnabled === 'boolean' ? candidate.soundEnabled : fallback.soundEnabled };
  } catch {
    return fallback;
  }
}

export function saveUiPreferences(preferences: UiPreferences, storage: PreferenceWriteStorage): void {
  storage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ soundEnabled: Boolean(preferences.soundEnabled) }));
}
