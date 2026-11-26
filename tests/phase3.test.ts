import { describe, expect, it } from 'vitest';
import {
  CONTEXT_DECAY_FACTOR,
  FIXED_DT_S,
  LAPLACE_ALPHA,
  WARM_START_WEIGHT,
} from '../src/data/tuning';
import { runBotSimulation } from '../src/dev/habitSimulator';
import { EventBus } from '../src/game/core/eventBus';
import { MazeGraph } from '../src/game/core/graph';
import { buildMazeDef } from '../src/game/core/maze';
import { createWorld, queueWorldInput, stepWorld } from '../src/game/core/world';
import { computeConfidence } from '../src/game/memory/confidence';
import { createDriftTracker, nextRecalibrateCooldown, recordPredictionAndCheckDrift } from '../src/game/memory/drift';
import { RouteModel } from '../src/game/memory/routeModel';
import { TimingModel } from '../src/game/memory/timingModel';
import { PanicModel } from '../src/game/memory/panicModel';

describe('Phase 3 Habit Capture Engine, Models & Simulator (C-03, C-10)', () => {
  it('fires exactly one DecisionEvent per junction crossing', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-latch');
    world.player.invulnUntilT = 30;

    // Move West from (10,19) across junction (9,19) into (8,19)
    queueWorldInput(world, 'W');
    for (let i = 0; i < 20; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }

    const atJ = world.recorder.decisions.filter((d) => d.junctionId === world.graph.getJunctionAt({ x: 9, y: 19 })?.id);
    expect(atJ.length).toBe(1);
    expect(atJ[0].entryDir).toBe('W');
    expect(atJ[0].exitDir).toBe('W');
  });

  it('tags threat=true when a ghost is within 6 path-tiles and approaching', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-threat');
    world.player.invulnUntilT = 30;

    // Place Blinky 3 tiles West of junction (9,19) heading East toward player
    world.ghosts.blinky.pos = { x: 6, y: 19 };
    world.ghosts.blinky.state.tile = { x: 6, y: 19 };
    world.ghosts.blinky.state.dir = 'E';
    world.ghosts.blinky.lastDecisionTileKey = '';

    queueWorldInput(world, 'W');
    for (let i = 0; i < 18; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }

    expect(world.recorder.decisions.length).toBeGreaterThanOrEqual(1);
    expect(world.recorder.decisions[0].threat).toBe(true);
    expect(world.recorder.decisions[0].nearestGhost).toBe('blinky');
  });

  it('matches hand-computed RouteModel decay + Laplace probabilities and handles n=0 without NaN', () => {
    const maze = buildMazeDef();
    const graph = new MazeGraph(maze);
    const model = new RouteModel();
    const j = maze.junctions[0];
    const k = j.exits.length;

    // n=0 uniform fallback without NaN
    const emptyPred = model.predict(j.id, j.exits[0], graph);
    expect(Number.isNaN(emptyPred.p)).toBe(false);
    expect(emptyPred.confidence).toBe(0);
    expect(emptyPred.p).toBeCloseTo(1 / k, 5);

    const exitA = j.exits[0];
    const exitB = j.exits[1];

    // Two observations in warm start (weight=2 each)
    model.observe(
      { t: 1, junctionId: j.id, entryDir: 'N', exitDir: exitA, relTurn: 'S', dwellMs: 100, threat: false, corridorId: '' },
      graph,
    );
    model.observe(
      { t: 2, junctionId: j.id, entryDir: 'N', exitDir: exitB, relTurn: 'L', dwellMs: 100, threat: false, corridorId: '' },
      graph,
    );

    const expectedA = WARM_START_WEIGHT * CONTEXT_DECAY_FACTOR;
    const expectedB = WARM_START_WEIGHT;
    const expectedN = expectedA + expectedB;
    const expectedPA = (expectedA + LAPLACE_ALPHA) / (expectedN + LAPLACE_ALPHA * k);
    const pred = model.predict(j.id, 'N', graph);
    expect(pred.probabilities[exitA]).toBeCloseTo(expectedPA, 5);
    expect(pred.confidence).toBeCloseTo(computeConfidence(pred.p, expectedN), 5);
  });

  it('registers TimingModel hotspots after >=3 dwells >=350ms and tracks PanicModel escapes', () => {
    const timing = new TimingModel();
    for (let i = 0; i < 3; i += 1) {
      timing.observeDecision({
        t: i * 4,
        junctionId: 2,
        entryDir: 'W',
        exitDir: 'N',
        relTurn: 'R',
        dwellMs: 420,
        threat: false,
        corridorId: 'C01',
      });
    }
    expect(timing.getHotspots().length).toBe(1);
    expect(timing.getHotspots()[0].junctionId).toBe(2);

    const panic = new PanicModel();
    for (let i = 0; i < 5; i += 1) {
      panic.observeThreatDecision(
        {
          t: i * 3,
          junctionId: 2,
          entryDir: 'W',
          exitDir: 'S',
          relTurn: 'L',
          dwellMs: 120,
          threat: true,
          corridorId: 'C02',
        },
        i + 1,
      );
    }
    const pPred = panic.predictPanicTurn();
    expect(pPred.biasedTurn).toBe('L');
    expect(pPred.p).toBeGreaterThan(0.55);
  });

  it('triggers drift detector when >=3 of 4 confident predictions miss after >=50% accuracy', () => {
    const tracker = createDriftTracker();
    let cd = 0;
    // 4 prior hits -> 100% accuracy
    for (let i = 0; i < 4; i += 1) {
      const r = recordPredictionAndCheckDrift(tracker, true, '2:W', i, cd);
      expect(r.shouldRecalibrate).toBe(false);
    }
    // 3 misses in next 4 -> triggers drift
    recordPredictionAndCheckDrift(tracker, false, '2:W', 10, cd);
    recordPredictionAndCheckDrift(tracker, false, '2:W', 11, cd);
    const hitCheck = recordPredictionAndCheckDrift(tracker, true, '2:W', 12, cd);
    expect(hitCheck.shouldRecalibrate).toBe(false);
    const trigger = recordPredictionAndCheckDrift(tracker, false, '2:W', 13, cd);
    expect(trigger.shouldRecalibrate).toBe(true);
    cd = nextRecalibrateCooldown(13);
    // Cooldown prevents immediate retrigger
    const duringCooldown = recordPredictionAndCheckDrift(tracker, false, '2:W', 15, cd);
    expect(duringCooldown.shouldRecalibrate).toBe(false);
  });

  it('yields entropy < 30 for alwaysLeft bot and > 70 for randomWalk bot after 90s', () => {
    const leftSim = runBotSimulation({ policy: 'alwaysLeft', durationS: 90, seed: 42, invulnerable: true });
    const randSim = runBotSimulation({ policy: 'randomWalk', durationS: 90, seed: 42, invulnerable: true });

    expect(leftSim.softlockDetected).toBe(false);
    expect(randSim.softlockDetected).toBe(false);
    expect(leftSim.entropyAtEnd).toBeLessThan(30);
    expect(randSim.entropyAtEnd).toBeGreaterThan(70);

    const parsed = JSON.parse(leftSim.debugJson);
    expect(parsed.decisions.length).toBe(leftSim.decisionsCount);
  });

  it('persists habit memory across life loss and Round change', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-persist');

    // Record several decisions
    queueWorldInput(world, 'W');
    for (let i = 0; i < 40; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    const decisionsBefore = world.recorder.decisions.length;
    expect(decisionsBefore).toBeGreaterThan(0);

    // Force capture (life loss)
    world.elapsedS += 3;
    world.player.invulnUntilT = 0;
    world.ghosts.blinky.pos = { ...world.player.pos };
    stepWorld(world, FIXED_DT_S, bus);
    expect(world.lives).toBe(2);
    expect(world.recorder.decisions.length).toBe(decisionsBefore);

    // Force round clear
    world.pellets = new Set(['9,19']);
    world.lanterns.clear();
    queueWorldInput(world, 'W');
    for (let i = 0; i < 15; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    expect(world.round).toBe(2);
    expect(world.recorder.decisions.length).toBeGreaterThanOrEqual(decisionsBefore);
  });
});
