import { GHOST_CONFIG } from '../data/tuning';
import { createWorld, type WorldState } from '../game/core/world';
import type { AutopsyReport, HudSnapshot, ReplayClip, RunSummary } from '../game/core/types';

/**
 * Realistic fixtures representing a mid-run state (with a recalibrating ghost),
 * a full Habit Autopsy, and a replay clip for automated inspection & UI verification.
 */
export function createMidRunInspectFixture(): {
  world: WorldState;
  snapshot: HudSnapshot;
} {
  const world = createWorld(42, 'inspect-midrun');
  world.round = 2;
  world.score = 1840;
  world.lives = 2;
  world.elapsedS = 84;
  world.entropy = 68;
  world.multiplier = 2.4;

  // Populate realistic memory trails across corridors & hotspots
  for (let i = 0; i < 6; i += 1) {
    const j = world.maze.junctions[i % world.maze.junctions.length];
    const ex = j.exits[0];
    const cid = j.corridorByDir[ex] ?? 'C01';
    world.recorder.routeModel.observe(
      {
        t: 10 + i * 5,
        junctionId: j.id,
        entryDir: j.exits[1] ?? ex,
        exitDir: ex,
        relTurn: 'L',
        dwellMs: 140,
        threat: i % 2 === 0,
        corridorId: cid,
      },
      world.graph,
    );
    if (i < 4) {
      world.recorder.timingModel.observeDecision({
        t: 20 + i * 8,
        junctionId: world.maze.junctions[2].id,
        entryDir: 'W',
        exitDir: 'N',
        relTurn: 'R',
        dwellMs: 460,
        threat: false,
        corridorId: cid,
      });
      world.recorder.panicModel.observeThreatDecision(
        {
          t: 25 + i * 9,
          junctionId: j.id,
          entryDir: 'W',
          exitDir: 'S',
          relTurn: 'L',
          dwellMs: 180,
          threat: true,
          corridorId: world.maze.corridors[1].id,
        },
        i + 1,
      );
    }
  }

  // Pinky actively Recalibrating, Inky Predicting, Blinky Ambushing
  world.ghosts.pinky.state.released = true;
  world.ghosts.pinky.inDen = false;
  world.ghosts.pinky.pos = { x: 6, y: 6 };
  world.ghosts.pinky.state.mode = 'recalibrate';
  world.ghosts.pinky.state.confidence = 0.62;
  world.ghosts.pinky.state.recalibrateUntilT = 85.4;
  world.ghosts.pinky.state.predictionLine = 'Recalibrating — losing the thread…';

  world.ghosts.inky.state.released = true;
  world.ghosts.inky.inDen = false;
  world.ghosts.inky.pos = { x: 14, y: 8 };
  world.ghosts.inky.state.mode = 'predict';
  world.ghosts.inky.state.confidence = 0.74;
  world.ghosts.inky.state.predictionLine = 'Lurking near your stall spot at Fern Gallery.';

  world.ghosts.blinky.state.released = true;
  world.ghosts.blinky.inDen = false;
  world.ghosts.blinky.pos = { x: 4, y: 15 };
  world.ghosts.blinky.state.mode = 'ambush';
  world.ghosts.blinky.state.confidence = 0.81;
  world.ghosts.blinky.state.ambushNode = { x: 4, y: 13 };
  world.ghosts.blinky.state.telegraphUntilT = 84.5;
  world.ghosts.blinky.state.predictionLine = 'Holding Moth Alley exit.';

  const snapshot: HudSnapshot = {
    screen: 'playing',
    runId: world.runId,
    elapsedS: world.elapsedS,
    round: world.round,
    score: world.score,
    lives: world.lives,
    pelletsRemaining: 118,
    pelletsTotal: world.pelletsTotal,
    entropy: world.entropy,
    multiplier: world.multiplier,
    lanternRemainingS: 0,
    trails: { route: true, timing: true, panic: true },
    paused: false,
    ghosts: {
      pinky: {
        ghostId: 'pinky',
        name: GHOST_CONFIG.pinky.name,
        epithet: GHOST_CONFIG.pinky.epithet,
        specialty: GHOST_CONFIG.pinky.specialty,
        mode: 'recalibrate',
        confidence: 0.62,
        predictionLine: 'Recalibrating — losing the thread…',
      },
      inky: {
        ghostId: 'inky',
        name: GHOST_CONFIG.inky.name,
        epithet: GHOST_CONFIG.inky.epithet,
        specialty: GHOST_CONFIG.inky.specialty,
        mode: 'predict',
        confidence: 0.74,
        predictionLine: 'Lurking near your stall spot at Fern Gallery.',
      },
      blinky: {
        ghostId: 'blinky',
        name: GHOST_CONFIG.blinky.name,
        epithet: GHOST_CONFIG.blinky.epithet,
        specialty: GHOST_CONFIG.blinky.specialty,
        mode: 'ambush',
        confidence: 0.81,
        predictionLine: 'Holding Moth Alley exit.',
      },
    },
  };

  return { world, snapshot };
}

