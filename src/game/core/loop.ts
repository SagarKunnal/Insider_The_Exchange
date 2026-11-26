import { FIXED_DT_MS, FIXED_DT_S, MAX_DELTA_MS } from '../../data/tuning';

export interface LoopCallbacks {
  step: (dtS: number) => void;
  render: (alpha: number, fps: number) => void;
}

/**
 * Fixed-step 60 Hz simulation loop with clamped delta and pause freezing.
 * Can also be stepped deterministically in headless tests via stepFixed().
 */
export class FixedStepLoop {
  private rafId: number | null = null;
  private lastTimestampMs: number | null = null;
  private accumulatorMs = 0;
  private paused = false;
  private running = false;
  private fpsWindowMs = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private readonly callbacks: LoopCallbacks;

  constructor(callbacks: LoopCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestampMs = null;
    this.accumulatorMs = 0;
    const tick = (nowMs: number) => {
      if (!this.running) return;
      this.onFrame(nowMs);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTimestampMs = null;
    this.accumulatorMs = 0;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    // Reset timestamp on resume so paused wall time never leaks into sim delta.
    this.lastTimestampMs = null;
    this.accumulatorMs = 0;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getFps(): number {
    return this.currentFps;
  }

  /**
   * Processes one frame timestamp; exposed for deterministic unit tests.
   */
  onFrame(nowMs: number): number {
    if (this.lastTimestampMs === null) {
      this.lastTimestampMs = nowMs;
      this.callbacks.render(0, this.currentFps);
      return 0;
    }

    const rawDelta = Math.max(0, nowMs - this.lastTimestampMs);
    this.lastTimestampMs = nowMs;

    this.fpsWindowMs += rawDelta;
    this.fpsFrames += 1;
    if (this.fpsWindowMs >= 500) {
      this.currentFps = Math.round((this.fpsFrames * 1000) / this.fpsWindowMs);
      this.fpsWindowMs = 0;
      this.fpsFrames = 0;
    }

    if (this.paused) {
      this.callbacks.render(0, this.currentFps);
      return 0;
    }

    const clampedDelta = Math.min(rawDelta, MAX_DELTA_MS);
    this.accumulatorMs += clampedDelta;

    let steps = 0;
    while (this.accumulatorMs + 1e-6 >= FIXED_DT_MS) {
      this.callbacks.step(FIXED_DT_S);
      this.accumulatorMs = Math.max(0, this.accumulatorMs - FIXED_DT_MS);
      steps += 1;
    }

    const alpha = this.accumulatorMs / FIXED_DT_MS;
    this.callbacks.render(alpha, this.currentFps);
    return steps;
  }
}
