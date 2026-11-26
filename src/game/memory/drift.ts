import {
  DRIFT_MIN_MISSES,
  DRIFT_MIN_PRIOR_ACC,
  DRIFT_RECENT_WINDOW,
  RECALIBRATE_COOLDOWN_S,
  ROLLING_ACCURACY_WINDOW,
} from '../../data/tuning';

export interface DriftTracker {
  rollingWindow: boolean[];
  lastContextKey: string;
}

export function createDriftTracker(): DriftTracker {
  return {
    rollingWindow: [],
    lastContextKey: '',
  };
}

/**
 * Records a confident prediction outcome and evaluates C-08 Drift Trigger:
 * >= 3 of last 4 confident predictions missed AND prior rolling accuracy >= 50%.
 */
export function recordPredictionAndCheckDrift(
  tracker: DriftTracker,
  hit: boolean,
  contextKey: string,
  nowS: number,
  cooldownUntilS: number,
): { shouldRecalibrate: boolean; contextKey: string } {
  const priorWindow = tracker.rollingWindow;
  const priorAcc =
    priorWindow.length >= DRIFT_RECENT_WINDOW
      ? priorWindow.filter(Boolean).length / priorWindow.length
      : 0;

  tracker.rollingWindow.push(hit);
  if (tracker.rollingWindow.length > ROLLING_ACCURACY_WINDOW) {
    tracker.rollingWindow.shift();
  }
  tracker.lastContextKey = contextKey;

  if (nowS < cooldownUntilS) {
    return { shouldRecalibrate: false, contextKey };
  }

  if (tracker.rollingWindow.length < DRIFT_RECENT_WINDOW) {
    return { shouldRecalibrate: false, contextKey };
  }

  const recent4 = tracker.rollingWindow.slice(-DRIFT_RECENT_WINDOW);
  const misses = recent4.filter((ok) => !ok).length;

  if (misses >= DRIFT_MIN_MISSES && priorAcc >= DRIFT_MIN_PRIOR_ACC) {
    return { shouldRecalibrate: true, contextKey };
  }
  return { shouldRecalibrate: false, contextKey };
}

export function nextRecalibrateCooldown(nowS: number): number {
  return nowS + RECALIBRATE_COOLDOWN_S;
}
