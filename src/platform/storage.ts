import { getSession } from './session';

export const STORAGE_KEYS = {
  settings: 'hby:v1:settings',
  runs: 'hby:v1:runs',
  clipsPrefix: 'hby:v1:clips:',
  briefingSeen: 'hby:v1:briefing-seen',
} as const;

const memoryFallback = new Map<string, string>();
let storageHealthy = true;

function getStorageBackend(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const probeKey = '__hby_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    storageHealthy = false;
    return null;
  }
}

export function isStorageHealthy(): boolean {
  return storageHealthy && getStorageBackend() !== null;
}

export function getClipStorageKey(runId: string): string {
  return `${STORAGE_KEYS.clipsPrefix}${runId}`;
}

export function getScopedKey(baseKey: string): string {
  // User-scoping hook anchored to getSession() for future auth migration.
  const session = getSession();
  return session.userId === 'guest-local' ? baseKey : `${session.userId}:${baseKey}`;
}

export function readStorageJson<T>(key: string, fallback: T): { value: T; ok: boolean } {
  const scopedKey = getScopedKey(key);
  const backend = getStorageBackend();
  let raw: string | null = null;

  if (backend) {
    try {
      raw = backend.getItem(scopedKey);
    } catch {
      storageHealthy = false;
      raw = memoryFallback.get(scopedKey) ?? null;
    }
  } else {
    storageHealthy = false;
    raw = memoryFallback.get(scopedKey) ?? null;
  }

  if (raw === null) {
    return { value: fallback, ok: storageHealthy };
  }

  try {
    return { value: JSON.parse(raw) as T, ok: true };
  } catch {
    return { value: fallback, ok: false };
  }
}

export function writeStorageJson<T>(key: string, value: T): boolean {
  const scopedKey = getScopedKey(key);
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return false;
  }

  memoryFallback.set(scopedKey, serialized);
  const backend = getStorageBackend();
  if (!backend) {
    storageHealthy = false;
    return false;
  }

  try {
    backend.setItem(scopedKey, serialized);
    storageHealthy = true;
    return true;
  } catch {
    storageHealthy = false;
    return false;
  }
}

export function removeStorageKey(key: string): void {
  const scopedKey = getScopedKey(key);
  memoryFallback.delete(scopedKey);
  const backend = getStorageBackend();
  if (!backend) return;
  try {
    backend.removeItem(scopedKey);
  } catch {
    storageHealthy = false;
  }
}

export function resetMemoryStorageForTest(): void {
  memoryFallback.clear();
  storageHealthy = true;
}
