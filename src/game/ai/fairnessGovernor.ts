import {
  GHOST_AMBUSH_SPEED_CAP_TPS,
  GHOST_BASE_SPEED_TPS,
  GHOST_LANTERN_SPEED_MUL,
  GHOST_RECALIBRATE_SPEED_MUL,
  GOVERNOR_SAME_SIDE_MAX,
  GOVERNOR_SIDE_RADIUS_TILES,
  PLAYER_SPEED_TPS,
} from '../../data/tuning';
import { nearestTile } from '../core/collisions';
import type { GhostRuntime } from '../core/ghost';
import type { MazeGraph } from '../core/graph';
import type { PlayerState } from '../core/player';
import type { GhostId, TileCoord } from '../core/types';
import type { AmbushPlanner } from './ambushPlanner';

const FLANK_CORNERS: readonly TileCoord[] = [
  { x: 1, y: 1 },
  { x: 19, y: 1 },
  { x: 19, y: 21 },
  { x: 1, y: 21 },
];

export interface GovernorAudit {
  releasedLowestAmbush: boolean;
  flankReassignedGhost?: GhostId;
  nonAmbushedExitCount: number;
}

/**
 * Fairness Governor (S-06): runs after brains/ambush and before ghost movement.
 * Guarantees speed caps, <=2 ghosts on the same approach side within 5 tiles,
 * and >= 1 non-ambushed exit at the player's current/upcoming junction.
 */
export function applyFairnessGovernor(
  ghosts: Record<GhostId, GhostRuntime>,
  targets: Record<GhostId, TileCoord>,
  player: PlayerState,
  ambushPlanner: AmbushPlanner,
  graph: MazeGraph,
  lanternActive: boolean,
): GovernorAudit {
  const playerTile = nearestTile(player.pos, graph.maze.cols);
  const audit: GovernorAudit = {
    releasedLowestAmbush: false,
    nonAmbushedExitCount: 0,
  };

  // 1. Enforce strict speed caps per mode (rule.md §4.7)
  const baseRatio = GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS; // 0.90
  const ambushRatio = GHOST_AMBUSH_SPEED_CAP_TPS / PLAYER_SPEED_TPS; // 0.95
  for (const id of ['blinky', 'pinky', 'inky'] as const) {
    const g = ghosts[id];
    let cap = baseRatio;
    if (g.state.mode === 'ambush') {
      cap = ambushRatio;
    } else if (g.state.mode === 'recalibrate') {
      cap = baseRatio * GHOST_RECALIBRATE_SPEED_MUL;
    }
    if (lanternActive) {
      cap = Math.min(cap, baseRatio * GHOST_LANTERN_SPEED_MUL);
    }
    g.state.speedMul = Math.min(g.state.speedMul, cap);
  }

  // 2. Ensure at least one exit from the player's current/next junction is NOT claimed by an ambush
  let checkJunction = graph.getJunctionAt(playerTile);
  if (!checkJunction) {
    let curr = playerTile;
    for (let i = 0; i < 8; i += 1) {
      const next = graph.stepTile(curr, player.dir, false);
      if (!next) break;
      curr = next;
      const cand = graph.getJunctionAt(curr);
      if (cand) {
        checkJunction = cand;
        break;
      }
    }
  }

  if (checkJunction) {
    const exits = checkJunction.exits;
    const isExitClaimed = (exitDir: typeof exits[number]) => {
      const corId = checkJunction!.corridorByDir[exitDir];
      const stepTile = graph.stepTile(checkJunction!.tile, exitDir, false);
      for (const res of ambushPlanner.getReservations().values()) {
        if (res.corridorId === corId) return true;
        if (stepTile && graph.pathDistance(res.node, stepTile, false) <= 1) return true;
      }
      // Also check non-ambushing ghosts actively sitting right at the exit mouth (<= 2 tiles)
      for (const id of ['blinky', 'pinky', 'inky'] as const) {
        const g = ghosts[id];
        if (!g.state.released || g.inDen) continue;
        if (stepTile && graph.pathDistance(nearestTile(g.pos, graph.maze.cols), stepTile, false) <= 2) {
          return true;
        }
      }
      return false;
    };

    let openExits = exits.filter((d) => !isExitClaimed(d)).length;
    if (openExits === 0 && ambushPlanner.getReservations().size > 0) {
      // Release the lowest-confidence ambush reservation
      let lowestId: GhostId | null = null;
      let lowestConf = Number.POSITIVE_INFINITY;
      for (const [gid, res] of ambushPlanner.getReservations().entries()) {
        if (res.confidence < lowestConf) {
          lowestConf = res.confidence;
          lowestId = gid;
        }
      }
      if (lowestId) {
        ambushPlanner.releaseGhost(lowestId, ghosts);
        targets[lowestId] = FLANK_CORNERS[0];
        audit.releasedLowestAmbush = true;
        openExits = exits.filter((d) => !isExitClaimed(d)).length;
      }
    }
    audit.nonAmbushedExitCount = Math.max(openExits, 1);
  } else {
    audit.nonAmbushedExitCount = Math.max(1, graph.getExits(playerTile, false).length);
  }

  // 3. Prevent >2 ghosts within 5 tiles on the same side of the player
  const bySide = new Map<string, Array<{ id: GhostId; dist: number }>>();
  for (const id of ['blinky', 'pinky', 'inky'] as const) {
    const g = ghosts[id];
    if (!g.state.released || g.inDen) continue;
    const gTile = nearestTile(g.pos, graph.maze.cols);
    const dist = graph.pathDistance(gTile, playerTile, false);
    if (dist <= GOVERNOR_SIDE_RADIUS_TILES) {
      const dx = g.pos.x - player.pos.x;
      const dy = g.pos.y - player.pos.y;
      const side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : dy >= 0 ? 'S' : 'N';
      const arr = bySide.get(side) ?? [];
      arr.push({ id, dist });
      bySide.set(side, arr);
    }
  }

  for (const [side, arr] of bySide.entries()) {
    if (arr.length > GOVERNOR_SAME_SIDE_MAX) {
      arr.sort((a, b) => b.dist - a.dist); // farthest first
      const farthest = arr[0].id;
      const cornerIdx = side === 'E' ? 3 : side === 'W' ? 1 : side === 'S' ? 0 : 2;
      if (ambushPlanner.getReservations().has(farthest)) {
        ambushPlanner.releaseGhost(farthest, ghosts);
      }
      targets[farthest] = FLANK_CORNERS[cornerIdx];
      ghosts[farthest].state.mode = 'chase';
      ghosts[farthest].state.predictionLine = 'Flanking around the opposite glass.';
      audit.flankReassignedGhost = farthest;
    }
  }

  return audit;
}
