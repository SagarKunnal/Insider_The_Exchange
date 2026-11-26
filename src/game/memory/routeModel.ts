import {
  CONTEXT_DECAY_FACTOR,
  LAPLACE_ALPHA,
  RECALIBRATE_SOFTEN_FACTOR,
  ROUTE_MIN_OBSERVATIONS,
  WARM_START_DECISIONS,
  WARM_START_WEIGHT,
} from '../../data/tuning';
import type { MazeGraph } from '../core/graph';
import type { DecisionEvent, Direction, JunctionStat } from '../core/types';
import { computeConfidence } from './confidence';

export interface RoutePrediction {
  contextKey: string;
  predictedExit: Direction;
  p: number;
  n: number;
  rawN: number;
  confidence: number;
  probabilities: Partial<Record<Direction, number>>;
  source: 'context' | 'pooled' | 'uniform';
}

export interface DetectedLoop {
  junctionIds: number[];
  repeats: number;
  nextJunctionId: number | null;
}

export class RouteModel {
  private readonly contextCounts = new Map<string, { counts: Partial<Record<Direction, number>>; n: number; rawN: number; lastT: number }>();
  private readonly junctionStats = new Map<number, JunctionStat>();
  private readonly recentJunctionTrail: number[] = [];
  private readonly loopCounts = new Map<string, number>();
  private globalDecisions = 0;

  static makeContextKey(junctionId: number, entryDir: Direction): string {
    return `${junctionId}:${entryDir}`;
  }

  observe(event: DecisionEvent, graph: MazeGraph): void {
    this.globalDecisions += 1;
    const weight = this.globalDecisions <= WARM_START_DECISIONS ? WARM_START_WEIGHT : 1;

    const j = graph.getJunctionById(event.junctionId);
    if (!j) return;

    // 1. Update exact (junctionId, entryDir) context with decay before adding observation
    const key = RouteModel.makeContextKey(event.junctionId, event.entryDir);
    let ctx = this.contextCounts.get(key);
    if (!ctx) {
      ctx = { counts: {}, n: 0, rawN: 0, lastT: event.t };
      this.contextCounts.set(key, ctx);
    } else {
      ctx.n *= CONTEXT_DECAY_FACTOR;
      for (const d of Object.keys(ctx.counts) as Direction[]) {
        ctx.counts[d] = (ctx.counts[d] ?? 0) * CONTEXT_DECAY_FACTOR;
      }
    }
    ctx.counts[event.exitDir] = (ctx.counts[event.exitDir] ?? 0) + weight;
    ctx.n += weight;
    ctx.rawN += 1;
    ctx.lastT = event.t;

    // 2. Update pooled junction stat
    let js = this.junctionStats.get(event.junctionId);
    if (!js) {
      js = {
        junctionId: event.junctionId,
        counts: {},
        n: 0,
        rawN: 0,
        dwellMeanMs: 0,
        dwellN: 0,
        longDwellCount: 0,
      };
      this.junctionStats.set(event.junctionId, js);
    } else {
      js.n *= CONTEXT_DECAY_FACTOR;
      for (const ed of Object.keys(js.counts) as Direction[]) {
        const sub = js.counts[ed];
        if (!sub) continue;
        for (const xd of Object.keys(sub) as Direction[]) {
          sub[xd] = (sub[xd] ?? 0) * CONTEXT_DECAY_FACTOR;
        }
      }
    }
    if (!js.counts[event.entryDir]) {
      js.counts[event.entryDir] = {};
    }
    const sub = js.counts[event.entryDir]!;
    sub[event.exitDir] = (sub[event.exitDir] ?? 0) + weight;
    js.n += weight;
    js.rawN += 1;

    // 3. Track loop repetition
    this.recentJunctionTrail.push(event.junctionId);
    if (this.recentJunctionTrail.length > 24) {
      this.recentJunctionTrail.shift();
    }
    this.detectAndCountLoops();
  }

  private detectAndCountLoops(): void {
    const trail = this.recentJunctionTrail;
    for (let len = 3; len <= 8; len += 1) {
      if (trail.length < len * 2) continue;
      const tailA = trail.slice(trail.length - len);
      const tailB = trail.slice(trail.length - len * 2, trail.length - len);
      if (tailA.every((v, idx) => v === tailB[idx])) {
        const sig = tailA.join('-');
        this.loopCounts.set(sig, (this.loopCounts.get(sig) ?? 1) + 1);
        break;
      }
    }
  }

  getDetectedLoop(): DetectedLoop | null {
    let bestSig: string | null = null;
    let bestRepeats = 0;
    for (const [sig, repeats] of this.loopCounts.entries()) {
      if (repeats > bestRepeats) {
        bestRepeats = repeats;
        bestSig = sig;
      }
    }
    if (!bestSig || bestRepeats < 2) return null;
    const junctionIds = bestSig.split('-').map((s) => Number(s));
    const currentLast = this.recentJunctionTrail[this.recentJunctionTrail.length - 1];
    const idx = junctionIds.indexOf(currentLast);
    const nextJunctionId =
      idx >= 0 ? junctionIds[(idx + 1) % junctionIds.length] : junctionIds[0];
    return { junctionIds, repeats: bestRepeats, nextJunctionId };
  }

