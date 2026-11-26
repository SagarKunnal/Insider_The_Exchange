import {
  AMBUSH_MIN_N,
  CONTEXT_DECAY_FACTOR,
  LAPLACE_ALPHA,
  PANIC_MIN_THREAT_DECISIONS,
  RECALIBRATE_SOFTEN_FACTOR,
  WARM_START_DECISIONS,
  WARM_START_WEIGHT,
} from '../../data/tuning';
import type { DecisionEvent, RelativeTurn } from '../core/types';
import { computeConfidence } from './confidence';

const REL_TURNS: readonly RelativeTurn[] = ['L', 'R', 'S', 'U'];

export interface PanicTurnPrediction {
  biasedTurn: RelativeTurn;
  p: number;
  rawN: number;
  confidence: number;
}

export interface EscapeCorridorStat {
  corridorId: string;
  rawCount: number;
  weightedCount: number;
  p: number;
  confidence: number;
  lastUsedT: number;
}

export class PanicModel {
  private turnCounts: Record<RelativeTurn, number> = { L: 0, R: 0, S: 0, U: 0 };
  private turnWeightedN = 0;
  private turnRawN = 0;

  private readonly escapeByCorridor = new Map<string, { weight: number; raw: number; lastT: number }>();
  private readonly escapeByJunction = new Map<
    number,
    { totalWeight: number; corridors: Map<string, { weight: number; raw: number; lastT: number }> }
  >();
  private escapeWeightedTotal = 0;
  private globalThreatDecisions = 0;

  observeThreatDecision(event: DecisionEvent, totalGlobalDecisions: number): void {
    if (!event.threat) return;
    this.globalThreatDecisions += 1;
    const weight = totalGlobalDecisions <= WARM_START_DECISIONS ? WARM_START_WEIGHT : 1;

    // 1. Relative turn histogram with decay
    if (this.turnWeightedN > 0) {
      this.turnWeightedN *= CONTEXT_DECAY_FACTOR;
      for (const rt of REL_TURNS) {
        this.turnCounts[rt] *= CONTEXT_DECAY_FACTOR;
      }
    }
    this.turnCounts[event.relTurn] += weight;
    this.turnWeightedN += weight;
    this.turnRawN += 1;

    // 2. Global escape corridor histogram (for Panic trail strength & Autopsy favoriteEscape)
    if (this.escapeWeightedTotal > 0) {
      this.escapeWeightedTotal *= CONTEXT_DECAY_FACTOR;
      for (const entry of this.escapeByCorridor.values()) {
        entry.weight *= CONTEXT_DECAY_FACTOR;
      }
    }
    const prev = this.escapeByCorridor.get(event.corridorId) ?? { weight: 0, raw: 0, lastT: event.t };
    prev.weight += weight;
    prev.raw += 1;
    prev.lastT = event.t;
    this.escapeByCorridor.set(event.corridorId, prev);
    this.escapeWeightedTotal += weight;

    // 3. Per-junction escape corridor histogram (architecture.md §5.3)
    if (event.corridorId) {
      let jEntry = this.escapeByJunction.get(event.junctionId);
      if (!jEntry) {
        jEntry = { totalWeight: 0, corridors: new Map() };
        this.escapeByJunction.set(event.junctionId, jEntry);
      } else {
        jEntry.totalWeight *= CONTEXT_DECAY_FACTOR;
        for (const c of jEntry.corridors.values()) {
          c.weight *= CONTEXT_DECAY_FACTOR;
        }
      }
      const jc = jEntry.corridors.get(event.corridorId) ?? { weight: 0, raw: 0, lastT: event.t };
      jc.weight += weight;
      jc.raw += 1;
      jc.lastT = event.t;
      jEntry.corridors.set(event.corridorId, jc);
      jEntry.totalWeight += weight;
    }
  }

