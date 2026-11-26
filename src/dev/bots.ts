import { nearestTile } from '../game/core/collisions';
import type { MazeGraph } from '../game/core/graph';
import { ALL_DIRS, OPPOSITE_DIR } from '../game/core/maze';
import type { SeededRng } from '../game/core/rng';
import type { Direction } from '../game/core/types';
import type { WorldState } from '../game/core/world';

export type BotPolicyId = 'alwaysLeft' | 'loopRunner' | 'randomWalk' | 'panicLeft' | 'mixed';

function turnLeft(dir: Direction): Direction {
  const order: Direction[] = ['N', 'E', 'S', 'W'];
  return order[(order.indexOf(dir) + 3) % 4];
}

function turnRight(dir: Direction): Direction {
  const order: Direction[] = ['N', 'E', 'S', 'W'];
  return order[(order.indexOf(dir) + 1) % 4];
}

/**
 * Computes the next direction for a scripted bot policy at the player's current state.
 */
export function chooseBotDirection(
  policy: BotPolicyId,
  world: WorldState,
  rng: SeededRng,
): Direction | null {
  const graph: MazeGraph = world.graph;
  const tile = nearestTile(world.player.pos, world.maze.cols);
  const exits = graph.getExits(tile, false);
  if (exits.length === 0) return null;

  const currentDir = world.player.dir;
  const nonReverse = exits.filter((d) => d !== OPPOSITE_DIR[currentDir]);
  const options = nonReverse.length > 0 ? nonReverse : exits;

  // Check if any ghost is close for panicLeft
  const nearThreat = (['blinky', 'pinky', 'inky'] as const).some((id) => {
    const g = world.ghosts[id];
    if (!g.state.released) return false;
    return graph.pathDistance(nearestTile(g.pos, world.maze.cols), tile, false) <= 6;
  });

  if (policy === 'alwaysLeft') {
    const left = turnLeft(currentDir);
    if (options.includes(left)) return left;
    if (options.includes(currentDir)) return currentDir;
    return options[0];
  }

  if (policy === 'loopRunner') {
    // Runs a tight clockwise loop by preferring right turn at every junction
    const right = turnRight(currentDir);
    if (options.includes(right)) return right;
    if (options.includes(currentDir)) return currentDir;
    return options[0];
  }

  if (policy === 'panicLeft') {
    if (nearThreat) {
      const left = turnLeft(currentDir);
      if (options.includes(left)) return left;
    }
    return rng.pick(options);
  }

  if (policy === 'mixed') {
    // Switch from alwaysLeft to alwaysRight at 45s to trigger Drift & Recalibration
    if (world.elapsedS < 45) {
      const left = turnLeft(currentDir);
      if (options.includes(left)) return left;
      if (options.includes(currentDir)) return currentDir;
      return options[0];
    }
    const right = turnRight(currentDir);
    if (options.includes(right)) return right;
    if (options.includes(currentDir)) return currentDir;
    return options[0];
  }

  // randomWalk: pick uniformly across available exits at junctions (occasional reversal at junctions only)
  const isJunction = graph.getJunctionAt(tile) !== undefined;
  if (!isJunction) {
    return options.includes(currentDir) ? currentDir : options[0];
  }
  const allPool = rng.next() < 0.15 ? exits : options;
  return rng.pick(allPool.length > 0 ? allPool : ALL_DIRS);
}
