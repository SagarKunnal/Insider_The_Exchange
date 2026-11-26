import {
  AUTOPSY_KNEW_BY_ACC,
  AUTOPSY_KNEW_BY_MIN_PRED,
  CALLOUT_COOLDOWN_S,
  CONFIDENCE_ACT_THRESHOLD,
  GHOST_AMBUSH_SPEED_CAP_TPS,
  GHOST_BASE_SPEED_TPS,
  INITIAL_LIVES,
  LANTERN_PELLET_POINTS,
  LANTERN_SLOW_DURATION_S,
  PATTERN_BREAK_BONUS_PER_ROUND,
  PATTERN_BREAK_COOLDOWN_S,
  PATTERN_BREAK_MIN_N,
  PATTERN_BREAK_MIN_P,
  PATTERN_BREAK_STUMBLE_S,
  PELLET_BASE_POINTS,
  PLAYER_SPEED_TPS,
  UI_SNAPSHOT_INTERVAL_S,
} from '../../data/tuning';
import { ClipRecorder } from '../../report/clipRecorder';
import { buildCauseOfCaptureLine, buildRecognitionMessage } from '../../report/phrases';
import { createInitialSnapshot } from '../../ui/store';
import { AmbushPlanner } from '../ai/ambushPlanner';
import { computeStage0Target } from '../ai/baselineBrain';
import { applyFairnessGovernor } from '../ai/fairnessGovernor';
import { evaluatePanicBrain } from '../ai/panicBrain';
import { RecalibrationManager } from '../ai/recalibration';
import { evaluateRouteBrain } from '../ai/routeBrain';
import { evaluateTimingBrain } from '../ai/timingBrain';
import { HabitRecorder } from '../memory/recorder';
import { RouteModel } from '../memory/routeModel';
import { isCaptureCollision, nearestTile } from './collisions';
import { EventBus } from './eventBus';
import { createAllGhosts, stepGhost, type GhostRuntime } from './ghost';
import { MazeGraph } from './graph';
import { buildMazeDef, tileKey } from './maze';
import {
  createPlayerState,
  queuePlayerTurn,
  resetPlayerOnRespawn,
  stepPlayer,
  type PlayerState,
} from './player';
import { SeededRng } from './rng';
import type { DecisionEvent, Direction, GhostId, HabitKind, HudSnapshot, MazeDef, TileCoord } from './types';

export interface WorldState {
  runId: string;
  seed: number;
  rng: SeededRng;
  maze: MazeDef;
  graph: MazeGraph;
  player: PlayerState;
  ghosts: Record<GhostId, GhostRuntime>;
  recorder: HabitRecorder;
  ambushPlanner: AmbushPlanner;
  recalibration: RecalibrationManager;
  clipRecorder: ClipRecorder;
  pellets: Set<string>;
  lanterns: Set<string>;
  pelletsTotal: number;
  score: number;
  lives: number;
  round: number;
  elapsedS: number;
  multiplier: number;
  entropy: number;
  lanternRemainingS: number;
  ended: boolean;
  endReason: 'lives' | 'manual' | null;
  paused: boolean;
  snapshotAccumS: number;
  governorMinOpenExits: number;
  patternBreakCooldownUntilS: number;
  lockedCategories: Set<string>;
}

export function createWorld(seed = 1337, runId = `run-${Date.now()}`): WorldState {
  const maze = buildMazeDef();
  const graph = new MazeGraph(maze);
  const pellets = new Set(maze.pelletTiles.map((t) => tileKey(t.x, t.y)));
  const lanterns = new Set(maze.lanternTiles.map((t) => tileKey(t.x, t.y)));

  return {
    runId,
    seed,
    rng: new SeededRng(seed),
    maze,
    graph,
    player: createPlayerState(maze.playerSpawn),
    ghosts: createAllGhosts(maze.ghostSpawns, 0),
    recorder: new HabitRecorder(),
    ambushPlanner: new AmbushPlanner(),
    recalibration: new RecalibrationManager(),
    clipRecorder: new ClipRecorder(),
    pellets,
    lanterns,
    pelletsTotal: pellets.size + lanterns.size,
    score: 0,
    lives: INITIAL_LIVES,
    round: 1,
    elapsedS: 0,
    multiplier: 1.0,
    entropy: 50,
    lanternRemainingS: 0,
    ended: false,
    endReason: null,
    paused: false,
    snapshotAccumS: 0,
    governorMinOpenExits: 4,
    patternBreakCooldownUntilS: 0,
    lockedCategories: new Set(),
  };
}

