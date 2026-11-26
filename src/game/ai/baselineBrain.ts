import { INKY_STAGE0_CHASE_RANGE_TILES, PINKY_STAGE0_AHEAD_TILES } from '../../data/tuning';
import { nearestTile } from '../core/collisions';
import type { MazeGraph } from '../core/graph';
import type { PlayerState } from '../core/player';
import type { GhostId, TileCoord } from '../core/types';

export interface Stage0Decision {
  target: TileCoord;
  patrolIndex: number;
  predictionLine: string;
}

const INKY_PATROL_CORNERS: readonly TileCoord[] = [
  { x: 1, y: 1 },
  { x: 19, y: 1 },
  { x: 19, y: 21 },
  { x: 1, y: 21 },
];

export function computeStage0Target(
  ghostId: GhostId,
  ghostTile: TileCoord,
  patrolIndex: number,
  player: PlayerState,
  graph: MazeGraph,
): Stage0Decision {
  const playerTile = nearestTile(player.pos, graph.maze.cols);

  if (ghostId === 'blinky') {
    return {
      target: playerTile,
      patrolIndex,
      predictionLine: 'Chasing directly on sight.',
    };
  }

  if (ghostId === 'pinky') {
    const ahead = graph.projectAhead(playerTile, player.dir, PINKY_STAGE0_AHEAD_TILES);
    return {
      target: ahead,
      patrolIndex,
      predictionLine: 'Cutting 4 tiles ahead of your stride.',
    };
  }

  // Inky: chase when within 8 path-tiles, otherwise patrol outer corners
  const dist = graph.pathDistance(ghostTile, playerTile, false);
  if (dist <= INKY_STAGE0_CHASE_RANGE_TILES) {
    return {
      target: playerTile,
      patrolIndex,
      predictionLine: 'Closing in — you drifted within 8 tiles.',
    };
  }

  let nextIdx = patrolIndex % INKY_PATROL_CORNERS.length;
  let waypoint = INKY_PATROL_CORNERS[nextIdx];
  if (ghostTile.x === waypoint.x && ghostTile.y === waypoint.y) {
    nextIdx = (nextIdx + 1) % INKY_PATROL_CORNERS.length;
    waypoint = INKY_PATROL_CORNERS[nextIdx];
  }
  return {
    target: waypoint,
    patrolIndex: nextIdx,
    predictionLine: 'Patrolling the outer glass.',
  };
}
