import phrasesJson from '../data/phrases.json';
import {
  AUTOPSY_MIN_DURATION_S,
  PANIC_AUTOPSY_MIN_DECISIONS,
  PANIC_BIAS_THRESHOLD,
} from '../data/tuning';
import type {
  AutopsyReport,
  AutopsyStatement,
  DecisionEvent,
  EntropySample,
  GhostId,
  PredictionRecord,
  ReplayClip,
} from '../game/core/types';
import { formatTimeMMSS, turnToPhrase } from './phrases';
import type { MazeGraph } from '../game/core/graph';

export interface AutopsyInput {
  runId: string;
  round: number;
  score: number;
  durationS: number;
  decisions: DecisionEvent[];
  predictions: PredictionRecord[];
  patternBreaksCount: number;
  entropyTimeline: EntropySample[];
  peakMultiplier: number;
  knewBy: Partial<Record<GhostId, number>>;
  hotspots: Array<{ junctionId: number; corridorHint: string; meanDwellMs: number; count: number }>;
  favoriteLoop?: { description: string; repeats: number; junctionCount: number };
  favoriteRoute?: { corridorHint: string; exitCorridor: string; pct: number; rawN: number };
  topCorridor?: { nickname: string; visits: number };
  favoriteEscape?: { corridorId: string; nickname: string; count: number; pct: number };
  panicSummary: {
    threatCount: number;
    biasedTurn: 'L' | 'R' | 'S' | 'U';
    biasedPct: number;
  };
  clips: ReplayClip[];
}

/**
 * Pure function building a truthful, threshold-gated Habit Autopsy (C-09, rule.md §2.10).
 * Every displayed figure matches the recorded debug export verbatim.
 */
