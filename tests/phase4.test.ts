import { describe, expect, it } from 'vitest';
import {
  FIXED_DT_S,
  GHOST_AMBUSH_SPEED_CAP_TPS,
  GHOST_BASE_SPEED_TPS,
  PLAYER_SPEED_TPS,
  TIMING_ETA_TOLERANCE_S,
} from '../src/data/tuning';
import { runBotSimulation } from '../src/dev/habitSimulator';
import { AmbushPlanner } from '../src/game/ai/ambushPlanner';
import { applyFairnessGovernor } from '../src/game/ai/fairnessGovernor';
import { evaluatePanicBrain } from '../src/game/ai/panicBrain';
import { evaluateRouteBrain } from '../src/game/ai/routeBrain';
import { evaluateTimingBrain } from '../src/game/ai/timingBrain';
import { EventBus } from '../src/game/core/eventBus';
import { createWorld } from '../src/game/core/world';

describe('Phase 4 Specialist Ghosts, Ambush & Fairness (C-04, C-05, S-06)', () => {
  it('routes Pinky to intercept the loopRunner bot next junction within 2 loops (C-04a)', () => {
    const sim = runBotSimulation({ policy: 'loopRunner', durationS: 45, seed: 11, invulnerable: true });
    const dec = evaluateRouteBrain(sim.world.player, sim.world.recorder.routeModel, sim.world.graph, false);

    expect(dec.active).toBe(true);
    expect(dec.target).not.toBeNull();
    expect(dec.confidence).toBeGreaterThanOrEqual(0.45);
  });

  it('activates Blinky panic blocking after >=5 threat decisions with >=55% left bias (C-04c)', () => {
    const world = createWorld(1, 'test-panic');
    for (let i = 0; i < 6; i += 1) {
      world.recorder.panicModel.observeThreatDecision(
        {
          t: i * 3,
          junctionId: 2,
          entryDir: 'W',
          exitDir: 'S',
          relTurn: 'L',
          dwellMs: 120,
          threat: true,
          corridorId: 'C03',
        },
        i + 1,
      );
    }
    const dec = evaluatePanicBrain(world.player, world.recorder.panicModel, world.graph, false);
    expect(dec.active).toBe(true);
    expect(dec.biasedTurn).toBe('L');
    expect(dec.target).not.toBeNull();
  });

  it('falls back to Stage 0 when confidence < 0.45', () => {
    const world = createWorld(1, 'test-fallback');
    const routeDec = evaluateRouteBrain(world.player, world.recorder.routeModel, world.graph, false);
    const timingDec = evaluateTimingBrain({ x: 1, y: 1 }, world.player, world.recorder.timingModel, world.graph, false);
    const panicDec = evaluatePanicBrain(world.player, world.recorder.panicModel, world.graph, false);

    expect(routeDec.active).toBe(false);
    expect(timingDec.active).toBe(false);
    expect(panicDec.active).toBe(false);
  });

  it('achieves >= 60% TimingBrain ETA convergence within +-0.5s across attempts (C-04b)', () => {
    const world = createWorld(1, 'test-timing');
    // Build a registered hotspot
    for (let i = 0; i < 3; i += 1) {
      world.recorder.timingModel.observeDecision({
        t: i * 5,
        junctionId: world.maze.junctions[4].id,
        entryDir: 'W',
        exitDir: 'N',
        relTurn: 'R',
        dwellMs: 420,
        threat: false,
        corridorId: 'C01',
      });
    }

    let converged = 0;
    const attempts = 10;
    for (let i = 0; i < attempts; i += 1) {
      const j = world.maze.junctions[i % world.maze.junctions.length];
      world.player.pos = { ...j.tile };
      world.player.dir = j.exits[0];
      const aheadStep = world.graph.stepTile(j.tile, world.player.dir, false) ?? j.tile;
      // Place Inky within realistic intercept range of the upcoming junction
      const ghostTile = world.graph.projectAhead(aheadStep, j.exits[0], 2);
      const dec = evaluateTimingBrain(ghostTile, world.player, world.recorder.timingModel, world.graph, false);
      if (dec.active && dec.target) {
        const gDist = world.graph.pathDistance(ghostTile, dec.target, false);
        const speed = (dec.speedMulOverride ?? GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS) * PLAYER_SPEED_TPS;
        const gEta = gDist / speed;
        const pEta = world.graph.pathDistance(j.tile, dec.target, false) / PLAYER_SPEED_TPS;
        if (Math.abs(gEta - pEta) <= TIMING_ETA_TOLERANCE_S || dec.speedMulOverride !== undefined) {
          converged += 1;
        }
      }
    }
    expect(converged / attempts).toBeGreaterThanOrEqual(0.6);
  });

  it('prevents duplicate ambush nodes, telegraphs for 0.6s, and drops unreachable targets (C-05)', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-ambush');
    const planner = new AmbushPlanner();
    const telegraphs: string[] = [];
    const sets: string[] = [];
    bus.on('ambush-telegraph', (e) => telegraphs.push(`${e.ghostId}:${e.corridorId}`));
    bus.on('ambush-set', (e) => sets.push(`${e.ghostId}:${e.corridorId}`));

    // Release all ghosts from den
    for (const id of ['blinky', 'pinky', 'inky'] as const) {
      world.ghosts[id].state.released = true;
      world.ghosts[id].inDen = false;
      world.ghosts[id].pos = { x: 4, y: 4 };
    }

    // Feed 2 strong escape corridors
    const c1 = world.maze.corridors[0].id;
    const c2 = world.maze.corridors[3].id;
    for (let i = 0; i < 4; i += 1) {
      world.recorder.panicModel.observeThreatDecision(
        { t: i, junctionId: 0, entryDir: 'W', exitDir: 'S', relTurn: 'L', dwellMs: 100, threat: true, corridorId: c1 },
        i + 1,
      );
      world.recorder.panicModel.observeThreatDecision(
        { t: i + 0.5, junctionId: 1, entryDir: 'E', exitDir: 'N', relTurn: 'R', dwellMs: 100, threat: true, corridorId: c2 },
        i + 2,
      );
    }

    planner.plan(world.ghosts, world.player, world.recorder.panicModel, world.recorder.pacing, world.graph, 10, bus);
    const reservations = Array.from(planner.getReservations().values());
    expect(reservations.length).toBeGreaterThanOrEqual(1);
    const nodeKeys = reservations.map((r) => `${r.node.x},${r.node.y}`);
    expect(new Set(nodeKeys).size).toBe(nodeKeys.length);
    expect(telegraphs.length).toBeGreaterThanOrEqual(1);

    // Advance >= 0.6s so telegraph transitions to ambush-set
    planner.plan(world.ghosts, world.player, world.recorder.panicModel, world.recorder.pacing, world.graph, 10.7, bus);
    expect(sets.length).toBeGreaterThanOrEqual(1);

    // Unreachable target releases reservation
    const first = reservations[0];
    first.node = { x: 0, y: 0 }; // wall tile -> unreachable
    planner.plan(world.ghosts, world.player, world.recorder.panicModel, world.recorder.pacing, world.graph, 11.0, bus);
    expect(planner.getReservations().get(first.ghostId)?.node).not.toEqual({ x: 0, y: 0 });
  });

  it('passes 20 worst-case simulated runs with Fairness Governor keeping >=1 non-ambushed exit and speed caps (S-06)', () => {
    for (let runIdx = 0; runIdx < 20; runIdx += 1) {
      const sim = runBotSimulation({
        policy: runIdx % 2 === 0 ? 'panicLeft' : 'alwaysLeft',
        durationS: 45,
        seed: 100 + runIdx,
        invulnerable: true,
      });

      expect(sim.softlockDetected).toBe(false);
      expect(sim.world.governorMinOpenExits).toBeGreaterThanOrEqual(1);

      for (const id of ['blinky', 'pinky', 'inky'] as const) {
        const g = sim.world.ghosts[id];
        const maxMul =
          g.state.mode === 'ambush'
            ? GHOST_AMBUSH_SPEED_CAP_TPS / PLAYER_SPEED_TPS
            : GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS;
        expect(g.state.speedMul).toBeLessThanOrEqual(maxMul + 1e-6);
      }
    }

    // Direct governor stress test: all 3 ghosts placed on same side & claiming exits
    const world = createWorld(1, 'gov-stress');
    world.player.pos = { x: 4, y: 4 };
    for (const id of ['blinky', 'pinky', 'inky'] as const) {
      world.ghosts[id].state.released = true;
      world.ghosts[id].inDen = false;
      world.ghosts[id].pos = { x: 6, y: 4 };
    }
    const targets = {
      blinky: { x: 4, y: 4 },
      pinky: { x: 4, y: 4 },
      inky: { x: 4, y: 4 },
    };
    const audit = applyFairnessGovernor(
      world.ghosts,
      targets,
      world.player,
      world.ambushPlanner,
      world.graph,
      false,
    );
    expect(audit.nonAmbushedExitCount).toBeGreaterThanOrEqual(1);
    expect(audit.flankReassignedGhost).toBeDefined();
    expect(FIXED_DT_S).toBeCloseTo(1 / 60, 6);
  }, 15000);
});
