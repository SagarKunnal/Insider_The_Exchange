import { CONFIDENCE_FULL_N } from '../../data/tuning';

/**
 * Single source of truth for confidence calculation (architecture.md §5.3, rule.md §2.7).
 */
export function computeConfidence(maxP: number, n: number): number {
  if (!Number.isFinite(maxP) || !Number.isFinite(n) || n <= 0) {
    return 0;
  }
  const raw = maxP * Math.min(1, n / CONFIDENCE_FULL_N);
  return Math.max(0, Math.min(1, raw));
}
