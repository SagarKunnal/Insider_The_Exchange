import { PLAYER_SPEED_TPS, RESPAWN_INVULN_S, TURN_BUFFER_MS } from '../../data/tuning';
import { DIR_DELTA, OPPOSITE_DIR } from './maze';
import type { MazeGraph } from './graph';
import type { Direction, TileCoord, Vec2 } from './types';

export interface PlayerState {
  pos: Vec2;
  prevPos: Vec2;
  dir: Direction;
  bufferedDir: Direction | null;
  bufferExpiresAtS: number;
  moving: boolean;
  invulnUntilT: number;
  lastTile: TileCoord;
  lastJunctionId: number | null;
  lastJunctionEntryDir: Direction | null;
}

export function createPlayerState(spawn: TileCoord): PlayerState {
  return {
    pos: { x: spawn.x, y: spawn.y },
    prevPos: { x: spawn.x, y: spawn.y },
    dir: 'W',
    bufferedDir: null,
    bufferExpiresAtS: 0,
    moving: false,
    invulnUntilT: 0,
    lastTile: { x: spawn.x, y: spawn.y },
    lastJunctionId: null,
    lastJunctionEntryDir: null,
  };
}

export function queuePlayerTurn(player: PlayerState, dir: Direction, nowS: number): void {
  player.bufferedDir = dir;
  player.bufferExpiresAtS = nowS + TURN_BUFFER_MS / 1000;
}

export function resetPlayerOnRespawn(player: PlayerState, spawn: TileCoord, nowS: number): void {
  player.pos = { x: spawn.x, y: spawn.y };
  player.prevPos = { x: spawn.x, y: spawn.y };
  player.dir = 'W';
  player.bufferedDir = null;
  player.bufferExpiresAtS = 0;
  player.moving = false;
  player.invulnUntilT = nowS + RESPAWN_INVULN_S;
  player.lastTile = { x: spawn.x, y: spawn.y };
}

function isAtCenter(pos: Vec2): boolean {
  return Math.abs(pos.x - Math.round(pos.x)) < 1e-4 && Math.abs(pos.y - Math.round(pos.y)) < 1e-4;
}

function wrapX(x: number, cols: number): number {
  if (x < -0.5) return x + cols;
  if (x >= cols - 0.5) return x - cols;
  return x;
}

export function stepPlayer(
  player: PlayerState,
  graph: MazeGraph,
  dtS: number,
  nowS: number,
): void {
  player.prevPos = { x: player.pos.x, y: player.pos.y };
  const cols = graph.maze.cols;

  // Discard expired turn buffer
  if (player.bufferedDir !== null && nowS > player.bufferExpiresAtS) {
    player.bufferedDir = null;
  }

  // Allow immediate mid-corridor U-turn reversal
  if (
    player.bufferedDir !== null &&
    !isAtCenter(player.pos) &&
    player.bufferedDir === OPPOSITE_DIR[player.dir]
  ) {
    player.dir = player.bufferedDir;
    player.bufferedDir = null;
    player.moving = true;
  }

  let remaining = PLAYER_SPEED_TPS * dtS;
  let guard = 0;

  while (remaining > 1e-6 && guard < 8) {
    guard += 1;

    if (isAtCenter(player.pos)) {
      const cx = ((Math.round(player.pos.x) % cols) + cols) % cols;
      const cy = Math.round(player.pos.y);
      player.pos.x = cx;
      player.pos.y = cy;
      const centerTile: TileCoord = { x: cx, y: cy };
      player.lastTile = centerTile;

      // 1. Apply buffered turn if legal
      if (player.bufferedDir !== null && graph.stepTile(centerTile, player.bufferedDir, false)) {
        player.dir = player.bufferedDir;
        player.bufferedDir = null;
        player.moving = true;
      } else if (graph.stepTile(centerTile, player.dir, false)) {
        // 2. Continue straight if player was already moving or has no pending stop
        if (!player.moving && player.bufferedDir === null) {
          break;
        }
        player.moving = true;
      } else {
        // 3. Auto-follow forced L-corner (degree 2 non-reverse exit) while moving
        const exits = graph.getExits(centerTile, false);
        const reverse = OPPOSITE_DIR[player.dir];
        const forwardExits = exits.filter((d) => d !== reverse);
        if (player.moving && exits.length === 2 && forwardExits.length === 1) {
          player.dir = forwardExits[0];
        } else {
          player.moving = false;
          break;
        }
      }
    }

    if (!player.moving) break;

    const delta = DIR_DELTA[player.dir];
    let distToNextCenter = 0;

    if (delta.x !== 0) {
      const frac = player.pos.x - Math.floor(player.pos.x);
      if (delta.x > 0) {
        distToNextCenter = frac < 1e-4 ? 1 : 1 - frac;
      } else {
        distToNextCenter = frac < 1e-4 ? 1 : frac;
      }
    } else {
      const frac = player.pos.y - Math.floor(player.pos.y);
      if (delta.y > 0) {
        distToNextCenter = frac < 1e-4 ? 1 : 1 - frac;
      } else {
        distToNextCenter = frac < 1e-4 ? 1 : frac;
      }
    }

    const advance = Math.min(remaining, distToNextCenter);
    player.pos.x = wrapX(player.pos.x + delta.x * advance, cols);
    player.pos.y = player.pos.y + delta.y * advance;
    remaining -= advance;

    // Snap cleanly when arriving at tile center
    const rx = Math.round(player.pos.x);
    const ry = Math.round(player.pos.y);
    if (Math.abs(player.pos.x - rx) < 1e-4) {
      player.pos.x = ((rx % cols) + cols) % cols;
    }
    if (Math.abs(player.pos.y - ry) < 1e-4) {
      player.pos.y = ry;
    }
  }
}
