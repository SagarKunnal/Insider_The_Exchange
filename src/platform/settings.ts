import type { Settings } from '../game/core/types';
import { STORAGE_KEYS, isStorageHealthy, readStorageJson, writeStorageJson } from './storage';

export function getDefaultSettings(): Settings {
  const prefersReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    sound: true,
    volume: 0.7,
    trails: {
      route: true,
      timing: true,
      panic: true,
    },
    reducedMotion: prefersReduced,
    colorblind: false,
  };
}

export function loadSettings(): { settings: Settings; storageOk: boolean } {
  const defaults = getDefaultSettings();
  const { value, ok } = readStorageJson<Partial<Settings>>(STORAGE_KEYS.settings, defaults);
  const merged: Settings = {
    sound: typeof value.sound === 'boolean' ? value.sound : defaults.sound,
    volume: typeof value.volume === 'number' && Number.isFinite(value.volume)
      ? Math.max(0, Math.min(1, value.volume))
      : defaults.volume,
    trails: {
      route: typeof value.trails?.route === 'boolean' ? value.trails.route : defaults.trails.route,
      timing: typeof value.trails?.timing === 'boolean' ? value.trails.timing : defaults.trails.timing,
      panic: typeof value.trails?.panic === 'boolean' ? value.trails.panic : defaults.trails.panic,
    },
    reducedMotion:
      typeof value.reducedMotion === 'boolean' ? value.reducedMotion : defaults.reducedMotion,
    colorblind: typeof value.colorblind === 'boolean' ? value.colorblind : defaults.colorblind,
  };
  return { settings: merged, storageOk: ok && isStorageHealthy() };
}

export function saveSettings(settings: Settings): boolean {
  return writeStorageJson(STORAGE_KEYS.settings, settings);
}

export function applySettingsToDocument(settings: Settings): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  document.body.classList.toggle('colorblind-mode', settings.colorblind);
}

export function hasSeenBriefing(): boolean {
  return readStorageJson<boolean>(STORAGE_KEYS.briefingSeen, false).value;
}

export function markBriefingSeen(): void {
  writeStorageJson(STORAGE_KEYS.briefingSeen, true);
}
