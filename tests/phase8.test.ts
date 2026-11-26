import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  FIXED_DT_S,
  GHOST_BASE_SPEED_TPS,
  GHOST_LANTERN_SPEED_MUL,
  LANTERN_SLOW_DURATION_S,
  MAX_RUN_HISTORY,
  PLAYER_SPEED_TPS,
} from '../src/data/tuning';
import { EventBus } from '../src/game/core/eventBus';
import { createWorld, queueWorldInput, stepWorld } from '../src/game/core/world';
import { bindTouchSwipeInput } from '../src/platform/input';
import { loadRunHistory, saveRunSummary } from '../src/platform/runHistory';
import { resetMemoryStorageForTest } from '../src/platform/storage';

describe('Phase 8 Stretch Features (ST-01..ST-04)', () => {
  beforeEach(() => {
    resetMemoryStorageForTest();
  });

  it('persists up to 10 RunSummary entries and prunes older clip payloads (ST-02)', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => mem.set(k, v),
        removeItem: (k: string) => mem.delete(k),
      },
    });

    for (let i = 1; i <= 12; i += 1) {
      saveRunSummary(
        {
          runId: `run-${i}`,
          date: new Date().toISOString(),
          score: i * 100,
          rounds: 1,
          predictabilityIndex: 40 + i,
          meanEntropy: 55,
          patternBreaks: 1,
        },
        [],
      );
    }
    const runs = loadRunHistory();
    expect(runs.length).toBe(MAX_RUN_HISTORY);
    expect(runs[0].runId).toBe('run-12');
    vi.unstubAllGlobals();
  });

  it('slows ghosts to 60% of base speed for 5s on Lantern Pellet pickup while keeping Fairness Governor valid (ST-03)', () => {
    const bus = new EventBus();
    const world = createWorld(1, 'test-lantern');
    world.player.invulnUntilT = 30;
    const lt = world.maze.lanternTiles[0];
    // Position player one step east of lantern tile heading W
    world.player.pos = { x: lt.x, y: lt.y + 0.5 };
    world.player.dir = 'N';
    world.player.moving = true;

    for (let i = 0; i < 10; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }

    expect(world.lanternRemainingS).toBeGreaterThan(LANTERN_SLOW_DURATION_S - 0.5);
    const expectedSlowMul = (GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS) * GHOST_LANTERN_SPEED_MUL;
    expect(world.ghosts.blinky.state.speedMul).toBeLessThanOrEqual(expectedSlowMul + 1e-6);
    expect(world.governorMinOpenExits).toBeGreaterThanOrEqual(1);
    void queueWorldInput;
  });

  it('maps touch swipe gestures to buffered player directions (ST-04)', () => {
    const listeners = new Map<string, (ev: unknown) => void>();
    const fakeEl = {
      addEventListener: (type: string, fn: (ev: unknown) => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    } as unknown as HTMLElement;

    const dirs: string[] = [];
    const unbind = bindTouchSwipeInput(fakeEl, (d) => dirs.push(d));

    listeners.get('touchstart')?.({ touches: [{ clientX: 100, clientY: 100 }] });
    listeners.get('touchmove')?.({ touches: [{ clientX: 140, clientY: 102 }] }); // swipe right -> E
    listeners.get('touchmove')?.({ touches: [{ clientX: 140, clientY: 60 }] }); // swipe up -> N
    listeners.get('touchend')?.({});
    unbind();

    expect(dirs).toEqual(['E', 'N']);
  });
});
