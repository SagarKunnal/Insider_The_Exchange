import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FixedStepLoop } from '../src/game/core/loop';
import { SeededRng } from '../src/game/core/rng';
import { EventBus } from '../src/game/core/eventBus';
import { getSession } from '../src/platform/session';
import {
  readStorageJson,
  resetMemoryStorageForTest,
  writeStorageJson,
} from '../src/platform/storage';

describe('Phase 0 Foundations', () => {
  beforeEach(() => {
    resetMemoryStorageForTest();
  });

  it('provides deterministic SeededRng sequences', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('ticks FixedStepLoop at 60 Hz, clamps huge deltas, and freezes when paused', () => {
    let steps = 0;
    let renders = 0;
    const loop = new FixedStepLoop({
      step: () => {
        steps += 1;
      },
      render: () => {
        renders += 1;
      },
    });

    // Initial timestamp sets baseline
    expect(loop.onFrame(0)).toBe(0);
    // 1000 ms jump must clamp to MAX_DELTA_MS (50 ms) => 3 fixed steps at 16.6667 ms
    expect(loop.onFrame(1000)).toBe(3);
    expect(steps).toBe(3);

    // Pause freezes sim steps
    loop.setPaused(true);
    expect(loop.onFrame(1050)).toBe(0);
    expect(steps).toBe(3);

    // Resume resets baseline so paused time does not burst steps
    loop.setPaused(false);
    expect(loop.onFrame(5000)).toBe(0);
    expect(loop.onFrame(5034)).toBe(2);
    expect(steps).toBe(5);
    expect(renders).toBe(5);
  });

  it('survives blocked and corrupt localStorage safely', () => {
    // Blocked / Node environment (no window.localStorage) falls back to in-memory
    const writeOk = writeStorageJson('hby:v1:settings', { sound: false });
    expect(writeOk).toBe(false);
    const readBack = readStorageJson('hby:v1:settings', { sound: true });
    expect(readBack.value).toEqual({ sound: false });

    // Simulate corrupt localStorage JSON
    const mockStorage = {
      getItem: vi.fn(() => '{bad json'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('window', { localStorage: mockStorage });
    const corrupt = readStorageJson('hby:v1:settings', { sound: true });
    expect(corrupt.ok).toBe(false);
    expect(corrupt.value).toEqual({ sound: true });
    vi.unstubAllGlobals();
  });

  it('returns the mock guest session via getSession() (S-11)', () => {
    const session = getSession();
    expect(session).toEqual({ userId: 'guest-local', displayName: 'Guest Haunt' });
  });

  it('dispatches typed events via EventBus', () => {
    const bus = new EventBus();
    const received: number[] = [];
    const unsub = bus.on('round-clear', (p) => received.push(p.nextRound));
    bus.emit('round-clear', { t: 12, round: 1, nextRound: 2 });
    unsub();
    bus.emit('round-clear', { t: 24, round: 2, nextRound: 3 });
    expect(received).toEqual([2]);
  });
});
