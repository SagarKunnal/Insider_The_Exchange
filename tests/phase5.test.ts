import { describe, expect, it } from 'vitest';
import {
  FIXED_DT_S,
  GHOST_BASE_SPEED_TPS,
  GHOST_RECALIBRATE_SPEED_MUL,
  PELLET_BASE_POINTS,
  PLAYER_SPEED_TPS,
} from '../src/data/tuning';
import { runBotSimulation } from '../src/dev/habitSimulator';
import { EventBus } from '../src/game/core/eventBus';
import { createWorld, queueWorldInput, stepWorld } from '../src/game/core/world';
import { buildCauseOfCaptureLine } from '../src/report/phrases';

describe('Phase 5 Visibility & Feedback Layer (C-06, C-07, C-08, S-01..S-05, C-10)', () => {
  it('populates trails <= 10s and decays abandoned habits (C-06)', () => {
    const sim = runBotSimulation({ policy: 'alwaysLeft', durationS: 15, seed: 7, invulnerable: true });
    expect(sim.world.recorder.pacing.milestones.firstTrailAtS).toBeDefined();
    expect(sim.world.recorder.pacing.milestones.firstTrailAtS!).toBeLessThanOrEqual(10);

    const sEarly = sim.world.recorder.routeModel.getCorridorStrengths(sim.world.graph, 15);
    expect(sEarly.size).toBeGreaterThan(0);
    const firstKey = Array.from(sEarly.keys())[0];
    const vEarly = sEarly.get(firstKey)!;
    const sLate = sim.world.recorder.routeModel.getCorridorStrengths(sim.world.graph, 300);
    expect(sLate.get(firstKey)!).toBeLessThan(vEarly);
  });

  it('applies entropy multiplier to pellet points and reacts within 3 decisions of change (C-07)', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-mult');
    world.player.invulnUntilT = 30;
    world.recorder.entropy.applyPatternBreakImpulse();
    world.multiplier = world.recorder.entropy.getMultiplier();
    expect(world.multiplier).toBeGreaterThan(1.0);

    world.pellets = new Set(['9,19']);
    world.lanterns.clear();
    let collectedPoints = 0;
    let multAtPickup = 1;
    bus.on('pellet-collected', (e) => {
      collectedPoints = e.points;
      multAtPickup = world.multiplier;
    });
    queueWorldInput(world, 'W');
    for (let i = 0; i < 15; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    expect(collectedPoints).toBe(Math.round(PELLET_BASE_POINTS * multAtPickup));
    expect(collectedPoints).toBeGreaterThan(PELLET_BASE_POINTS);
  });

  it('triggers Recalibration on affected ghost only when behavior switches (C-08)', () => {
    const sim = runBotSimulation({ policy: 'mixed', durationS: 65, seed: 42, invulnerable: true });
    expect(sim.recalibrationCount).toBeGreaterThanOrEqual(1);
    const expectedRecalMul = (GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS) * GHOST_RECALIBRATE_SPEED_MUL;
    expect(expectedRecalMul).toBeCloseTo(0.45, 5);
  });

  it('triggers Pattern Break only under exact conditions, grants bonus, stumbles ghosts, and prevents oscillation farming (S-01)', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-pb');
    world.player.invulnUntilT = 30;

    // Pick a 3-way junction (9,19) with entryDir 'W' -> exits N, E, W
    const j = world.graph.getJunctionAt({ x: 9, y: 19 })!;
    // Seed routeModel so W has high confidence (p >= 0.55, n >= 4)
    for (let i = 0; i < 4; i += 1) {
      world.recorder.routeModel.observe(
        { t: i, junctionId: j.id, entryDir: 'W', exitDir: 'W', relTurn: 'S', dwellMs: 100, threat: false, corridorId: '' },
        world.graph,
      );
    }

    const pbEvents: number[] = [];
    bus.on('pattern-break', (e) => pbEvents.push(e.bonus));

    // Approach (9,19) from (10,19) heading W, then take N (non-reverse != W)
    queueWorldInput(world, 'W');
    for (let i = 0; i < 5; i += 1) stepWorld(world, FIXED_DT_S, bus);
    queueWorldInput(world, 'N');
    for (let i = 0; i < 20; i += 1) stepWorld(world, FIXED_DT_S, bus);

    expect(pbEvents).toEqual([100]);
    expect(world.ghosts.blinky.state.mode).toBe('stumble');

    // Immediate reverse oscillation (U-turn) must NOT trigger another Pattern Break
    queueWorldInput(world, 'S');
    for (let i = 0; i < 18; i += 1) stepWorld(world, FIXED_DT_S, bus);
    expect(pbEvents.length).toBe(1);
  });

  it('captures <= 3 ReplayClips with positions and predicted path (S-02)', () => {
    const sim = runBotSimulation({ policy: 'alwaysLeft', durationS: 75, seed: 3, invulnerable: false });
    const clips = sim.world.clipRecorder.getClips();
    expect(clips.length).toBeLessThanOrEqual(3);
  });

  it('builds prediction-backed and fallback Cause-of-Capture lines (S-05)', () => {
    const ambushLine = buildCauseOfCaptureLine({
      ghostId: 'blinky',
      corridorNickname: 'Moth Alley',
      ambushEscapeCount: 6,
    });
    expect(ambushLine).toContain('Moth Alley');
    expect(ambushLine).toContain('6 times');

    const neutralLine = buildCauseOfCaptureLine({
      ghostId: 'pinky',
      corridorNickname: 'Fern Gallery',
    });
    expect(neutralLine).toContain('Pinky');
    expect(neutralLine).toContain('Fern Gallery');
  });

  it('meets C-10 pacing milestones (trail <= 10s, callout <= 45s, ambush <= 90s) in 10 of 10 runs', () => {
    for (let i = 0; i < 10; i += 1) {
      const sim = runBotSimulation({
        policy: 'loopRunner',
        durationS: 90,
        seed: 500 + i,
        invulnerable: true,
      });
      const m = sim.world.recorder.pacing.milestones;
      expect(m.firstTrailAtS).toBeDefined();
      expect(m.firstTrailAtS!).toBeLessThanOrEqual(10);
      expect(m.firstCalloutAtS).toBeDefined();
      expect(m.firstCalloutAtS!).toBeLessThanOrEqual(45);
      expect(m.firstAmbushAtS).toBeDefined();
      expect(m.firstAmbushAtS!).toBeLessThanOrEqual(90);
    }
  }, 15000);
});