export function buildAutopsyReport(input: AutopsyInput): AutopsyReport {
  const sufficientData =
    input.durationS >= AUTOPSY_MIN_DURATION_S && input.decisions.length >= 8;

  const ghostHitRates: Record<GhostId, number> = {
    pinky: 0,
    inky: 0,
    blinky: 0,
  };

  let pooledHits = 0;
  let pooledTotal = 0;

  for (const id of ['pinky', 'inky', 'blinky'] as const) {
    const preds = input.predictions.filter((p) => p.ghostId === id && p.hit !== undefined);
    const hits = preds.filter((p) => p.hit).length;
    ghostHitRates[id] = preds.length > 0 ? Math.round((hits / preds.length) * 100) : 0;
    pooledHits += hits;
    pooledTotal += preds.length;
  }

  const predictabilityIndex = pooledTotal > 0 ? Math.round((pooledHits / pooledTotal) * 100) : 0;
  const meanEntropy =
    input.entropyTimeline.length > 0
      ? Math.round(
          input.entropyTimeline.reduce((s, e) => s + e.entropy, 0) / input.entropyTimeline.length,
        )
      : 50;

  const statements: AutopsyStatement[] = [];

  if (sufficientData) {
    // 1. Panic turn bias (>= 6 threat decisions and >= 55%)
    if (
      input.panicSummary.threatCount >= PANIC_AUTOPSY_MIN_DECISIONS &&
      input.panicSummary.biasedPct >= PANIC_BIAS_THRESHOLD * 100
    ) {
      const pct = Math.round(input.panicSummary.biasedPct);
      const text = phrasesJson.autopsy.panicTurn
        .replace('{turnPhrase}', turnToPhrase(input.panicSummary.biasedTurn))
        .replace('{pct}', String(pct));
      statements.push({
        id: 'panic-turn',
        ghostId: 'blinky',
        text,
        stat: `${pct}% across ${input.panicSummary.threatCount} threats`,
        knewByT: input.knewBy.blinky,
        confidenceOK: true,
        isQuote: true,
      });
    }

    // 2. Favorite escape corridor (>= 3 escapes)
    if (input.favoriteEscape && input.favoriteEscape.count >= 3) {
      const text = phrasesJson.autopsy.favoriteEscape
        .replace('{corridor}', input.favoriteEscape.nickname)
        .replace('{count}', String(input.favoriteEscape.count));
      statements.push({
        id: 'favorite-escape',
        ghostId: 'blinky',
        text,
        stat: `${input.favoriteEscape.count} escapes (${Math.round(input.favoriteEscape.pct)}%)`,
        knewByT: input.knewBy.blinky,
        confidenceOK: true,
        isQuote: true,
      });
    }

    // 3. Hesitation hotspot (>= 3 dwells >= 350ms)
    if (input.hotspots.length > 0 && input.hotspots[0].count >= 3) {
      const hs = input.hotspots[0];
      const text = phrasesJson.autopsy.hotspot
        .replace('{count}', String(hs.count))
        .replace('{corridor}', hs.corridorHint)
        .replace('{avgMs}', String(Math.round(hs.meanDwellMs)));
      statements.push({
        id: 'hesitation-hotspot',
        ghostId: 'inky',
        text,
        stat: `${Math.round(hs.meanDwellMs)} ms avg`,
        knewByT: input.knewBy.inky,
        confidenceOK: true,
        isQuote: true,
      });
    }

    // 4. Favorite loop (>= 2 repeats)
    if (input.favoriteLoop && input.favoriteLoop.repeats >= 2) {
      const text = phrasesJson.autopsy.favoriteLoop
        .replace('{len}', String(input.favoriteLoop.junctionCount))
        .replace('{repeats}', String(input.favoriteLoop.repeats));
      statements.push({
        id: 'favorite-loop',
        ghostId: 'pinky',
        text,
        stat: `${input.favoriteLoop.repeats}× repeated`,
        knewByT: input.knewBy.pinky,
        confidenceOK: true,
        isQuote: true,
      });
    } else if (input.favoriteRoute) {
      // 4b. Learned route turn habit (>= 3 visits to same crossing, >= 55% bias)
      statements.push({
        id: 'favorite-route',
        ghostId: 'pinky',
        text: `Approaching ${input.favoriteRoute.corridorHint}, you took ${input.favoriteRoute.exitCorridor} ${input.favoriteRoute.pct}% of the time.`,
        stat: `${input.favoriteRoute.pct}% across ${input.favoriteRoute.rawN} crossings`,
        knewByT: input.knewBy.pinky,
        confidenceOK: true,
        isQuote: true,
      });
    }

    // 5. Most-frequented corridor when overall run is sufficient (>= 4 visits)
    if (statements.length === 0 && input.topCorridor && input.topCorridor.visits >= 4) {
      statements.push({
        id: 'top-corridor',
        ghostId: 'pinky',
        text: `You returned to ${input.topCorridor.nickname} ${input.topCorridor.visits} times during the chase.`,
        stat: `${input.topCorridor.visits} visits`,
        knewByT: input.knewBy.pinky,
        confidenceOK: true,
        isQuote: true,
      });
    }
  }

  return {
    runId: input.runId,
    round: input.round,
    score: input.score,
    durationS: input.durationS,
    sufficientData,
    statements,
    knewBy: input.knewBy,
    ghostHitRates,
    predictabilityIndex,
    meanEntropy,
    peakMultiplier: Number(input.peakMultiplier.toFixed(1)),
    patternBreaks: input.patternBreaksCount,
    entropyTimeline: input.entropyTimeline,
    hotspots: input.hotspots,
    favoriteLoop: input.favoriteLoop,
    favoriteEscape: input.favoriteEscape,
    clips: input.clips,
  };
}

