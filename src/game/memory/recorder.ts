import {
  CONTEXT_DECAY_FACTOR,
  DECISION_ZONE_RADIUS_TILES,
  DWELL_FLAG_MS,
  STALL_FLAG_MS,
  THREAT_DISTANCE_TILES,
} from '../../data/tuning';
import { nearestTile } from '../core/collisions';
import type { EventBus } from '../core/eventBus';
import type { GhostRuntime } from '../core/ghost';
import { MazeGraph, getRelativeTurn } from '../core/graph';
import { ALL_DIRS, OPPOSITE_DIR } from '../core/maze';
import type { PlayerState } from '../core/player';
import type {
  CorridorStat,
  DecisionEvent,
  Direction,
  GhostId,
  HesitationEvent,
  PatternBreakEvent,
  PredictionRecord,
  ThreatEvent,
} from '../core/types';
import { EntropyEngine } from './entropy';
import { PacingTracker } from './pacing';
import { PanicModel } from './panicModel';
import { RouteModel } from './routeModel';
import { TimingModel } from './timingModel';

interface ActiveJunctionVisit {
  junctionId: number;
  entryDir: Direction;
  enteredAtS: number;
  reachedCenter: boolean;
  fired: boolean;
}

export class HabitRecorder {
  readonly decisions: DecisionEvent[] = [];
  readonly threats: ThreatEvent[] = [];
  readonly hesitations: HesitationEvent[] = [];
  readonly predictions: PredictionRecord[] = [];
  readonly patternBreaks: PatternBreakEvent[] = [];
  readonly corridorStats = new Map<string, CorridorStat>();

  readonly routeModel = new RouteModel();
  readonly timingModel = new TimingModel();
  readonly panicModel = new PanicModel();
  readonly entropy = new EntropyEngine();
  readonly pacing = new PacingTracker();

  private activeVisit: ActiveJunctionVisit | null = null;
  private lastCorridorId: string | null = null;
  private corridorEnteredAtS = 0;
  private prevPlayerDir: Direction = 'W';
  private stallMs = 0;
  private stallEmitted = false;
  private pendingThreat: { event: ThreatEvent; expiresAtS: number } | null = null;
  private lastGhostDist = new Map<GhostId, number>();
  private lastThreatNotifyS = -100;