  predict(junctionId: number, entryDir: Direction, graph: MazeGraph): RoutePrediction {
    const j = graph.getJunctionById(junctionId);
    const exits = j?.exits ?? [];
    const contextKey = RouteModel.makeContextKey(junctionId, entryDir);

    if (exits.length === 0) {
      return {
        contextKey,
        predictedExit: entryDir,
        p: 0,
        n: 0,
        rawN: 0,
        confidence: 0,
        probabilities: {},
        source: 'uniform',
      };
    }

    const ctx = this.contextCounts.get(contextKey);
    if (ctx && ctx.n > 0) {
      return this.buildDistribution(contextKey, exits, ctx.counts, ctx.n, ctx.rawN, 'context');
    }

    // Fallback to pooled junction counts across all entryDirs
    const js = this.junctionStats.get(junctionId);
    if (js && js.n > 0) {
      const pooled: Partial<Record<Direction, number>> = {};
      for (const ed of Object.keys(js.counts) as Direction[]) {
        const sub = js.counts[ed];
        if (!sub) continue;
        for (const xd of Object.keys(sub) as Direction[]) {
          pooled[xd] = (pooled[xd] ?? 0) + (sub[xd] ?? 0);
        }
      }
      return this.buildDistribution(contextKey, exits, pooled, js.n, js.rawN, 'pooled');
    }

    // Uniform fallback (n = 0)
    const uniformP = 1 / exits.length;
    const probabilities: Partial<Record<Direction, number>> = {};
    for (const d of exits) probabilities[d] = uniformP;
    return {
      contextKey,
      predictedExit: exits[0],
      p: uniformP,
      n: 0,
      rawN: 0,
      confidence: 0,
      probabilities,
      source: 'uniform',
    };
  }

  private buildDistribution(
    contextKey: string,
    exits: Direction[],
    counts: Partial<Record<Direction, number>>,
    n: number,
    rawN: number,
    source: 'context' | 'pooled',
  ): RoutePrediction {
    const k = exits.length;
    const denom = n + LAPLACE_ALPHA * k;
    const probabilities: Partial<Record<Direction, number>> = {};
    let bestDir = exits[0];
    let bestP = -1;

    for (const d of exits) {
      const c = counts[d] ?? 0;
      const p = denom > 0 && Number.isFinite(denom) ? (c + LAPLACE_ALPHA) / denom : 1 / k;
      probabilities[d] = p;
      if (p > bestP) {
        bestP = p;
        bestDir = d;
      }
    }

    const safeP = Number.isFinite(bestP) ? bestP : 1 / k;
    return {
      contextKey,
      predictedExit: bestDir,
      p: safeP,
      n,
      rawN,
      confidence: computeConfidence(safeP, n),
      probabilities,
      source,
    };
  }

  /**
   * Checks whether route prediction meets both confidence and observation threshold (C-04a).
   */
  hasStrongContextPrediction(junctionId: number, entryDir: Direction, graph: MazeGraph): RoutePrediction | null {
    const pred = this.predict(junctionId, entryDir, graph);
    if (pred.n >= ROUTE_MIN_OBSERVATIONS && pred.confidence >= 0.45) {
      return pred;
    }
    return null;
  }

  softenContext(contextKey: string): void {
    const ctx = this.contextCounts.get(contextKey);
    if (!ctx) return;
    ctx.n *= RECALIBRATE_SOFTEN_FACTOR;
    for (const d of Object.keys(ctx.counts) as Direction[]) {
      ctx.counts[d] = (ctx.counts[d] ?? 0) * RECALIBRATE_SOFTEN_FACTOR;
    }
  }

  getCorridorStrengths(graph: MazeGraph, nowS: number): Map<string, number> {
    const strengths = new Map<string, number>();
    let maxVal = 0;
    for (const [key, ctx] of this.contextCounts.entries()) {
      const [jStr] = key.split(':');
      const j = graph.getJunctionById(Number(jStr));
      if (!j) continue;
      const ageDecay = Math.max(0.15, Math.exp(-Math.max(0, nowS - ctx.lastT) / 90));
      for (const exitDir of Object.keys(ctx.counts) as Direction[]) {
        const cid = j.corridorByDir[exitDir];
        if (!cid) continue;
        const val = (ctx.counts[exitDir] ?? 0) * ageDecay;
        const next = (strengths.get(cid) ?? 0) + val;
        strengths.set(cid, next);
        if (next > maxVal) maxVal = next;
      }
    }
    if (maxVal > 0) {
      for (const [cid, v] of strengths.entries()) {
        strengths.set(cid, Math.min(1, v / Math.max(4, maxVal)));
      }
    }
    return strengths;
  }

  getJunctionStats(): JunctionStat[] {
    return Array.from(this.junctionStats.values());
  }

  getContextCount(): number {
    return this.contextCounts.size;
  }
}