export function createFullAutopsyFixture(): {
  report: AutopsyReport;
  previousRun: RunSummary;
  clip: ReplayClip;
} {
  const clip: ReplayClip = {
    clipId: 'clip-fixture-1',
    ghostId: 'pinky',
    confidence: 0.74,
    score: 1.48,
    caption: 'Pinky expected you to turn left at Lantern Row. 74% sure.',
    highlightT: 64,
    frames: Array.from({ length: 24 }, (_, idx) => ({
      t: 60 + idx * 0.1,
      player: { x: 4 + idx * 0.25, y: 13 },
      ghosts: [
        { id: 'pinky', x: 10 - idx * 0.15, y: 13, mode: 'predict' },
        { id: 'inky', x: 14, y: 8 + idx * 0.1, mode: 'chase' },
        { id: 'blinky', x: 4, y: 17 - idx * 0.12, mode: 'ambush' },
      ],
      predictedPath: [
        { x: 9, y: 13 },
        { x: 9, y: 14 },
        { x: 9, y: 15 },
      ],
    })),
  };

  const report: AutopsyReport = {
    runId: 'fixture-autopsy-01',
    round: 3,
    score: 4280,
    durationS: 172,
    sufficientData: true,
    statements: [
      {
        id: 'panic-turn',
        ghostId: 'blinky',
        text: 'When scared you turned left 71% of the time.',
        stat: '71% across 14 threats',
        knewByT: 124,
        confidenceOK: true,
        isQuote: true,
      },
      {
        id: 'favorite-escape',
        ghostId: 'blinky',
        text: 'Your favorite escape was Moth Alley (6 times).',
        stat: '6 escapes (43%)',
        knewByT: 124,
        confidenceOK: true,
        isQuote: true,
      },
      {
        id: 'hesitation-hotspot',
        ghostId: 'inky',
        text: 'You hesitated 4 times at the crossing near Lantern Row (avg 490 ms).',
        stat: '490 ms avg',
        knewByT: 88,
        confidenceOK: true,
        isQuote: true,
      },
      {
        id: 'favorite-loop',
        ghostId: 'pinky',
        text: 'You repeated the same 4-junction loop 3 times until Pinky waited ahead.',
        stat: '3× repeated',
        knewByT: 42,
        confidenceOK: true,
        isQuote: true,
      },
    ],
    knewBy: { pinky: 42, inky: 88, blinky: 124 },
    ghostHitRates: { pinky: 76, inky: 61, blinky: 68 },
    predictabilityIndex: 69,
    meanEntropy: 47,
    peakMultiplier: 2.6,
    patternBreaks: 4,
    entropyTimeline: [
      { t: 0, entropy: 50, multiplier: 2.0 },
      { t: 20, entropy: 34, multiplier: 1.7 },
      { t: 40, entropy: 22, multiplier: 1.4 },
      { t: 60, entropy: 58, multiplier: 2.2, eventMarker: 'pattern-break' },
      { t: 80, entropy: 74, multiplier: 2.5, eventMarker: 'recalibrate' },
      { t: 100, entropy: 44, multiplier: 1.9 },
      { t: 120, entropy: 28, multiplier: 1.6 },
      { t: 140, entropy: 66, multiplier: 2.3, eventMarker: 'pattern-break' },
      { t: 160, entropy: 52, multiplier: 2.0 },
    ],
    hotspots: [{ junctionId: 4, corridorHint: 'Lantern Row', meanDwellMs: 490, count: 4 }],
    favoriteLoop: { description: '4-junction loop', repeats: 3 },
    favoriteEscape: { corridorId: 'C02', nickname: 'Moth Alley', count: 6, pct: 43 },
    clips: [clip],
  };

  const previousRun: RunSummary = {
    runId: 'fixture-prev',
    date: new Date().toISOString(),
    score: 3100,
    rounds: 2,
    predictabilityIndex: 76,
    meanEntropy: 39,
    patternBreaks: 2,
  };

  return { report, previousRun, clip };
}
