import {
  CONFIDENCE_ACT_THRESHOLD,
  PANIC_BIAS_THRESHOLD,
  PANIC_MIN_THREAT_DECISIONS,
} from '../../data/tuning';
import { nearestTile } from '../core/collisions';
import type { MazeGraph } from '../core/graph';
import { OPPOSITE_DIR } from '../core/maze';
import type { PlayerState } from '../core/player';
import type { Direction, RelativeTurn, TileCoord } from '../core/types';
import type { PanicModel } from '../memory/panicModel';

export interface PanicBrainDecision {
  active: boolean;
  target: TileCoord | null;
  confidence: number;
  predictionLine: string;
  biasedTurn?: RelativeTurn;
}

function applyRelativeTurn(entryDir: Direction, rel: RelativeTurn): Direction {
  const order: Direction[] = ['N', 'E', 'S', 'W'];
  const idx = order.indexOf(entryDir);
  if (rel === 'S') return entryDir;
  if (rel === 'U') return OPPOSITE_DIR[entryDir];
  if (rel === 'R') return order[(idx + 1) % 4];
  return order[(idx + 3) % 4];
}

export function evaluatePanicBrain(
  player: PlayerState,
  panicModel: PanicModel,
  graph: MazeGraph,
  forceStage0: boolean,
): PanicBrainDecision {
  const pred = panicModel.predictPanicTurn();
  if (
    forceStage0 ||
    pred.rawN < PANIC_MIN_THREAT_DECISIONS ||
    pred.p < PANIC_BIAS_THRESHOLD ||
    pred.confidence < CONFIDENCE_ACT_THRESHOLD
  ) {
    return {
      active: false,
      target: null,
      confidence: pred.confidence,
      predictionLine: 'Watching how you flinch under pressure…',
    };
  }

  const playerTile = nearestTile(player.pos, graph.maze.cols);
  // Find nearest junction ahead of player
  let j = graph.getJunctionAt(playerTile);
  let approachDir = player.dir;
  if (!j) {
    let curr = playerTile;
    for (let i = 0; i < 10; i += 1) {
      const next = graph.stepTile(curr, approachDir, false);
      if (!next) break;
      curr = next;
      const cand = graph.getJunctionAt(curr);
      if (cand) {
        j = cand;
        break;
      }
    }
  }

  const biasedExit = applyRelativeTurn(approachDir, pred.biasedTurn);
  const anchor = j ? j.tile : playerTile;
  // Target 2 tiles along the biased escape side to physically block that turn
  const blockTarget = graph.projectAhead(anchor, biasedExit, 2);

  const turnWord =
    pred.biasedTurn === 'L'
      ? 'turn left'
      : pred.biasedTurn === 'R'
        ? 'turn right'
        : pred.biasedTurn === 'U'
          ? 'double back'
          : 'bolt straight';

  return {
    active: true,
    target: blockTarget,
    confidence: pred.confidence,
    predictionLine: `Blocking your panic ${turnWord} (${Math.round(pred.p * 100)}%).`,
    biasedTurn: pred.biasedTurn,
  };
}
