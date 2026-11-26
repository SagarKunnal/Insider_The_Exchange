import { CONFIDENCE_ACT_THRESHOLD, GHOST_BASE_SPEED_TPS, TIMING_ETA_TOLERANCE_S } from '../../data/tuning';
import { nearestTile } from '../core/collisions';
import type { MazeGraph } from '../core/graph';
import type { PlayerState } from '../core/player';
import type { TileCoord } from '../core/types';
import type { TimingModel } from '../memory/timingModel';

export interface TimingBrainDecision {
  active: boolean;
  target: TileCoord | null;
  confidence: number;
  speedMulOverride?: number;
  predictionLine: string;
  etaDeltaS?: number;
}

export function evaluateTimingBrain(
  ghostTile: TileCoord,
  player: PlayerState,
  timingModel: TimingModel,
  graph: MazeGraph,
  forceStage0: boolean,
): TimingBrainDecision {
  const confidence = timingModel.getTimingConfidence();
  if (forceStage0 || confidence < CONFIDENCE_ACT_THRESHOLD) {
    return {
      active: false,
      target: null,
      confidence,
      predictionLine: 'Measuring your cadence…',
    };
  }

  const playerTile = nearestTile(player.pos, graph.maze.cols);
  const hotspots = timingModel.getHotspots();

  // Prefer an upcoming junction along player's trajectory, or nearest hotspot when player is near it
  let targetJunctionTile: TileCoord | null = null;
  const corridorId = graph.getCorridorAtTile(playerTile)?.id ?? '';

  if (hotspots.length > 0) {
    const bestHotspot = graph.getJunctionById(hotspots[0].junctionId);
    if (bestHotspot && graph.pathDistance(playerTile, bestHotspot.tile, false) <= 10) {
      targetJunctionTile = bestHotspot.tile;
    }
  }

  if (!targetJunctionTile) {
    // Walk ahead along player's current heading up to 2 junctions to find an intercept junction
    let curr = playerTile;
    let dir = player.dir;
    for (let step = 0; step < 10; step += 1) {
      const next = graph.stepTile(curr, dir, false);
      if (!next) break;
      curr = next;
      const cand = graph.getJunctionAt(curr);
      if (cand) {
        const gDist = graph.pathDistance(ghostTile, cand.tile, false);
        const pDist = graph.pathDistance(playerTile, cand.tile, false);
        targetJunctionTile = cand.tile;
        // If Inky can reach this junction in time or pace down to match ETA, pick it; else try one junction farther
        if (gDist <= pDist + 2) break;
      }
    }
  }

  if (!targetJunctionTile && hotspots.length > 0) {
    targetJunctionTile = graph.getJunctionById(hotspots[0].junctionId)?.tile ?? null;
  }

  if (!targetJunctionTile) {
    return {
      active: false,
      target: null,
      confidence,
      predictionLine: 'Measuring your cadence…',
    };
  }

  const playerDist = graph.pathDistance(playerTile, targetJunctionTile, false);
  const playerEtaS = corridorId
    ? timingModel.estimateEtaToJunctionS(corridorId, playerDist, graph)
    : playerDist / 6.0;

  const ghostDist = graph.pathDistance(ghostTile, targetJunctionTile, false);
  const ghostEtaS = ghostDist / GHOST_BASE_SPEED_TPS;
  const etaDeltaS = ghostEtaS - playerEtaS;

  // If Inky would arrive well before the player, pace speed down slightly or lurk adjacent so arrival converges within +-0.5s
  let speedMulOverride: number | undefined;
  let target = targetJunctionTile;

  if (etaDeltaS < -TIMING_ETA_TOLERANCE_S) {
    const desiredSpeedTps = Math.max(2.7, ghostDist / Math.max(0.25, playerEtaS));
    speedMulOverride = Math.min(0.9, desiredSpeedTps / 6.0);
    // If already at hotspot waiting, step to an adjacent tile to lurk
    if (ghostDist === 0) {
      const nbs = graph.getExits(targetJunctionTile, false);
      if (nbs.length > 0) {
        target = graph.stepTile(targetJunctionTile, nbs[0], false) ?? targetJunctionTile;
      }
    }
  }

  const jObj = graph.getJunctionAt(targetJunctionTile);
  const cId = jObj?.corridorByDir[jObj.exits[0]];
  const nick = cId ? graph.getCorridorById(cId)?.nickname ?? 'that junction' : 'that junction';

  return {
    active: true,
    target,
    confidence,
    speedMulOverride,
    predictionLine:
      hotspots.length > 0
        ? `Lurking near your stall spot at ${nick}.`
        : `Timing your arrival at ${nick}.`,
    etaDeltaS,
  };
}