export function queueWorldInput(world: WorldState, dir: Direction): void {
  if (world.paused || world.ended) return;
  queuePlayerTurn(world.player, dir, world.elapsedS);
}

export function resetPositionsPreservingMemory(world: WorldState): void {
  resetPlayerOnRespawn(world.player, world.maze.playerSpawn, world.elapsedS);
  const freshGhosts = createAllGhosts(world.maze.ghostSpawns, world.elapsedS);
  for (const id of ['blinky', 'pinky', 'inky'] as const) {
    const oldState = world.ghosts[id].state;
    const f = freshGhosts[id];
    f.state.confidence = oldState.confidence;
    f.state.rollingHits = [...oldState.rollingHits];
    f.state.knewAtT = oldState.knewAtT;
    f.state.cooldowns = { ...oldState.cooldowns };
    world.ghosts[id] = f;
    world.ambushPlanner.releaseGhost(id, world.ghosts);
  }
}

export function resetPelletsForNextRound(world: WorldState): void {
  world.pellets = new Set(world.maze.pelletTiles.map((t) => tileKey(t.x, t.y)));
  world.lanterns = new Set(world.maze.lanternTiles.map((t) => tileKey(t.x, t.y)));
  resetPositionsPreservingMemory(world);
}

function maybeEmitRecognitionCallout(
  world: WorldState,
  ghostId: GhostId,
  category: HabitKind,
  isSpecificVariant: boolean,
  bus: EventBus,
): void {
  const key = `${ghostId}:${category}:${isSpecificVariant ? '1' : '0'}`;
  if (world.lockedCategories.has(key)) return;
  const g = world.ghosts[ghostId];
  if (world.elapsedS < g.state.cooldowns.calloutUntil) return;

  world.lockedCategories.add(key);
  g.state.cooldowns.calloutUntil = world.elapsedS + CALLOUT_COOLDOWN_S;
  world.recorder.pacing.recordFirstCallout(world.elapsedS);

  bus.emit('habit-locked', {
    t: world.elapsedS,
    ghostId,
    category,
    message: buildRecognitionMessage(ghostId, category, isSpecificVariant),
  });
}

function updateGhostRollingAccuracy(ghost: GhostRuntime, hit: boolean, nowS: number): void {
  ghost.state.rollingHits.push(hit);
  if (ghost.state.rollingHits.length > 8) {
    ghost.state.rollingHits.shift();
  }
  if (ghost.state.knewAtT === undefined && ghost.state.rollingHits.length >= AUTOPSY_KNEW_BY_MIN_PRED) {
    const acc = ghost.state.rollingHits.filter(Boolean).length / ghost.state.rollingHits.length;
    if (acc >= AUTOPSY_KNEW_BY_ACC) {
      ghost.state.knewAtT = nowS;
    }
  }
}

