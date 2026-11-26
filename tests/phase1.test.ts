import { describe, expect, it } from 'vitest';
import { FIXED_DT_S } from '../src/data/tuning';
import { EventBus } from '../src/game/core/eventBus';
import { MazeGraph, getRelativeTurn } from '../src/game/core/graph';
import { buildMazeDef, validateMaze } from '../src/game/core/maze';
import { createWorld, endWorldRun, queueWorldInput, stepWorld } from '../src/game/core/world';

describe('Phase 1 Maze World (C-01)', () => {
  it('passes the maze validator with 21x23 symmetry, zero dead ends, >=4 loops, tunnel, and nicknamed corridors', () => {
    const maze = buildMazeDef();
    const res = validateMaze(maze);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
    expect(res.loopCount).toBeGreaterThanOrEqual(4);
    expect(res.corridorCount).toBeGreaterThan(10);
    expect(res.junctionCount).toBeGreaterThan(10);
    expect(maze.pelletTiles.length).toBeGreaterThan(100);
    expect(maze.lanternTiles.length).toBe(4);
  });

  it('computes graph distances including tunnel wrap and relative turns', () => {
    const maze = buildMazeDef();
    const graph = new MazeGraph(maze);

    expect(graph.pathDistance({ x: 0, y: 10 }, { x: 20, y: 10 })).toBe(1);
    expect(getRelativeTurn('N', 'W')).toBe('L');
    expect(getRelativeTurn('N', 'E')).toBe('R');
    expect(getRelativeTurn('N', 'N')).toBe('S');
    expect(getRelativeTurn('N', 'S')).toBe('U');
  });

  it('executes buffered turns within 250ms and discards expired turns', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-turn');

    // Move West from spawn (10,19) to junction (9,19) where N is open
    queueWorldInput(world, 'W');
    for (let i = 0; i < 6; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    // Now ~0.4 tile away from (9,19) (100ms away) — buffer N turn
    queueWorldInput(world, 'N');
    for (let i = 0; i < 20; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    expect(world.player.dir).toBe('N');
    expect(world.player.pos.y).toBeLessThan(19);

    // Expired buffer test (> 250ms before reaching next junction)
    const world2 = createWorld(1, 'test-expire');
    queueWorldInput(world2, 'W');
    stepWorld(world2, FIXED_DT_S, bus);
    // Queue S far before any S exit exists while standing/moving, then advance > 0.3s
    queueWorldInput(world2, 'S');
    for (let i = 0; i < 20; i += 1) {
      stepWorld(world2, FIXED_DT_S, bus);
    }
    expect(world2.player.bufferedDir).toBeNull();
  });

  it('wraps cleanly through the West-East tunnel', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-tunnel');
    world.player.pos = { x: 0.4, y: 10 };
    world.player.prevPos = { x: 0.4, y: 10 };
    world.player.dir = 'W';
    world.player.moving = true;

    for (let i = 0; i < 12; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    expect(world.player.pos.x).toBeGreaterThan(18);
    expect(world.player.pos.y).toBe(10);
  });

  it('collects pellets, advances Round on clear, freezes on pause, and emits run-end', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-round');
    const cleared: number[] = [];
    const ended: string[] = [];
    bus.on('round-clear', (e) => cleared.push(e.nextRound));
    bus.on('run-end', (e) => ended.push(e.reason));

    // Leave only 1 pellet next to player at (9,19)
    world.pellets = new Set(['9,19']);
    world.lanterns.clear();

    queueWorldInput(world, 'W');
    for (let i = 0; i < 15; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }

    expect(world.score).toBeGreaterThan(0);
    expect(world.round).toBe(2);
    expect(cleared).toEqual([2]);
    expect(world.pellets.size).toBeGreaterThan(100);

    // Pause freezes simulation clock and movement
    const prevElapsed = world.elapsedS;
    const prevX = world.player.pos.x;
    world.paused = true;
    stepWorld(world, FIXED_DT_S, bus);
    expect(world.elapsedS).toBe(prevElapsed);
    expect(world.player.pos.x).toBe(prevX);

    endWorldRun(world, 'manual', bus);
    expect(ended).toEqual(['manual']);
  });
});