  step(
    player: PlayerState,
    ghosts: Record<GhostId, GhostRuntime>,
    graph: MazeGraph,
    dtS: number,
    nowS: number,
    bus: EventBus,
    onDecision?: (decision: DecisionEvent) => void,
  ): void {
    const pTile = nearestTile(player.pos, graph.maze.cols);

    // 1. Mid-corridor reversal hesitation tracking
    if (player.dir === OPPOSITE_DIR[this.prevPlayerDir] && !graph.getJunctionAt(pTile)) {
      this.hesitations.push({
        t: nowS,
        junctionId: player.lastJunctionId ?? -1,
        kind: 'reversal',
        ms: 0,
      });
    }
    this.prevPlayerDir = player.dir;

    // 2. Stationary stall tracking (>= 250 ms)
    const movedDist = graph.continuousDistance(player.pos, player.prevPos);
    if (movedDist < 1e-4) {
      this.stallMs += dtS * 1000;
      if (this.stallMs >= STALL_FLAG_MS && !this.stallEmitted) {
        this.stallEmitted = true;
        this.hesitations.push({
          t: nowS,
          junctionId: this.activeVisit?.junctionId ?? player.lastJunctionId ?? -1,
          kind: 'stall',
          ms: Math.round(this.stallMs),
        });
      }
    } else {
      this.stallMs = 0;
      this.stallEmitted = false;
    }

    // 3. Track corridor entry/exit for traversal timing
    const currCorridor = graph.getCorridorAtTile(pTile);
    if (currCorridor && currCorridor.id !== this.lastCorridorId) {
      if (this.lastCorridorId) {
        this.timingModel.observeCorridorTraversal(this.lastCorridorId, nowS - this.corridorEnteredAtS);
      }
      this.lastCorridorId = currCorridor.id;
      this.corridorEnteredAtS = nowS;
    }

    // 4. Finalize expired pending threat as survived=true
    if (this.pendingThreat && nowS >= this.pendingThreat.expiresAtS) {
      this.pendingThreat.event.survived = true;
      this.threats.push(this.pendingThreat.event);
      this.pendingThreat = null;
    }

    // 5. Find nearby junction within decision zone
    let nearJunction = graph.getJunctionAt(pTile);
    if (!nearJunction) {
      for (const j of graph.maze.junctions) {
        if (graph.continuousDistance(player.pos, j.tile) <= DECISION_ZONE_RADIUS_TILES) {
          nearJunction = j;
          break;
        }
      }
    }

    if (nearJunction) {
      const distToNear = graph.continuousDistance(player.pos, nearJunction.tile);
      if (!this.activeVisit) {
        this.activeVisit = {
          junctionId: nearJunction.id,
          entryDir: player.dir,
          enteredAtS: nowS,
          reachedCenter: distToNear <= 0.25,
          fired: false,
        };
      } else if (this.activeVisit.junctionId !== nearJunction.id) {
        // Direct jump between adjacent junctions: fire previous visit first if center was reached
        if (!this.activeVisit.fired && this.activeVisit.reachedCenter) {
          const prevJ = graph.getJunctionById(this.activeVisit.junctionId);
          if (prevJ) {
            const exitDir =
              ALL_DIRS.find((d) => {
                const step = graph.stepTile(prevJ.tile, d, false);
                return step && step.x === nearJunction!.tile.x && step.y === nearJunction!.tile.y;
              }) ?? player.dir;
            this.fireDecision(this.activeVisit, exitDir, player, ghosts, graph, nowS, bus, onDecision);
          }
        }
        this.activeVisit = {
          junctionId: nearJunction.id,
          entryDir: player.dir,
          enteredAtS: nowS,
          reachedCenter: distToNear <= 0.25,
          fired: false,
        };
      } else if (!this.activeVisit.fired) {
        const jDef = graph.getJunctionById(this.activeVisit.junctionId);
        if (jDef) {
          const distFromCenter = graph.continuousDistance(player.pos, jDef.tile);
          if (distFromCenter <= 0.25) {
            this.activeVisit.reachedCenter = true;
          }
          const leftCenterTile = pTile.x !== jDef.tile.x || pTile.y !== jDef.tile.y;
          // Fire ONLY after crossing the junction center so turns executed at the center are captured accurately
          if (this.activeVisit.reachedCenter && (leftCenterTile || (distFromCenter > 0.45 && player.moving))) {
            const exitDir = this.resolveExitDir(jDef.tile, player, graph);
            this.fireDecision(this.activeVisit, exitDir, player, ghosts, graph, nowS, bus, onDecision);
          }
        }
      }
    } else if (this.activeVisit) {
      // Exited junction zone; ensure single fire if center was crossed
      if (!this.activeVisit.fired && this.activeVisit.reachedCenter) {
        const jDef = graph.getJunctionById(this.activeVisit.junctionId);
        if (jDef) {
          const exitDir = this.resolveExitDir(jDef.tile, player, graph);
          this.fireDecision(this.activeVisit, exitDir, player, ghosts, graph, nowS, bus, onDecision);
        }
      }
      this.activeVisit = null;
    }

    // 6. Update ghost distances for approaching detection & entropy 1 Hz sampling
    for (const id of ['blinky', 'pinky', 'inky'] as const) {
      const g = ghosts[id];
      if (!g.state.released) continue;
      const d = graph.pathDistance(nearestTile(g.pos, graph.maze.cols), pTile, false);
      this.lastGhostDist.set(id, d);
    }
    this.entropy.step(dtS, nowS);
  }

  private resolveExitDir(
    jTile: { x: number; y: number },
    player: PlayerState,
    graph: MazeGraph,
  ): Direction {
    const pTile = nearestTile(player.pos, graph.maze.cols);
    for (const d of ALL_DIRS) {
      const nb = graph.stepTile(jTile, d, false);
      if (nb && nb.x === pTile.x && nb.y === pTile.y) {
        return d;
      }
    }
    return player.dir;
  }