function handleDecisionAndFeedback(
  world: WorldState,
  decision: DecisionEvent,
  preRoutePred: ReturnType<RouteModel['predict']>,
  bus: EventBus,
): void {
  const cor = world.graph.getCorridorById(decision.corridorId);

  // 1. S-01 Pattern Break detection (before updating models on this decision)
  if (
    preRoutePred.source === 'context' &&
    preRoutePred.p >= PATTERN_BREAK_MIN_P &&
    preRoutePred.n >= PATTERN_BREAK_MIN_N &&
    decision.exitDir !== preRoutePred.predictedExit &&
    decision.relTurn !== 'U' &&
    decision.t >= world.patternBreakCooldownUntilS
  ) {
    world.patternBreakCooldownUntilS = decision.t + PATTERN_BREAK_COOLDOWN_S;
    const bonus = PATTERN_BREAK_BONUS_PER_ROUND * world.round;
    world.score += bonus;

    // Stumble all released ghosts for 0.9s
    for (const id of ['pinky', 'inky', 'blinky'] as const) {
      const g = world.ghosts[id];
      if (g.state.released && !g.inDen) {
        if (world.ambushPlanner.getReservations().has(id)) {
          world.ambushPlanner.releaseGhost(id, world.ghosts);
        }
        g.state.mode = 'stumble';
        g.state.stumbleUntilT = decision.t + PATTERN_BREAK_STUMBLE_S;
        g.state.predictionLine = 'Stumbled by your sudden break!';
      }
    }

    world.recorder.entropy.applyPatternBreakImpulse();
    const pbEvent = {
      t: decision.t,
      junctionId: decision.junctionId,
      predictedExit: preRoutePred.predictedExit,
      p: preRoutePred.p,
      chosenExit: decision.exitDir,
      bonus,
    };
    world.recorder.patternBreaks.push(pbEvent);
    bus.emit('pattern-break', pbEvent);
  }

  // 2. Sync Pinky prediction hit + Drift/Recalibration + Callout + Clip tagging
  const latestRoutePred = world.recorder.predictions[world.recorder.predictions.length - 1];
  if (latestRoutePred && latestRoutePred.t === decision.t && latestRoutePred.ghostId === 'pinky') {
    const hit = Boolean(latestRoutePred.hit);
    updateGhostRollingAccuracy(world.ghosts.pinky, hit, decision.t);
    world.clipRecorder.onPrediction(latestRoutePred);
    world.recalibration.evaluatePrediction(
      world.ghosts.pinky,
      hit,
      latestRoutePred.context,
      decision.t,
      world.ambushPlanner,
      world.ghosts,
      world.recorder,
      bus,
    );
  }

  const loop = world.recorder.routeModel.getDetectedLoop();
  if (loop && loop.repeats >= 2) {
    maybeEmitRecognitionCallout(world, 'pinky', 'route', true, bus);
  } else if (preRoutePred.confidence >= CONFIDENCE_ACT_THRESHOLD && preRoutePred.rawN >= 3) {
    maybeEmitRecognitionCallout(world, 'pinky', 'route', false, bus);
  }

  // 3. Evaluate Blinky panic prediction + Drift + Callout
  if (decision.threat) {
    const panicPred = world.recorder.panicModel.predictPanicTurn();
    if (panicPred.confidence >= CONFIDENCE_ACT_THRESHOLD && panicPred.rawN >= 5 && panicPred.p >= 0.55) {
      const hit = panicPred.biasedTurn === decision.relTurn;
      const rec = {
        t: decision.t,
        ghostId: 'blinky' as const,
        kind: 'panic' as const,
        context: `threat:${decision.junctionId}`,
        predicted: panicPred.biasedTurn,
        confidence: panicPred.confidence,
        actual: decision.relTurn,
        hit,
        consequential: true,
        junctionId: decision.junctionId,
        corridorNickname: cor?.nickname,
      };
      world.recorder.recordPrediction(rec, world.graph);
      world.clipRecorder.onPrediction(rec);
      updateGhostRollingAccuracy(world.ghosts.blinky, hit, decision.t);
      world.recalibration.evaluatePrediction(
        world.ghosts.blinky,
        hit,
        rec.context,
        decision.t,
        world.ambushPlanner,
        world.ghosts,
        world.recorder,
        bus,
      );
      maybeEmitRecognitionCallout(world, 'blinky', 'panic', false, bus);
    }
  }

  // 4. Evaluate Inky timing prediction at registered hotspots
  const inky = world.ghosts.inky;
  const hotspots = world.recorder.timingModel.getHotspots();
  if (hotspots.length > 0) {
    maybeEmitRecognitionCallout(world, 'inky', 'timing', true, bus);
  } else if (world.recorder.timingModel.getTimingConfidence() >= CONFIDENCE_ACT_THRESHOLD) {
    maybeEmitRecognitionCallout(world, 'inky', 'timing', false, bus);
  }
  if (
    inky.state.released &&
    !inky.inDen &&
    inky.state.confidence >= CONFIDENCE_ACT_THRESHOLD &&
    inky.state.mode === 'predict' &&
    hotspots.some((h) => h.junctionId === decision.junctionId)
  ) {
    const jTile = world.graph.getJunctionById(decision.junctionId)?.tile;
    if (jTile) {
      const dist = world.graph.pathDistance(nearestTile(inky.pos, world.maze.cols), jTile, false);
      const hit = dist <= 3 || decision.dwellMs >= 350;
      const rec = {
        t: decision.t,
        ghostId: 'inky' as const,
        kind: 'timing' as const,
        context: `timing:${decision.junctionId}`,
        predicted: `J${decision.junctionId}`,
        confidence: inky.state.confidence,
        actual: `J${decision.junctionId}`,
        hit,
        consequential: decision.threat,
        junctionId: decision.junctionId,
        corridorNickname: cor?.nickname,
      };
      world.recorder.recordPrediction(rec, world.graph);
      world.clipRecorder.onPrediction(rec);
      updateGhostRollingAccuracy(inky, hit, decision.t);
      world.recalibration.evaluatePrediction(
        inky,
        hit,
        rec.context,
        decision.t,
        world.ambushPlanner,
        world.ghosts,
        world.recorder,
        bus,
      );
    }
  }
}

