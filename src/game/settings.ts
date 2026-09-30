/**
 * Persisted player preferences (settings + theme).
 *
 * Stored in localStorage as a per-browser convenience; every read/write is guarded because
 * storage can be unavailable (private mode) and the game must work without it.
 */
import type { GameSettings } from './types';

const KEY = 'typstiz.settings.v1';

export const DEFAULT_SETTINGS: GameSettings = {
  language: 'typst',
  mode: 'timed',
  difficulty: 'easy',
  durationSec: 60,
  previewOn: true,
  seed: '',
};

/** @returns stored settings merged over defaults (the seed is never restored) */
export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw), seed: '' };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** @param settings - settings to persist (seed excluded: a fixed seed is a per-run choice) */
export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...settings, seed: '' }));
  } catch {
    // Storage unavailable: settings simply won't persist.
  }
}
