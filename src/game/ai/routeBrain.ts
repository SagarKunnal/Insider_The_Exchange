import { CONFIDENCE_ACT_THRESHOLD } from '../../data/tuning';
import { nearestTile } from '../core/collisions';
import type { MazeGraph } from '../core/graph';
import type { PlayerState } from '../core/player';
import type { Direction, TileCoord } from '../core/types';
import type { RouteModel } from '../memory/routeModel';

export interface RouteBrainDecision {
  active: boolean;
  target: TileCoord | null;
  confidence: number;
  predictionLine: string;
  predictedJunctionId?: number;
  predictedExit?: Direction;
}

function findUpcomingJunction(
  player: PlayerState,
  graph: MazeGraph,
): { junctionId: number; entryDir: Direction } | null {
  const start = nearestTile(player.pos, graph.maze.cols);
  const direct = graph.getJunctionAt(start);
  if (direct) {
    return { junctionId: direct.id, entryDir: player.dir };
  }

  let curr = start;
  let dir = player.dir;
  for (let i = 0; i < 12; i += 1) {
    const next = graph.stepTile(curr, dir, false);
    if (!next) {
      const exits = graph.getExits(curr, false).filter((d) => d !== dir);
      if (exits.length === 0) break;
      dir = exits[0];
      const turnStep = graph.stepTile(curr, dir, false);
      if (!turnStep) break;
      curr = turnStep;
    } else {
      curr = next;
    }
    const j = graph.getJunctionAt(curr);
    if (j) {
      return { junctionId: j.id, entryDir: dir };
    }
  }
  return null;
}

export function evaluateRouteBrain(
  player: PlayerState,
  routeModel: RouteModel,
  graph: MazeGraph,
  forceStage0: boolean,
): RouteBrainDecision {
  if (forceStage0) {
    return {
      active: false,
      target: null,
      confidence: 0,
      predictionLine: 'Mapping your favorite intersections…',
    };
  }

  // 1. Check for repeated loop (C-04a: two repeats cause Pinky to wait at the loop's next junction)
  const loop = routeModel.getDetectedLoop();
  if (loop && loop.repeats >= 2 && loop.nextJunctionId !== null) {
    const nextJ = graph.getJunctionById(loop.nextJunctionId);
    if (nextJ) {
      const conf = Math.min(0.95, 0.55 + loop.repeats * 0.1);
      const cId = nextJ.corridorByDir[nextJ.exits[0]];
      const nick = cId ? graph.getCorridorById(cId)?.nickname ?? 'your loop' : 'your loop';
      return {
        active: true,
        target: nextJ.tile,
        confidence: conf,
        predictionLine: `Waiting on your loop near ${nick}.`,
        predictedJunctionId: nextJ.id,
      };
    }
  }

  // 2. Context-based 2-junction lookahead cut-off node
  const upcoming = findUpcomingJunction(player, graph);
  if (!upcoming) {
    return {
      active: false,
      target: null,
      confidence: 0,
      predictionLine: 'Mapping your favorite intersections…',
    };
  }

  const pred = routeModel.hasStrongContextPrediction(upcoming.junctionId, upcoming.entryDir, graph);
  if (!pred || pred.confidence < CONFIDENCE_ACT_THRESHOLD) {
    return {
      active: false,
      target: null,
      confidence: pred?.confidence ?? 0,
      predictionLine: 'Studying your junction turns…',
    };
  }

  // Hop 1 along predicted exit
  const hop1 = graph.getNextJunctionFrom(upcoming.junctionId, pred.predictedExit);
  let cutOffTile = graph.getJunctionById(upcoming.junctionId)!.tile;
  let cutOffCorridorNick = 'the next bend';

  if (hop1) {
    cutOffTile = hop1.junction.tile;
    cutOffCorridorNick = graph.getCorridorById(hop1.corridorId)?.nickname ?? cutOffCorridorNick;
    // Hop 2 lookahead if hop 1 also has confident prediction
    const pred2 = routeModel.predict(hop1.junction.id, hop1.entryDir, graph);
    if (pred2.confidence >= CONFIDENCE_ACT_THRESHOLD) {
      const hop2 = graph.getNextJunctionFrom(hop1.junction.id, pred2.predictedExit);
      if (hop2) {
        cutOffTile = hop2.junction.tile;
        cutOffCorridorNick = graph.getCorridorById(hop2.corridorId)?.nickname ?? cutOffCorridorNick;
      }
    }
  } else {
    const step = graph.projectAhead(cutOffTile, pred.predictedExit, 2);
    cutOffTile = step;
  }

  return {
    active: true,
    target: cutOffTile,
    confidence: pred.confidence,
    predictionLine: `Expecting you toward ${cutOffCorridorNick} (${Math.round(pred.p * 100)}%).`,
    predictedJunctionId: upcoming.junctionId,
    predictedExit: pred.predictedExit,
  };
}
