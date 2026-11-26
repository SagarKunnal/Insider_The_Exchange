import {
  ENTROPY_DECISION_WINDOW,
  ENTROPY_EMA_ALPHA,
  ENTROPY_IMPULSE_DECAY_PER_S,
  ENTROPY_PRED_DEFAULT_ACC,
  ENTROPY_PRED_MIN_N,
  ENTROPY_PRED_WINDOW,
  PATTERN_BREAK_IMPULSE,
} from '../../data/tuning';
import type { MazeGraph } from '../core/graph';
import type { DecisionEvent, Direction, EntropySample } from '../core/types';

/**
 * Entropy & Score Multiplier Engine (C-07, architecture.md §5.3).
 * Single source of truth for unpredictability scoring.
 */
export class EntropyEngine {
  private readonly recentDecisions: DecisionEvent[] = [];
  private readonly recentPredHits: boolean[] = [];
  private emaEntropy = 50;
  private impulse = 0;
  private displayedEntropy = 50;
  private multiplier = 2.0;
  private peakMultiplier = 2.0;
  private lastSampleSec = -1;
  private readonly timeline: EntropySample[] = [];
  private pendingMarker: 'recalibrate' | 'pattern-break' | undefined;

  private lastHNorm = 0.5;
  private lastHitRateA = ENTROPY_PRED_DEFAULT_ACC;

  recordDecision(event: DecisionEvent, graph: MazeGraph): void {
    this.recentDecisions.push(event);
    if (this.recentDecisions.length > ENTROPY_DECISION_WINDOW) {
      this.recentDecisions.shift();
    }
    this.recompute(graph);
  }

  recordConfidentPredictionResult(hit: boolean, graph: MazeGraph): void {
    this.recentPredHits.push(hit);
    if (this.recentPredHits.length > ENTROPY_PRED_WINDOW) {
      this.recentPredHits.shift();
    }
    this.recompute(graph);
  }

  applyPatternBreakImpulse(): void {
    this.impulse = Math.min(20, this.impulse + PATTERN_BREAK_IMPULSE);
    this.pendingMarker = 'pattern-break';
    this.updateDisplayed();
  }

  markRecalibration(): void {
    this.pendingMarker = 'recalibrate';
  }

  step(dtS: number, elapsedS: number): void {
    if (this.impulse > 0) {
      this.impulse = Math.max(0, this.impulse - ENTROPY_IMPULSE_DECAY_PER_S * dtS);
      this.updateDisplayed();
    }

    const sec = Math.floor(elapsedS);
    if (sec > this.lastSampleSec) {
      this.lastSampleSec = sec;
      this.timeline.push({
        t: sec,
        entropy: Math.round(this.displayedEntropy),
        multiplier: Number(this.multiplier.toFixed(2)),
        eventMarker: this.pendingMarker,
      });
      this.pendingMarker = undefined;
    }
  }

  private recompute(graph: MazeGraph): void {
    // 1. Frequency-weighted mean of per-context Shannon entropy normalized by log2(available exits)
    const contextMap = new Map<string, { counts: Partial<Record<Direction, number>>; total: number; exitsCount: number }>();

    for (const d of this.recentDecisions) {
      const j = graph.getJunctionById(d.junctionId);
      const exitsCount = j ? Math.max(2, j.exits.length) : 3;
      const key = `${d.junctionId}:${d.entryDir}`;
      let entry = contextMap.get(key);
      if (!entry) {
        entry = { counts: {}, total: 0, exitsCount };
        contextMap.set(key, entry);
      }
      entry.counts[d.exitDir] = (entry.counts[d.exitDir] ?? 0) + 1;
      entry.total += 1;
    }

    let hNorm = 0.5;
    if (this.recentDecisions.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;

      for (const ctx of contextMap.values()) {
        let norm: number;
        if (ctx.total <= 1) {
          // A context visited only once in the window exhibits no repetition.
          norm = 1;
        } else {
          // Normalize by forward available exits with light smoothing to avoid small-sample 0-entropy bias.
          const effectiveExits = Math.max(2, ctx.exitsCount - 1);
          const maxH = Math.log2(effectiveExits);
          const smoothAlpha = ctx.total >= 4 ? 0.05 : 0.25;
          const denom = ctx.total + smoothAlpha * effectiveExits;
          const countsArr = Object.values(ctx.counts).filter((c): c is number => Boolean(c && c > 0));
          const zeroSlots = Math.max(0, effectiveExits - countsArr.length);
          let h = 0;
          for (const c of countsArr) {
            const p = (c + smoothAlpha) / denom;
            if (p > 0) h -= p * Math.log2(p);
          }
          if (zeroSlots > 0 && smoothAlpha > 0) {
            const pZero = smoothAlpha / denom;
            h -= zeroSlots * pZero * Math.log2(pZero);
          }
          norm = maxH > 0 ? Math.min(1, h / maxH) : 0;
        }
        weightedSum += norm * ctx.total;
        totalWeight += ctx.total;
      }

      hNorm = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    }

    // 2. Pooled hit rate A of confident predictions in last 10 (default 0.3 if < 3)
    let hitRateA = ENTROPY_PRED_DEFAULT_ACC;
    if (this.recentPredHits.length >= ENTROPY_PRED_MIN_N) {
      const hits = this.recentPredHits.filter(Boolean).length;
      hitRateA = hits / this.recentPredHits.length;
    }

    // 3. E_raw = 100 * (0.5 * H_norm + 0.5 * (1 - A))
    this.lastHNorm = hNorm;
    this.lastHitRateA = hitRateA;
    const eRaw = 100 * (0.5 * hNorm + 0.5 * (1 - hitRateA));
    const clampedRaw = Number.isFinite(eRaw) ? Math.max(0, Math.min(100, eRaw)) : 50;

    this.emaEntropy = (1 - ENTROPY_EMA_ALPHA) * this.emaEntropy + ENTROPY_EMA_ALPHA * clampedRaw;
    this.updateDisplayed();
  }

  private updateDisplayed(): void {
    const val = Math.max(0, Math.min(100, this.emaEntropy + this.impulse));
    this.displayedEntropy = Number.isFinite(val) ? val : 50;
    this.multiplier = Math.max(1.0, Math.min(3.0, 1 + this.displayedEntropy / 50));
    if (this.multiplier > this.peakMultiplier) {
      this.peakMultiplier = this.multiplier;
    }
  }

  getEntropy(): number {
    return this.displayedEntropy;
  }

  getMultiplier(): number {
    return this.multiplier;
  }

  getPeakMultiplier(): number {
    return this.peakMultiplier;
  }

  getTimeline(): EntropySample[] {
    return [...this.timeline];
  }

  getDiagnostics(): { hNorm: number; hitRateA: number; predCount: number; decCount: number } {
    return {
      hNorm: this.lastHNorm,
      hitRateA: this.lastHitRateA,
      predCount: this.recentPredHits.length,
      decCount: this.recentDecisions.length,
    };
  }
}
