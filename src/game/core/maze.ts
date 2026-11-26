import mazeJson from '../../data/maze.json';
import corridorData from '../../data/corridors.json';
import { GRID_COLS, GRID_ROWS } from '../../data/tuning';
import type { CorridorDef, Direction, JunctionDef, MazeDef, TileCoord } from './types';

export const CELL_WALL = 1;
export const CELL_FLOOR = 0;
export const CELL_DEN = 2;
export const CELL_GATE = 3;

export const ALL_DIRS: readonly Direction[] = ['N', 'E', 'S', 'W'];

export const DIR_DELTA: Record<Direction, TileCoord> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export const OPPOSITE_DIR: Record<Direction, Direction> = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E',
};

export interface MazeValidationResult {
  valid: boolean;
  errors: string[];
  loopCount: number;
  walkableCount: number;
  corridorCount: number;
  junctionCount: number;
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function wrapTile(x: number, y: number, cols = GRID_COLS): TileCoord {
  const wx = ((x % cols) + cols) % cols;
  return { x: wx, y };
}

export function isPlayerWalkableCell(cell: number): boolean {
  return cell === CELL_FLOOR;
}

export function isGhostWalkableCell(cell: number, allowDen: boolean): boolean {
  if (cell === CELL_FLOOR) return true;
  if (allowDen && (cell === CELL_DEN || cell === CELL_GATE)) return true;
  return false;
}

export function getNeighbors(
  grid: number[][],
  tile: TileCoord,
  allowDen = false,
): Array<{ dir: Direction; tile: TileCoord }> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const result: Array<{ dir: Direction; tile: TileCoord }> = [];

  for (const dir of ALL_DIRS) {
    const d = DIR_DELTA[dir];
    const ny = tile.y + d.y;
    if (ny < 0 || ny >= rows) continue;
    let nx = tile.x + d.x;
    if (nx < 0 || nx >= cols) {
      // Horizontal wrap only at tunnel edges when both endpoints are walkable
      if (tile.x === 0 && dir === 'W' && isPlayerWalkableCell(grid[ny][cols - 1])) {
        nx = cols - 1;
      } else if (tile.x === cols - 1 && dir === 'E' && isPlayerWalkableCell(grid[ny][0])) {
        nx = 0;
      } else {
        continue;
      }
    }
    const cell = grid[ny][nx];
    if (allowDen ? isGhostWalkableCell(cell, true) : isPlayerWalkableCell(cell)) {
      result.push({ dir, tile: { x: nx, y: ny } });
    }
  }
  return result;
}

export function buildMazeDef(): MazeDef {
  const rows = mazeJson.rows;
  const cols = mazeJson.cols;
  const grid: number[][] = [];
  const pelletTiles: TileCoord[] = [];
  const lanternTiles: TileCoord[] = [];

  for (let y = 0; y < rows; y += 1) {
    const rowStr = mazeJson.layout[y];
    const row: number[] = [];
    for (let x = 0; x < cols; x += 1) {
      const ch = rowStr[x];
      if (ch === '#') {
        row.push(CELL_WALL);
      } else if (ch === 'G') {
        row.push(CELL_DEN);
      } else if (ch === 'D') {
        row.push(CELL_GATE);
      } else {
        row.push(CELL_FLOOR);
        if (ch === '.') {
          pelletTiles.push({ x, y });
        } else if (ch === 'L') {
          lanternTiles.push({ x, y });
        }
      }
    }
    grid.push(row);
  }

  // Extract junctions (every player-walkable tile with >= 3 neighbors)
  const junctions: JunctionDef[] = [];
  const junctionByTile = new Map<string, JunctionDef>();

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!isPlayerWalkableCell(grid[y][x])) continue;
      const neighbors = getNeighbors(grid, { x, y }, false);
      if (neighbors.length >= 3) {
        const j: JunctionDef = {
          id: junctions.length,
          tile: { x, y },
          exits: neighbors.map((n) => n.dir),
          corridorByDir: {},
        };
        junctions.push(j);
        junctionByTile.set(tileKey(x, y), j);
      }
    }
  }

  // Extract corridors between junctions by walking each exit edge once
  const visitedEdges = new Set<string>();
  const corridors: CorridorDef[] = [];
  let nicknameIdx = 0;

  for (const jA of junctions) {
    for (const startDir of jA.exits) {
      const edgeKey = `${jA.id}:${startDir}`;
      if (visitedEdges.has(edgeKey)) continue;

      const tiles: TileCoord[] = [];
      let prevTile: TileCoord = jA.tile;
      const firstStep = getNeighbors(grid, jA.tile, false).find((n) => n.dir === startDir);
      if (!firstStep) continue;

      let currTile: TileCoord = firstStep.tile;
      let currEntryFromDir: Direction = OPPOSITE_DIR[startDir];
      let touchesTunnel = false;

      if (
        (prevTile.x === 0 && currTile.x === cols - 1) ||
        (prevTile.x === cols - 1 && currTile.x === 0)
      ) {
        touchesTunnel = true;
      }

      // Walk along degree-2 tiles until reaching the next junction
      let guard = 0;
      while (!junctionByTile.has(tileKey(currTile.x, currTile.y)) && guard < 200) {
        guard += 1;
        tiles.push(currTile);
        if (currTile.x === 0 || currTile.x === cols - 1) {
          touchesTunnel = true;
        }
        const nbs = getNeighbors(grid, currTile, false);
        const next = nbs.find((n) => n.dir !== currEntryFromDir) ?? nbs[0];
        if (!next) break;
        if (
          (currTile.x === 0 && next.tile.x === cols - 1) ||
          (currTile.x === cols - 1 && next.tile.x === 0)
        ) {
          touchesTunnel = true;
        }
        prevTile = currTile;
        currTile = next.tile;
        currEntryFromDir = OPPOSITE_DIR[next.dir];
      }

      const jB = junctionByTile.get(tileKey(currTile.x, currTile.y));
      if (!jB) continue;

      visitedEdges.add(`${jA.id}:${startDir}`);
      visitedEdges.add(`${jB.id}:${currEntryFromDir}`);

      const id = `C${String(corridors.length + 1).padStart(2, '0')}`;
      const nickname = touchesTunnel
        ? corridorData.tunnelNickname
        : corridorData.nicknames[nicknameIdx++ % corridorData.nicknames.length];

      const allSegmentTiles = tiles.length > 0 ? tiles : [jA.tile, jB.tile];
      const cx = allSegmentTiles.reduce((sum, t) => sum + t.x, 0) / allSegmentTiles.length;
      const cy = allSegmentTiles.reduce((sum, t) => sum + t.y, 0) / allSegmentTiles.length;

      corridors.push({
        id,
        nickname,
        a: jA.id,
        b: jB.id,
        tiles: allSegmentTiles,
        centroid: { x: cx, y: cy },
        length: tiles.length + 1,
        isTunnel: touchesTunnel,
      });

      jA.corridorByDir[startDir] = id;
      jB.corridorByDir[currEntryFromDir] = id;
    }
  }

  return {
    cols,
    rows,
    grid,
    junctions,
    corridors,
    denTile: mazeJson.denTile,
    playerSpawn: mazeJson.playerSpawn,
    ghostSpawns: mazeJson.ghostSpawns,
    tunnelTiles: mazeJson.tunnelTiles as [TileCoord, TileCoord],
    pelletTiles,
    lanternTiles,
  };
}