export function buildAutopsyFromWorld(world: {
  runId: string;
  round: number;
  score: number;
  elapsedS: number;
  graph: MazeGraph;
  ghosts: Record<GhostId, { state: { knewAtT?: number } }>;
  recorder: {
    decisions: DecisionEvent[];
    predictions: PredictionRecord[];
    patternBreaks: Array<unknown>;
    corridorStats?: Map<string, { corridorId: string; visits: number }>;
    entropy: { getTimeline: () => EntropySample[]; getPeakMultiplier: () => number };
    timingModel: { getHotspots: () => Array<{ junctionId: number; dwellMeanMs: number; longDwellCount: number }> };
    routeModel: {
      getDetectedLoop: () => { junctionIds: number[]; repeats: number } | null;
      getTopJunctionHabit?: (graph: MazeGraph) => {
        junctionId: number;
        corridorHint: string;
        relTurnPct: number;
        exitCorridor: string;
        rawN: number;
      } | null;
    };
    panicModel: {
      getThreatDecisionCount: () => number;
      predictPanicTurn: () => { biasedTurn: 'L' | 'R' | 'S' | 'U' };
      getGlobalEscapeCounts: () => Array<{ corridorId: string; rawCount: number }>;
    };
  };
  clipRecorder: { getClips: () => ReplayClip[] };
}): AutopsyReport {
  const threatDecisions = world.recorder.decisions.filter((d) => d.threat);
  const turnCounts: Record<'L' | 'R' | 'S' | 'U', number> = { L: 0, R: 0, S: 0, U: 0 };
  for (const d of threatDecisions) {
    turnCounts[d.relTurn] += 1;
  }
  let biasedTurn: 'L' | 'R' | 'S' | 'U' = 'L';
  let maxTurnCount = -1;
  for (const t of ['L', 'R', 'S', 'U'] as const) {
    if (turnCounts[t] > maxTurnCount) {
      maxTurnCount = turnCounts[t];
      biasedTurn = t;
    }
  }
  const biasedPct = threatDecisions.length > 0 ? (maxTurnCount / threatDecisions.length) * 100 : 0;

  const escList = world.recorder.panicModel.getGlobalEscapeCounts();
  const totalEsc = escList.reduce((s, e) => s + e.rawCount, 0);
  const topEsc = escList[0];
  const favoriteEscape = topEsc
    ? {
        corridorId: topEsc.corridorId,
        nickname: world.graph.getCorridorById(topEsc.corridorId)?.nickname ?? topEsc.corridorId,
        count: topEsc.rawCount,
        pct: totalEsc > 0 ? (topEsc.rawCount / totalEsc) * 100 : 0,
      }
    : undefined;

  const hotspots = world.recorder.timingModel.getHotspots().map((h) => {
    const j = world.graph.getJunctionById(h.junctionId);
    const firstCid = j && j.exits[0] ? j.corridorByDir[j.exits[0]] : undefined;
    const hint = firstCid ? world.graph.getCorridorById(firstCid)?.nickname ?? `J${h.junctionId}` : `J${h.junctionId}`;
    return {
      junctionId: h.junctionId,
      corridorHint: hint,
      meanDwellMs: h.dwellMeanMs,
      count: h.longDwellCount,
    };
  });

  const loop = world.recorder.routeModel.getDetectedLoop();
  const favoriteLoop = loop
    ? {
        description: `${loop.junctionIds.length}-junction loop`,
        repeats: loop.repeats,
        junctionCount: loop.junctionIds.length,
      }
    : undefined;

  const routeHabit = world.recorder.routeModel.getTopJunctionHabit
    ? world.recorder.routeModel.getTopJunctionHabit(world.graph)
    : null;
  const favoriteRoute = routeHabit
    ? {
        corridorHint: routeHabit.corridorHint,
        exitCorridor: routeHabit.exitCorridor,
        pct: routeHabit.relTurnPct,
        rawN: routeHabit.rawN,
      }
    : undefined;

  let topCorridor: { nickname: string; visits: number } | undefined;
  if (world.recorder.corridorStats) {
    let bestVisits = 0;
    let bestId = '';
    for (const stat of world.recorder.corridorStats.values()) {
      if (stat.visits > bestVisits) {
        bestVisits = stat.visits;
        bestId = stat.corridorId;
      }
    }
    if (bestVisits > 0) {
      topCorridor = {
        nickname: world.graph.getCorridorById(bestId)?.nickname ?? bestId,
        visits: bestVisits,
      };
    }
  }

  return buildAutopsyReport({
    runId: world.runId,
    round: world.round,
    score: world.score,
    durationS: world.elapsedS,
    decisions: world.recorder.decisions,
    predictions: world.recorder.predictions,
    patternBreaksCount: world.recorder.patternBreaks.length,
    entropyTimeline: world.recorder.entropy.getTimeline(),
    peakMultiplier: world.recorder.entropy.getPeakMultiplier(),
    knewBy: {
      pinky: world.ghosts.pinky.state.knewAtT,
      inky: world.ghosts.inky.state.knewAtT,
      blinky: world.ghosts.blinky.state.knewAtT,
    },
    hotspots,
    favoriteLoop,
    favoriteRoute,
    topCorridor,
    favoriteEscape,
    panicSummary: {
      threatCount: threatDecisions.length,
      biasedTurn,
      biasedPct,
    },
    clips: world.clipRecorder.getClips(),
  });
}

export { formatTimeMMSS };