  private fireDecision(
    visit: ActiveJunctionVisit,
    exitDir: Direction,
    player: PlayerState,
    ghosts: Record<GhostId, GhostRuntime>,
    graph: MazeGraph,
    nowS: number,
    bus: EventBus,
    onDecision?: (decision: DecisionEvent) => void,
  ): void {
    visit.fired = true;
    const jDef = graph.getJunctionById(visit.junctionId);
    if (!jDef) return;

    const corridorId = jDef.corridorByDir[exitDir] ?? '';
    const relTurn = getRelativeTurn(visit.entryDir, exitDir);
    const dwellMs = Math.max(0, Math.round((nowS - visit.enteredAtS) * 1000));

    // Check threat: any released ghost within 6 path-tiles and approaching
    let threat = false;
    let nearestGhost: GhostId | undefined;
    let threatDist: number | undefined;
    let minD = Number.POSITIVE_INFINITY;

    for (const id of ['blinky', 'pinky', 'inky'] as const) {
      const g = ghosts[id];
      if (!g.state.released || g.inDen || g.state.mode === 'stumble') continue;
      const gTile = nearestTile(g.pos, graph.maze.cols);
      const d = graph.pathDistance(gTile, jDef.tile, false);
      if (d <= THREAT_DISTANCE_TILES) {
        const prevD = this.lastGhostDist.get(id) ?? d + 1;
        const nextTile = graph.stepTile(gTile, g.state.dir, false);
        const headingCloser = nextTile ? graph.pathDistance(nextTile, jDef.tile, false) <= d : false;
        const approaching = d <= prevD || headingCloser || d <= 3;
        if (approaching && d < minD) {
          minD = d;
          threat = true;
          nearestGhost = id;
          threatDist = d;
        }
      }
    }

    const event: DecisionEvent = {
      t: nowS,
      junctionId: visit.junctionId,
      entryDir: visit.entryDir,
      exitDir,
      relTurn,
      dwellMs,
      threat,
      threatDist,
      nearestGhost,
      corridorId,
    };

    player.lastJunctionId = visit.junctionId;
    player.lastJunctionEntryDir = visit.entryDir;

    this.decisions.push(event);
    this.pacing.onDecision();
    this.pacing.recordFirstTrail(nowS);

    // Evaluate route model's prior confident prediction on this decision before updating weights
    const prePred = this.routeModel.predict(event.junctionId, event.entryDir, graph);
    if (prePred.source === 'context' && prePred.rawN >= 3 && prePred.confidence >= 0.45) {
      const hit = prePred.predictedExit === event.exitDir;
      const cor = graph.getCorridorById(event.corridorId);
      this.recordPrediction(
        {
          t: nowS,
          ghostId: 'pinky',
          kind: 'route',
          context: prePred.contextKey,
          predicted: prePred.predictedExit,
          confidence: prePred.confidence,
          actual: event.exitDir,
          hit,
          consequential: event.threat,
          junctionId: event.junctionId,
          corridorNickname: cor?.nickname,
        },
        graph,
      );
    }

    // Update models
    this.routeModel.observe(event, graph);
    this.timingModel.observeDecision(event);
    if (dwellMs >= DWELL_FLAG_MS) {
      const h: HesitationEvent = { t: nowS, junctionId: visit.junctionId, kind: 'dwell', ms: dwellMs };
      this.hesitations.push(h);
      this.timingModel.observeHesitation(h);
    }

    if (corridorId) {
      const prev = this.corridorStats.get(corridorId) ?? {
        corridorId,
        visits: 0,
        escapeVisits: 0,
        lastUsedT: nowS,
        strength: 0,
      };
      prev.strength = prev.strength * CONTEXT_DECAY_FACTOR + 1;
      prev.visits += 1;
      prev.lastUsedT = nowS;
      if (threat) prev.escapeVisits += 1;
      this.corridorStats.set(corridorId, prev);
    }

    if (threat && nearestGhost) {
      this.panicModel.observeThreatDecision(event, this.decisions.length);
      if (nowS - this.lastThreatNotifyS >= 3.0) {
        this.lastThreatNotifyS = nowS;
        bus.emit('threat-start', { t: nowS, ghostId: nearestGhost, distance: threatDist ?? 6 });
      }
      this.pendingThreat = {
        event: {
          t: nowS,
          ghostId: nearestGhost,
          distance: threatDist ?? 6,
          escapeCorridorId: corridorId,
          survived: true,
          relTurn,
        },
        expiresAtS: nowS + 2.5,
      };
    } else if (this.pendingThreat) {
      // Escaped threat cleanly
      this.pendingThreat.event.survived = true;
      this.threats.push(this.pendingThreat.event);
      this.pendingThreat = null;
    }

    this.entropy.recordDecision(event, graph);
    bus.emit('decision', event);
    onDecision?.(event);
  }

  finalizePendingThreatOnDeath(): void {
    if (this.pendingThreat) {
      this.pendingThreat.event.survived = false;
      this.threats.push(this.pendingThreat.event);
      this.pendingThreat = null;
    }
    this.activeVisit = null;
  }

  recordPrediction(record: PredictionRecord, graph: MazeGraph): void {
    this.predictions.push(record);
    if (record.hit !== undefined && record.confidence >= 0.45) {
      this.entropy.recordConfidentPredictionResult(record.hit, graph);
    }
  }

  exportDebugJson(runMeta: { runId: string; round: number; score: number; durationS: number }): string {
    return JSON.stringify(
      {
        run: runMeta,
        milestones: this.pacing.milestones,
        decisions: this.decisions,
        threats: this.threats,
        hesitations: this.hesitations,
        predictions: this.predictions,
        patternBreaks: this.patternBreaks,
        corridorStats: Array.from(this.corridorStats.values()),
        entropyTimeline: this.entropy.getTimeline(),
        hotspots: this.timingModel.getHotspots(),
        panicPrediction: this.panicModel.predictPanicTurn(),
        escapeCandidates: this.panicModel.getEscapeCandidates(),
        detectedLoop: this.routeModel.getDetectedLoop(),
      },
      null,
      2,
    );
  }
}