export function validateMaze(maze: MazeDef): MazeValidationResult {
  const errors: string[] = [];

  if (maze.cols !== GRID_COLS || maze.rows !== GRID_ROWS) {
    errors.push(`Expected ${GRID_COLS}x${GRID_ROWS}, got ${maze.cols}x${maze.rows}`);
  }

  // Left-right symmetry check
  for (let y = 0; y < maze.rows; y += 1) {
    for (let x = 0; x < maze.cols; x += 1) {
      const mirror = maze.grid[y][maze.cols - 1 - x];
      if (maze.grid[y][x] !== mirror) {
        errors.push(`Asymmetry at (${x},${y})`);
      }
    }
  }

  // Walkable tiles, dead ends, edge count for cyclomatic loop count
  const walkableKeys = new Set<string>();
  let edgeDoubleCount = 0;

  for (let y = 0; y < maze.rows; y += 1) {
    for (let x = 0; x < maze.cols; x += 1) {
      if (!isPlayerWalkableCell(maze.grid[y][x])) continue;
      walkableKeys.add(tileKey(x, y));
      const nbs = getNeighbors(maze.grid, { x, y }, false);
      edgeDoubleCount += nbs.length;
      if (nbs.length < 2) {
        errors.push(`Dead end at (${x},${y}) with ${nbs.length} exits`);
      }
    }
  }

  // Connectivity BFS from player spawn
  const visited = new Set<string>();
  const queue: TileCoord[] = [maze.playerSpawn];
  visited.add(tileKey(maze.playerSpawn.x, maze.playerSpawn.y));

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const nb of getNeighbors(maze.grid, curr, false)) {
      const k = tileKey(nb.tile.x, nb.tile.y);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push(nb.tile);
      }
    }
  }

  if (visited.size !== walkableKeys.size) {
    errors.push(`Maze not fully connected: reached ${visited.size} of ${walkableKeys.size} tiles`);
  }

  // Cyclomatic complexity E - V + 1
  const edges = edgeDoubleCount / 2;
  const loopCount = edges - walkableKeys.size + 1;
  if (loopCount < 4) {
    errors.push(`Expected >= 4 loops, got ${loopCount}`);
  }

  // Tunnel check
  const [tA, tB] = maze.tunnelTiles;
  if (!isPlayerWalkableCell(maze.grid[tA.y][tA.x]) || !isPlayerWalkableCell(maze.grid[tB.y][tB.x])) {
    errors.push('Tunnel endpoints must be walkable');
  }

  // Den gate check
  let hasGate = false;
  let hasDen = false;
  for (let y = 0; y < maze.rows; y += 1) {
    for (let x = 0; x < maze.cols; x += 1) {
      if (maze.grid[y][x] === CELL_GATE) hasGate = true;
      if (maze.grid[y][x] === CELL_DEN) hasDen = true;
    }
  }
  if (!hasDen || !hasGate) {
    errors.push('Central ghost den and gate required');
  }

  // Corridor ID and nickname checks
  const seenIds = new Set<string>();
  for (const c of maze.corridors) {
    if (!c.id || !c.nickname || c.nickname.trim().length === 0) {
      errors.push(`Corridor missing id or nickname: ${JSON.stringify(c)}`);
    }
    if (seenIds.has(c.id)) {
      errors.push(`Duplicate corridor id: ${c.id}`);
    }
    seenIds.add(c.id);
  }

  return {
    valid: errors.length === 0,
    errors,
    loopCount,
    walkableCount: walkableKeys.size,
    corridorCount: maze.corridors.length,
    junctionCount: maze.junctions.length,
  };
}
