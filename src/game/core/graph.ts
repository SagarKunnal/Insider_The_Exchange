import {
  ALL_DIRS,
  DIR_DELTA,
  OPPOSITE_DIR,
  getNeighbors,
  isGhostWalkableCell,
  isPlayerWalkableCell,
  tileKey,
} from './maze';
import type { CorridorDef, Direction, JunctionDef, MazeDef, RelativeTurn, TileCoord, Vec2 } from './types';

export function getRelativeTurn(entryDir: Direction, exitDir: Direction): RelativeTurn {
  if (exitDir === entryDir) return 'S';
  if (exitDir === OPPOSITE_DIR[entryDir]) return 'U';
  const order: Direction[] = ['N', 'E', 'S', 'W'];
  const idx = order.indexOf(entryDir);
  if (order[(idx + 1) % 4] === exitDir) return 'R';
  return 'L';
}

export class MazeGraph {
  readonly maze: MazeDef;
  private readonly junctionByTile = new Map<string, JunctionDef>();
  private readonly junctionById = new Map<number, JunctionDef>();
  private readonly corridorById = new Map<string, CorridorDef>();
  private readonly tileToCorridor = new Map<string, CorridorDef>();
  private readonly distanceCache = new Map<string, number>();

  constructor(maze: MazeDef) {
    this.maze = maze;
    for (const j of maze.junctions) {
      this.junctionByTile.set(tileKey(j.tile.x, j.tile.y), j);
      this.junctionById.set(j.id, j);
    }
    for (const c of maze.corridors) {
      this.corridorById.set(c.id, c);
      for (const t of c.tiles) {
        this.tileToCorridor.set(tileKey(t.x, t.y), c);
      }
    }
  }

  getJunctionAt(tile: TileCoord): JunctionDef | undefined {
    return this.junctionByTile.get(tileKey(tile.x, tile.y));
  }

  getJunctionById(id: number): JunctionDef | undefined {
    return this.junctionById.get(id);
  }

  getCorridorById(id: string): CorridorDef | undefined {
    return this.corridorById.get(id);
  }

  getCorridorAtTile(tile: TileCoord): CorridorDef | undefined {
    return this.tileToCorridor.get(tileKey(tile.x, tile.y));
  }

  isWalkable(tile: TileCoord, allowDen = false): boolean {
    if (tile.y < 0 || tile.y >= this.maze.rows || tile.x < 0 || tile.x >= this.maze.cols) {
      return false;
    }
    const cell = this.maze.grid[tile.y][tile.x];
    return allowDen ? isGhostWalkableCell(cell, true) : isPlayerWalkableCell(cell);
  }

  stepTile(tile: TileCoord, dir: Direction, allowDen = false): TileCoord | null {
    const nbs = getNeighbors(this.maze.grid, tile, allowDen);
    return nbs.find((n) => n.dir === dir)?.tile ?? null;
  }

  getExits(tile: TileCoord, allowDen = false): Direction[] {
    return getNeighbors(this.maze.grid, tile, allowDen).map((n) => n.dir);
  }

  /**
   * Shortest path distance in grid tiles (BFS with tunnel wrap).
   */
  pathDistance(from: TileCoord, to: TileCoord, allowDen = false): number {
    if (from.x === to.x && from.y === to.y) return 0;
    const key = `${from.x},${from.y}->${to.x},${to.y}:${allowDen ? 1 : 0}`;
    const cached = this.distanceCache.get(key);
    if (cached !== undefined) return cached;

    const visited = new Set<string>([tileKey(from.x, from.y)]);
    const queue: Array<{ t: TileCoord; d: number }> = [{ t: from, d: 0 }];
    let head = 0;

    while (head < queue.length) {
      const curr = queue[head++];
      for (const nb of getNeighbors(this.maze.grid, curr.t, allowDen)) {
        const nk = tileKey(nb.tile.x, nb.tile.y);
        if (visited.has(nk)) continue;
        const nd = curr.d + 1;
        if (nb.tile.x === to.x && nb.tile.y === to.y) {
          this.distanceCache.set(key, nd);
          return nd;
        }
        visited.add(nk);
        queue.push({ t: nb.tile, d: nd });
      }
    }
    return Number.POSITIVE_INFINITY;
  }

  /**
   * Next direction along shortest path from `from` to `to`, respecting optional no-reverse direction.
   * Deterministic tie-break: N, E, S, W order (phase.md Phase 2 risk mitigation).
   */
  nextStepToward(
    from: TileCoord,
    to: TileCoord,
    forbiddenDir: Direction | null,
    allowDen = false,
  ): Direction {
    const nbs = getNeighbors(this.maze.grid, from, allowDen);
    if (nbs.length === 0) return 'N';

    const candidates = nbs.filter((n) => n.dir !== forbiddenDir);
    const pool = candidates.length > 0 ? candidates : nbs;

    let bestDir = pool[0].dir;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const dir of ALL_DIRS) {
      const cand = pool.find((c) => c.dir === dir);
      if (!cand) continue;
      const d = this.pathDistance(cand.tile, to, allowDen);
      if (d < bestDist) {
        bestDist = d;
        bestDir = cand.dir;
      }
    }

    return bestDir;
  }

  /**
   * Projects N tiles ahead of a tile along `dir`, clamping at walls.
   */
  projectAhead(start: TileCoord, dir: Direction, tiles: number): TileCoord {
    let curr = { ...start };
    for (let i = 0; i < tiles; i += 1) {
      const next = this.stepTile(curr, dir, false);
      if (!next) break;
      curr = next;
    }
    return curr;
  }

  /**
   * Euclidean wrapped distance in tiles between two continuous coordinates.
   */
  continuousDistance(a: Vec2, b: Vec2): number {
    let dx = Math.abs(a.x - b.x);
    if (dx > this.maze.cols / 2) {
      dx = this.maze.cols - dx;
    }
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  /**
   * Traces forward along a corridor from a junction exit to the next junction.
   */
  getNextJunctionFrom(
    junctionId: number,
    exitDir: Direction,
  ): { junction: JunctionDef; entryDir: Direction; corridorId: string; length: number } | null {
    const j = this.getJunctionById(junctionId);
    if (!j) return null;
    const corridorId = j.corridorByDir[exitDir];
    if (!corridorId) return null;
    const corridor = this.getCorridorById(corridorId);
    if (!corridor) return null;
    const otherId = corridor.a === junctionId ? corridor.b : corridor.a;
    const other = this.getJunctionById(otherId);
    if (!other) return null;
    const entryDir =
      ALL_DIRS.find((d) => other.corridorByDir[d] === corridorId && (otherId !== junctionId || d !== exitDir)) ??
      OPPOSITE_DIR[exitDir];
    return {
      junction: other,
      entryDir,
      corridorId,
      length: corridor.length,
    };
  }

  /**
   * Returns a direction vector for continuous movement.
   */
  static dirVector(dir: Direction): Vec2 {
    return DIR_DELTA[dir];
  }
}
