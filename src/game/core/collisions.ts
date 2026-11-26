import type { MazeGraph } from './graph';
import type { TileCoord, Vec2 } from './types';

export const CAPTURE_RADIUS_TILES = 0.55;

export function isCaptureCollision(graph: MazeGraph, playerPos: Vec2, ghostPos: Vec2): boolean {
  return graph.continuousDistance(playerPos, ghostPos) <= CAPTURE_RADIUS_TILES;
}

export function nearestTile(pos: Vec2, cols: number): TileCoord {
  const rx = Math.round(pos.x);
  const wx = ((rx % cols) + cols) % cols;
  return { x: wx, y: Math.round(pos.y) };
}
