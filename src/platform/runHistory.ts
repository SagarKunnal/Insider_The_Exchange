import { MAX_RUN_HISTORY, MAX_STORED_CLIP_RUNS } from '../data/tuning';
import type { ReplayClip, RunSummary } from '../game/core/types';
import {
  STORAGE_KEYS,
  getClipStorageKey,
  readStorageJson,
  removeStorageKey,
  writeStorageJson,
} from './storage';

export function loadRunHistory(): RunSummary[] {
  const { value } = readStorageJson<RunSummary[]>(STORAGE_KEYS.runs, []);
  return Array.isArray(value) ? value : [];
}

export function saveRunSummary(summary: RunSummary, clips: ReplayClip[]): RunSummary[] {
  const existing = loadRunHistory().filter((r) => r.runId !== summary.runId);
  const updated = [summary, ...existing].slice(0, MAX_RUN_HISTORY);
  writeStorageJson(STORAGE_KEYS.runs, updated);

  if (clips.length > 0) {
    writeStorageJson(getClipStorageKey(summary.runId), clips);
  }
  // Prune clips older than MAX_STORED_CLIP_RUNS
  for (let i = MAX_STORED_CLIP_RUNS; i < updated.length; i += 1) {
    removeStorageKey(getClipStorageKey(updated[i].runId));
  }
  return updated;
}

export function loadRunClips(runId: string): ReplayClip[] {
  const { value } = readStorageJson<ReplayClip[]>(getClipStorageKey(runId), []);
  return Array.isArray(value) ? value : [];
}