export function stepWorld(
  world: WorldState,
  dtS: number,
  bus: EventBus,
  onSnapshot?: (snap: HudSnapshot) => void,
): void {
  if (world.paused || world.ended) return;

  world.elapsedS += dtS;
  if (world.lanternRemainingS > 0) {
    world.lanternRemainingS = Math.max(0, world.lanternRemainingS - dtS);
  }

  stepPlayer(world.player, world.graph, dtS, world.elapsedS);

  // Snapshot pre-decision RouteModel prediction before HabitRecorder mutates model weights
  let prePredCapture: ReturnType<RouteModel['predict']> | null = null;
  const pTileForPred = nearestTile(world.player.pos, world.maze.cols);
  const pJunc = world.graph.getJunctionAt(pTileForPred);
  if (pJunc) {
    prePredCapture = world.recorder.routeModel.predict(pJunc.id, world.player.dir, world.graph);
  }

  world.recorder.step(world.player, world.ghosts, world.graph, dtS, world.elapsedS, bus, (dec) => {
    const pre =
      prePredCapture && prePredCapture.contextKey === RouteModel.makeContextKey(dec.junctionId, dec.entryDir)
        ? prePredCapture
        : world.recorder.routeModel.predict(dec.junctionId, dec.entryDir, world.graph);
    handleDecisionAndFeedback(world, dec, pre, bus);
  });

  world.entropy = world.recorder.entropy.getEntropy();
  world.multiplier = world.recorder.entropy.getMultiplier();

  // Collect pellet on current tile
  const pt = nearestTile(world.player.pos, world.maze.cols);
  const pk = tileKey(pt.x, pt.y);
  if (world.pellets.has(pk)) {
    world.pellets.delete(pk);
    const pts = Math.round(PELLET_BASE_POINTS * world.multiplier);
    world.score += pts;
    bus.emit('pellet-collected', { t: world.elapsedS, points: pts, isLantern: false });
  } else if (world.lanterns.has(pk)) {
    world.lanterns.delete(pk);
    world.lanternRemainingS = LANTERN_SLOW_DURATION_S;
    const pts = Math.round(LANTERN_PELLET_POINTS * world.multiplier);
    world.score += pts;
    bus.emit('pellet-collected', { t: world.elapsedS, points: pts, isLantern: true });
  }

  // Step active recalibrations before brain assignment
  world.recalibration.stepRecalibrations(world.ghosts, world.recorder, world.elapsedS);

  // Specialist Brains + Ambush Planner + Fairness Governor
  const forceStage0 = world.recorder.pacing.isStage0Forced(world.elapsedS);
  world.ambushPlanner.plan(
    world.ghosts,
    world.player,
    world.recorder.panicModel,
    world.recorder.pacing,
    world.graph,
    world.elapsedS,
    bus,
  );
  if (world.ambushPlanner.getReservations().size > 0) {
    const firstAmbush = Array.from(world.ambushPlanner.getReservations().values())[0];
    maybeEmitRecognitionCallout(world, firstAmbush.ghostId, 'panic', true, bus);
  }

  const baseSpeedMul = GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS;
  const ambushSpeedMul = GHOST_AMBUSH_SPEED_CAP_TPS / PLAYER_SPEED_TPS;
  const targets: Record<GhostId, TileCoord> = {
    pinky: { ...world.ghosts.pinky.state.target },
    inky: { ...world.ghosts.inky.state.target },
    blinky: { ...world.ghosts.blinky.state.target },
  };

  for (const id of ['pinky', 'inky', 'blinky'] as const) {
    const g = world.ghosts[id];
    if (!g.state.released || g.inDen || g.state.mode === 'stumble' || g.state.mode === 'recalibrate') {
      continue;
    }

    const gTile = nearestTile(g.pos, world.maze.cols);
    const ambushRes = world.ambushPlanner.getReservations().get(id);
    if (ambushRes) {
      g.state.mode = 'ambush';
      g.state.speedMul = ambushSpeedMul;
      targets[id] = ambushRes.node;
      continue;
    }

    if (id === 'pinky') {
      const dec = evaluateRouteBrain(world.player, world.recorder.routeModel, world.graph, forceStage0);
      g.state.confidence = dec.confidence;
      g.state.speedMul = baseSpeedMul;
      if (dec.active && dec.target) {
        g.state.mode = 'predict';
        g.state.predictionLine = dec.predictionLine;
        targets[id] = dec.target;
      } else {
        g.state.mode = 'chase';
        const s0 = computeStage0Target('pinky', gTile, g.patrolIndex, world.player, world.graph);
        g.patrolIndex = s0.patrolIndex;
        g.state.predictionLine = s0.predictionLine;
        targets[id] = s0.target;
      }
    } else if (id === 'inky') {
      const dec = evaluateTimingBrain(gTile, world.player, world.recorder.timingModel, world.graph, forceStage0);
      g.state.confidence = dec.confidence;
      g.state.speedMul = dec.speedMulOverride ?? baseSpeedMul;
      if (dec.active && dec.target) {
        g.state.mode = 'predict';
        g.state.predictionLine = dec.predictionLine;
        targets[id] = dec.target;
      } else {
        g.state.mode = 'chase';
        const s0 = computeStage0Target('inky', gTile, g.patrolIndex, world.player, world.graph);
        g.patrolIndex = s0.patrolIndex;
        g.state.predictionLine = s0.predictionLine;
        targets[id] = s0.target;
      }
    } else {
      const dec = evaluatePanicBrain(world.player, world.recorder.panicModel, world.graph, forceStage0);
      g.state.confidence = dec.confidence;
      g.state.speedMul = baseSpeedMul;
      if (dec.active && dec.target) {
        g.state.mode = 'predict';
        g.state.predictionLine = dec.predictionLine;
        targets[id] = dec.target;
      } else {
        g.state.mode = 'chase';
        const s0 = computeStage0Target('blinky', gTile, g.patrolIndex, world.player, world.graph);
        g.patrolIndex = s0.patrolIndex;
        g.state.predictionLine = s0.predictionLine;
        targets[id] = s0.target;
      }
    }
  }

  // Run Fairness Governor AFTER brains/ambush and BEFORE movement
  const audit = applyFairnessGovernor(
    world.ghosts,
    targets,
    world.player,
    world.ambushPlanner,
    world.graph,
    world.lanternRemainingS > 0,
  );
  world.governorMinOpenExits = Math.min(world.governorMinOpenExits, audit.nonAmbushedExitCount);

  // Step all ghosts
  for (const id of ['blinky', 'pinky', 'inky'] as const) {
    stepGhost(world.ghosts[id], world.player, world.graph, dtS, world.elapsedS, () => targets[id]);
  }

  // Record 10 Hz positional clip buffer & check strong predictions
  world.clipRecorder.step(world);

  // Check capture collision
  if (world.elapsedS >= world.player.invulnUntilT) {
    for (const id of ['blinky', 'pinky', 'inky'] as const) {
      const g = world.ghosts[id];
      if (!g.state.released || g.state.mode === 'stumble') continue;
      if (isCaptureCollision(world.graph, world.player.pos, g.pos)) {
        world.lives -= 1;
        world.recorder.finalizePendingThreatOnDeath();
        const corridor = world.graph.getCorridorAtTile(pt);
        const location = corridor ? corridor.nickname : 'the glass corridor';

        const ambushRes = world.ambushPlanner.getReservations().get(id);
        const ambushCorStat = ambushRes ? world.recorder.corridorStats.get(ambushRes.corridorId) : undefined;
        const lastPred = [...world.recorder.predictions].reverse().find((p) => p.ghostId === id);

        const causeLine = buildCauseOfCaptureLine({
          ghostId: id,
          corridorNickname: ambushRes
            ? world.graph.getCorridorById(ambushRes.corridorId)?.nickname ?? location
            : location,
          ambushEscapeCount: ambushCorStat?.escapeVisits,
          lastPrediction: lastPred,
        });

        world.clipRecorder.onCapture(world, id, causeLine);
        bus.emit('capture', {
          t: world.elapsedS,
          ghostId: id,
          causeLine,
          livesRemaining: world.lives,
        });

        if (world.lives <= 0) {
          endWorldRun(world, 'lives', bus);
          onSnapshot?.(buildHudSnapshot(world));
          return;
        }
        resetPositionsPreservingMemory(world);
        break;
      }
    }
  }

  // Round progression
  if (world.pellets.size === 0 && world.lanterns.size === 0) {
    const finished = world.round;
    world.round += 1;
    resetPelletsForNextRound(world);
    bus.emit('round-clear', { t: world.elapsedS, round: finished, nextRound: world.round });
  }

  if (onSnapshot) {
    world.snapshotAccumS += dtS;
    if (world.snapshotAccumS >= UI_SNAPSHOT_INTERVAL_S) {
      world.snapshotAccumS -= UI_SNAPSHOT_INTERVAL_S;
      onSnapshot(buildHudSnapshot(world));
    }
  }
}

