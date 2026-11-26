import {
  GHOST_BASE_SPEED_TPS,
  GHOST_CONFIG,
  GHOST_RELEASE_TIMES_S,
} from '../../data/tuning';
import { computeStage0Target } from '../ai/baselineBrain';
import { nearestTile } from './collisions';
import type { MazeGraph } from './graph';
import { CELL_DEN, CELL_GATE, DIR_DELTA, OPPOSITE_DIR } from './maze';
import type { PlayerState } from './player';
import type { Direction, GhostId, GhostState, TileCoord, Vec2 } from './types';

export interface GhostRuntime {
  state: GhostState;
  pos: Vec2;
  prevPos: Vec2;
  patrolIndex: number;
  releaseAtS: number;
  inDen: boolean;
  lastDecisionTileKey: string;
}

const DEN_EXIT_TARGET: TileCoord = { x: 10, y: 8 };

export function createGhostRuntime(
  ghostId: GhostId,
  spawn: TileCoord,
  releaseAtS: number,
  inDen: boolean,
): GhostRuntime {
  const cfg = GHOST_CONFIG[ghostId];
  return {
    state: {
      ghostId,
      mode: 'chase',
      confidence: 0,
      target: { ...spawn },
      speedMul: GHOST_BASE_SPEED_TPS / 6.0,
      rollingHits: [],
      cooldowns: {
        recalibrateUntil: 0,
        calloutUntil: 0,
      },
      predictionLine: `Observing your ${cfg.specialty.toLowerCase()}…`,
      tile: { x: spawn.x, y: spawn.y },
      dir: 'W',
      released: releaseAtS <= 0,
    },
    pos: { x: spawn.x, y: spawn.y },
    prevPos: { x: spawn.x, y: spawn.y },
    patrolIndex: 0,
    releaseAtS,
    inDen,
    lastDecisionTileKey: '',
  };
}

export function createAllGhosts(
  spawns: Record<GhostId, TileCoord>,
  baseTimeS = 0,
): Record<GhostId, GhostRuntime> {
  return {
    blinky: createGhostRuntime('blinky', spawns.blinky, baseTimeS + GHOST_RELEASE_TIMES_S.blinky, false),
    pinky: createGhostRuntime('pinky', spawns.pinky, baseTimeS + GHOST_RELEASE_TIMES_S.pinky, true),
    inky: createGhostRuntime('inky', spawns.inky, baseTimeS + GHOST_RELEASE_TIMES_S.inky, true),
  };
}

function isAtCenter(pos: Vec2): boolean {
  return Math.abs(pos.x - Math.round(pos.x)) < 1e-4 && Math.abs(pos.y - Math.round(pos.y)) < 1e-4;
}

function wrapX(x: number, cols: number): number {
  if (x < -0.5) return x + cols;
  if (x >= cols - 0.5) return x - cols;
  return x;
}

export function stepGhost(
  ghost: GhostRuntime,
  player: PlayerState,
  graph: MazeGraph,
  dtS: number,
  nowS: number,
  chooseTarget?: (ghost: GhostRuntime, tile: TileCoord) => TileCoord | null,
): void {
  ghost.prevPos = { x: ghost.pos.x, y: ghost.pos.y };
  const cols = graph.maze.cols;

  if (!ghost.state.released) {
    if (nowS >= ghost.releaseAtS) {
      ghost.state.released = true;
    } else {
      return;
    }
  }

  if (ghost.state.mode === 'stumble') {
    if (ghost.state.stumbleUntilT !== undefined && nowS >= ghost.state.stumbleUntilT) {
      ghost.state.mode = 'chase';
      ghost.state.speedMul = GHOST_BASE_SPEED_TPS / 6.0;
      ghost.state.stumbleUntilT = undefined;
    } else {
      return;
    }
  }

  const speedTps = Math.min(6.0, 6.0 * ghost.state.speedMul);
  let remaining = speedTps * dtS;
  let guard = 0;

  while (remaining > 1e-6 && guard < 8) {
    guard += 1;

    if (isAtCenter(ghost.pos)) {
      const cx = ((Math.round(ghost.pos.x) % cols) + cols) % cols;
      const cy = Math.round(ghost.pos.y);
      ghost.pos.x = cx;
      ghost.pos.y = cy;
      const tile: TileCoord = { x: cx, y: cy };
      ghost.state.tile = tile;

      const cell = graph.maze.grid[cy][cx];
      if (ghost.inDen && cell !== CELL_DEN && cell !== CELL_GATE) {
        ghost.inDen = false;
      }

      const tileKeyStr = `${cx},${cy}`;
      if (tileKeyStr !== ghost.lastDecisionTileKey) {
        ghost.lastDecisionTileKey = tileKeyStr;
        const allowDen = ghost.inDen;

        if (allowDen) {
          ghost.state.target = DEN_EXIT_TARGET;
          ghost.state.dir = graph.nextStepToward(tile, DEN_EXIT_TARGET, null, true);
        } else {
          // Determine target via specialist override if confident, else Stage 0 brain
          let target = chooseTarget ? chooseTarget(ghost, tile) : null;
          if (!target) {
            const s0 = computeStage0Target(ghost.state.ghostId, tile, ghost.patrolIndex, player, graph);
            target = s0.target;
            ghost.patrolIndex = s0.patrolIndex;
            if (ghost.state.mode !== 'recalibrate') {
              ghost.state.predictionLine = s0.predictionLine;
            }
          }
          ghost.state.target = target;

          // Only allow reversal at junctions if recalibrating, or if cornered with no forward exit
          const isJunction = graph.getJunctionAt(tile) !== undefined;
          const forbidden: Direction | null = isJunction
            ? ghost.state.mode === 'recalibrate'
              ? null
              : OPPOSITE_DIR[ghost.state.dir]
            : OPPOSITE_DIR[ghost.state.dir];

          ghost.state.dir = graph.nextStepToward(tile, target, forbidden, false);
        }
      }
    }

    const delta = DIR_DELTA[ghost.state.dir];
    let distToNextCenter = 0;

    if (delta.x !== 0) {
      const frac = ghost.pos.x - Math.floor(ghost.pos.x);
      distToNextCenter = delta.x > 0 ? (frac < 1e-4 ? 1 : 1 - frac) : frac < 1e-4 ? 1 : frac;
    } else {
      const frac = ghost.pos.y - Math.floor(ghost.pos.y);
      distToNextCenter = delta.y > 0 ? (frac < 1e-4 ? 1 : 1 - frac) : frac < 1e-4 ? 1 : frac;
    }

    const advance = Math.min(remaining, distToNextCenter);
    ghost.pos.x = wrapX(ghost.pos.x + delta.x * advance, cols);
    ghost.pos.y += delta.y * advance;
    remaining -= advance;

    const rx = Math.round(ghost.pos.x);
    const ry = Math.round(ghost.pos.y);
    if (Math.abs(ghost.pos.x - rx) < 1e-4) {
      ghost.pos.x = ((rx % cols) + cols) % cols;
    }
    if (Math.abs(ghost.pos.y - ry) < 1e-4) {
      ghost.pos.y = ry;
    }
    ghost.state.tile = nearestTile(ghost.pos, cols);
  }
}
