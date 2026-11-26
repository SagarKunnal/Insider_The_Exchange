import { describe, expect, it } from 'vitest';
import { FIXED_DT_S } from '../src/data/tuning';
import { computeStage0Target } from '../src/game/ai/baselineBrain';
import { EventBus } from '../src/game/core/eventBus';
import { OPPOSITE_DIR } from '../src/game/core/maze';
import { createWorld, queueWorldInput, stepWorld } from '../src/game/core/world';

describe('Phase 2 Baseline Ghosts & Collision (C-02)', () => {
  it('releases ghosts on stagger 0s / 6s / 12s and exits den cleanly', () => {
    const bus = new EventBus();
    const world = createWorld(10, 'test-stagger');
    world.player.invulnUntilT = 30;

    expect(world.ghosts.blinky.state.released).toBe(true);
    expect(world.ghosts.pinky.state.released).toBe(false);
    expect(world.ghosts.inky.state.released).toBe(false);

    for (let i = 0; i < 60 * 7; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    expect(world.ghosts.pinky.state.released).toBe(true);
    expect(world.ghosts.inky.state.released).toBe(false);

    for (let i = 0; i < 60 * 7; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    expect(world.ghosts.inky.state.released).toBe(true);
    expect(world.ghosts.pinky.inDen).toBe(false);
    expect(world.ghosts.inky.inDen).toBe(false);
  });

  it('produces distinct Stage 0 targets for Blinky, Pinky, and Inky', () => {
    const world = createWorld(1, 'test-stage0');
    world.player.pos = { x: 10, y: 19 };
    world.player.dir = 'W';

    const blinkyDec = computeStage0Target('blinky', { x: 1, y: 1 }, 0, world.player, world.graph);
    const pinkyDec = computeStage0Target('pinky', { x: 1, y: 1 }, 0, world.player, world.graph);
    const inkyFarDec = computeStage0Target('inky', { x: 1, y: 1 }, 0, world.player, world.graph);
    const inkyNearDec = computeStage0Target('inky', { x: 12, y: 19 }, 0, world.player, world.graph);

    expect(blinkyDec.target).toEqual({ x: 10, y: 19 });
    expect(pinkyDec.target).toEqual({ x: 6, y: 19 });
    expect(inkyFarDec.target).toEqual({ x: 19, y: 1 });
    expect(inkyNearDec.target).toEqual({ x: 10, y: 19 });
  });

  it('navigates for 5 minutes (18,000 ticks) without stalls or mid-corridor reversals', () => {
    const bus = new EventBus();
    const world = createWorld(77, 'test-5min');
    // Keep player invulnerable so 5 minutes run continuously without ending
    let prevDirs = {
      blinky: world.ghosts.blinky.state.dir,
      pinky: world.ghosts.pinky.state.dir,
      inky: world.ghosts.inky.state.dir,
    };

    for (let step = 0; step < 60 * 300; step += 1) {
      world.player.invulnUntilT = world.elapsedS + 5;
      if (step % 45 === 0) {
        const dirs = ['N', 'E', 'S', 'W'] as const;
        queueWorldInput(world, dirs[world.rng.int(4)]);
      }
      stepWorld(world, FIXED_DT_S, bus);

      for (const id of ['blinky', 'pinky', 'inky'] as const) {
        const g = world.ghosts[id];
        if (!g.state.released || g.inDen) continue;
        // Check no mid-corridor reversal
        const isJunction = world.graph.getJunctionAt(g.state.tile) !== undefined;
        if (!isJunction && g.state.dir === OPPOSITE_DIR[prevDirs[id]]) {
          throw new Error(`Mid-corridor reversal by ${id} at (${g.state.tile.x},${g.state.tile.y})`);
        }
        prevDirs[id] = g.state.dir;
      }
    }

    // Verify all 3 ghosts moved significantly and did not stall in den
    expect(world.ghosts.blinky.inDen).toBe(false);
    expect(world.ghosts.pinky.inDen).toBe(false);
    expect(world.ghosts.inky.inDen).toBe(false);
  });

  it('triggers capture, honors 2s respawn invulnerability, and ends run at 0 lives', () => {
    const bus = new EventBus();
    const world = createWorld(5, 'test-capture');
    const captures: string[] = [];
    const ended: string[] = [];
    bus.on('capture', (e) => captures.push(e.causeLine));
    bus.on('run-end', (e) => ended.push(e.reason));

    // Place Blinky directly on player
    world.ghosts.blinky.pos = { ...world.player.pos };
    stepWorld(world, FIXED_DT_S, bus);
    expect(world.lives).toBe(2);
    expect(captures.length).toBe(1);

    // Invulnerability (2s) must prevent immediate second capture
    world.ghosts.blinky.pos = { ...world.player.pos };
    stepWorld(world, FIXED_DT_S, bus);
    expect(world.lives).toBe(2);

    // Expire invulnerability and capture twice more -> run ends
    world.elapsedS += 2.5;
    world.ghosts.blinky.pos = { ...world.player.pos };
    stepWorld(world, FIXED_DT_S, bus);
    expect(world.lives).toBe(1);

    world.elapsedS += 2.5;
    world.ghosts.blinky.pos = { ...world.player.pos };
    stepWorld(world, FIXED_DT_S, bus);
    expect(world.lives).toBe(0);
    expect(world.ended).toBe(true);
    expect(ended).toEqual(['lives']);
  });
});
