import { FIXED_DT_S } from '../data/tuning';
import { nearestTile } from '../game/core/collisions';
import { EventBus } from '../game/core/eventBus';
import { SeededRng } from '../game/core/rng';
import { createWorld, queueWorldInput, stepWorld, type WorldState } from '../game/core/world';
import { chooseBotDirection, type BotPolicyId } from './bots';

export interface SimulationOptions {
  policy: BotPolicyId;
  durationS: number;
  seed?: number;
  invulnerable?: boolean;
}

export interface SimulationResult {
  world: WorldState;
  entropyAtEnd: number;
  decisionsCount: number;
  capturesCount: number;
  recalibrationCount: number;
  patternBreakCount: number;
  softlockDetected: boolean;
  debugJson: string;
}

export function runBotSimulation(options: SimulationOptions): SimulationResult {
  const seed = options.seed ?? 2026;
  const rng = new SeededRng(seed + 99);
  const bus = new EventBus();
  const world = createWorld(seed, `sim-${options.policy}-${seed}`);

  let capturesCount = 0;
  let recalibrationCount = 0;
  let patternBreakCount = 0;
  let softlockDetected = false;

  bus.on('capture', () => {
    capturesCount += 1;
  });
  bus.on('recalibrate-start', () => {
    recalibrationCount += 1;
  });
  bus.on('pattern-break', () => {
    patternBreakCount += 1;
  });

  const totalSteps = Math.round(options.durationS / FIXED_DT_S);
  let lastTileKey = '';

  for (let i = 0; i < totalSteps; i += 1) {
    if (world.ended) break;
    if (options.invulnerable) {
      world.player.invulnUntilT = world.elapsedS + 10;
    }

    const pt = nearestTile(world.player.pos, world.maze.cols);
    const exits = world.graph.getExits(pt, false);
    if (exits.length === 0) {
      softlockDetected = true;
      break;
    }

    const tk = `${pt.x},${pt.y}`;
    if (tk !== lastTileKey || !world.player.moving) {
      lastTileKey = tk;
      const dir = chooseBotDirection(options.policy, world, rng);
      if (dir) {
        queueWorldInput(world, dir);
      }
    }

    stepWorld(world, FIXED_DT_S, bus);
  }

  return {
    world,
    entropyAtEnd: world.entropy,
    decisionsCount: world.recorder.decisions.length,
    capturesCount,
    recalibrationCount,
    patternBreakCount,
    softlockDetected,
    debugJson: world.recorder.exportDebugJson({
      runId: world.runId,
      round: world.round,
      score: world.score,
      durationS: world.elapsedS,
    }),
  };
}