export function endWorldRun(world: WorldState, reason: 'lives' | 'manual', bus: EventBus): void {
  if (world.ended) return;
  world.ended = true;
  world.endReason = reason;
  world.clipRecorder.flushPending();
  bus.emit('run-end', { t: world.elapsedS, runId: world.runId, reason });
}

export function buildHudSnapshot(world: WorldState): HudSnapshot {
  const base = createInitialSnapshot();
  return {
    ...base,
    screen: world.ended ? 'autopsy' : world.paused ? 'paused' : 'playing',
    runId: world.runId,
    elapsedS: world.elapsedS,
    round: world.round,
    score: world.score,
    lives: world.lives,
    pelletsRemaining: world.pellets.size + world.lanterns.size,
    pelletsTotal: world.pelletsTotal,
    entropy: world.entropy,
    multiplier: world.multiplier,
    lanternRemainingS: world.lanternRemainingS,
    ghosts: {
      pinky: {
        ...base.ghosts.pinky,
        mode: world.ghosts.pinky.state.mode,
        confidence: world.ghosts.pinky.state.confidence,
        predictionLine: world.ghosts.pinky.state.predictionLine,
        knewAtT: world.ghosts.pinky.state.knewAtT,
      },
      inky: {
        ...base.ghosts.inky,
        mode: world.ghosts.inky.state.mode,
        confidence: world.ghosts.inky.state.confidence,
        predictionLine: world.ghosts.inky.state.predictionLine,
        knewAtT: world.ghosts.inky.state.knewAtT,
      },
      blinky: {
        ...base.ghosts.blinky,
        mode: world.ghosts.blinky.state.mode,
        confidence: world.ghosts.blinky.state.confidence,
        predictionLine: world.ghosts.blinky.state.predictionLine,
        knewAtT: world.ghosts.blinky.state.knewAtT,
      },
    },
    paused: world.paused,
  };
}