  predictPanicTurn(): PanicTurnPrediction {
    if (this.turnRawN === 0 || this.turnWeightedN <= 0) {
      return { biasedTurn: 'L', p: 0.25, rawN: 0, confidence: 0 };
    }
    const denom = this.turnWeightedN + LAPLACE_ALPHA * REL_TURNS.length;
    let bestTurn: RelativeTurn = 'L';
    let bestP = -1;

    for (const rt of REL_TURNS) {
      const p = (this.turnCounts[rt] + LAPLACE_ALPHA) / denom;
      if (p > bestP) {
        bestP = p;
        bestTurn = rt;
      }
    }

    const safeP = Number.isFinite(bestP) ? bestP : 0.25;
    // Compute raw share for human-readable Autopsy reporting as well
    const confidence =
      this.turnRawN >= PANIC_MIN_THREAT_DECISIONS
        ? computeConfidence(safeP, this.turnWeightedN)
        : computeConfidence(safeP, this.turnRawN) * 0.7;

    return {
      biasedTurn: bestTurn,
      p: safeP,
      rawN: this.turnRawN,
      confidence,
    };
  }

  getRawTurnShare(turn: RelativeTurn): number {
    if (this.turnRawN === 0) return 0;
    // Use unweighted proportion approximated from decayed or exact counts; keep exact raw tracker:
    return this.turnCounts[turn] / Math.max(1e-6, this.turnWeightedN);
  }

  getEscapeCandidates(): EscapeCorridorStat[] {
    const byCorridorBest = new Map<string, EscapeCorridorStat>();

    for (const jEntry of this.escapeByJunction.values()) {
      const k = Math.max(2, jEntry.corridors.size + 1);
      const denom = jEntry.totalWeight + LAPLACE_ALPHA * k;
      for (const [corridorId, entry] of jEntry.corridors.entries()) {
        const p = denom > 0 ? (entry.weight + LAPLACE_ALPHA) / denom : 0;
        const confidence =
          entry.raw >= AMBUSH_MIN_N
            ? computeConfidence(p, entry.weight)
            : computeConfidence(p, entry.raw) * 0.5;
        const candidate: EscapeCorridorStat = {
          corridorId,
          rawCount: entry.raw,
          weightedCount: entry.weight,
          p,
          confidence,
          lastUsedT: entry.lastT,
        };
        const existing = byCorridorBest.get(corridorId);
        if (!existing || candidate.confidence > existing.confidence) {
          byCorridorBest.set(corridorId, candidate);
        }
      }
    }

    return Array.from(byCorridorBest.values()).sort(
      (a, b) => b.confidence - a.confidence || b.rawCount - a.rawCount,
    );
  }

  getGlobalEscapeCounts(): EscapeCorridorStat[] {
    const k = Math.max(2, this.escapeByCorridor.size);
    const denom = this.escapeWeightedTotal + LAPLACE_ALPHA * k;
    const list: EscapeCorridorStat[] = [];
    for (const [corridorId, entry] of this.escapeByCorridor.entries()) {
      const p = denom > 0 ? (entry.weight + LAPLACE_ALPHA) / denom : 0;
      list.push({
        corridorId,
        rawCount: entry.raw,
        weightedCount: entry.weight,
        p,
        confidence: computeConfidence(p, entry.weight),
        lastUsedT: entry.lastT,
      });
    }
    return list.sort((a, b) => b.rawCount - a.rawCount || b.confidence - a.confidence);
  }

  getCorridorStrengths(nowS: number): Map<string, number> {
    const map = new Map<string, number>();
    let maxVal = 0;
    for (const [cid, entry] of this.escapeByCorridor.entries()) {
      const ageDecay = Math.max(0.15, Math.exp(-Math.max(0, nowS - entry.lastT) / 90));
      const v = entry.weight * ageDecay;
      map.set(cid, v);
      if (v > maxVal) maxVal = v;
    }
    if (maxVal > 0) {
      for (const [cid, v] of map.entries()) {
        map.set(cid, Math.min(1, v / Math.max(3, maxVal)));
      }
    }
    return map;
  }

  softenPanic(): void {
    this.turnWeightedN *= RECALIBRATE_SOFTEN_FACTOR;
    for (const rt of REL_TURNS) {
      this.turnCounts[rt] *= RECALIBRATE_SOFTEN_FACTOR;
    }
  }

  getThreatDecisionCount(): number {
    return this.globalThreatDecisions;
  }
}
