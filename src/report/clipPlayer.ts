import { GHOST_CONFIG, TILE_SIZE_PX } from '../data/tuning';
import { CELL_DEN, CELL_GATE, CELL_WALL } from '../game/core/maze';
import type { MazeDef, ReplayClip, ReplayFrame } from '../game/core/types';

export type ReplaySpeed = 0.25 | 0.5 | 1;

/**
 * Positional Replay Player (ST-01): plays back captured ReplayClips
 * without re-simulation, overlaying predicted path vs actual path.
 */
export class ClipPlayer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly slab: HTMLCanvasElement;
  private readonly tilePx = 22;
  private cursor = 0;
  private speed: ReplaySpeed = 0.5;
  private playing = true;
  private accumS = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly clip: ReplayClip,
    maze: MazeDef,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Replay canvas context unavailable');
    this.ctx = ctx;

    const w = maze.cols * this.tilePx;
    const h = maze.rows * this.tilePx;
    canvas.width = w;
    canvas.height = h;
    this.slab = document.createElement('canvas');
    this.slab.width = w;
    this.slab.height = h;
    this.bakeMaze(maze);
  }

  private bakeMaze(maze: MazeDef): void {
    const sctx = this.slab.getContext('2d');
    if (!sctx) return;
    const t = this.tilePx;
    sctx.fillStyle = '#C5CFC3';
    sctx.fillRect(0, 0, this.slab.width, this.slab.height);
    for (let y = 0; y < maze.rows; y += 1) {
      for (let x = 0; x < maze.cols; x += 1) {
        const c = maze.grid[y][x];
        if (c === CELL_WALL) {
          sctx.fillStyle = '#4A5A52';
          sctx.fillRect(x * t, y * t, t, t);
        } else if (c === CELL_DEN) {
          sctx.fillStyle = 'rgba(74,90,82,0.22)';
          sctx.fillRect(x * t, y * t, t, t);
        } else if (c === CELL_GATE) {
          sctx.fillStyle = '#C28A2E';
          sctx.fillRect(x * t + 2, y * t + t * 0.4, t - 4, 3);
        }
      }
    }
    void TILE_SIZE_PX;
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
  }

  getSpeed(): ReplaySpeed {
    return this.speed;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getProgress(): number {
    if (this.clip.frames.length <= 1) return 1;
    return this.cursor / (this.clip.frames.length - 1);
  }

  seekProgress(progress01: number): void {
    const maxIdx = Math.max(0, this.clip.frames.length - 1);
    this.cursor = Math.max(0, Math.min(maxIdx, Math.round(progress01 * maxIdx)));
    this.renderCurrent();
  }

  step(dtS: number): void {
    if (!this.playing || this.clip.frames.length <= 1) return;
    this.accumS += dtS * this.speed;
    const frameInterval = 0.1; // 10 Hz clip capture
    while (this.accumS >= frameInterval) {
      this.accumS -= frameInterval;
      this.cursor = (this.cursor + 1) % this.clip.frames.length;
    }
    this.renderCurrent();
  }

  renderCurrent(): void {
    const frames = this.clip.frames;
    if (frames.length === 0) return;
    const frame: ReplayFrame = frames[Math.min(this.cursor, frames.length - 1)];
    const ctx = this.ctx;
    const t = this.tilePx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.slab, 0, 0);

    // Actual player path up to cursor in Pearl
    ctx.save();
    ctx.strokeStyle = '#FBF7EE';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= this.cursor; i += 1) {
      const f = frames[i];
      if (i > 0 && Math.abs(f.player.x - frames[i - 1].player.x) > 3) {
        ctx.moveTo((f.player.x + 0.5) * t, (f.player.y + 0.5) * t);
      } else if (i === 0) {
        ctx.moveTo((f.player.x + 0.5) * t, (f.player.y + 0.5) * t);
      } else {
        ctx.lineTo((f.player.x + 0.5) * t, (f.player.y + 0.5) * t);
      }
    }
    ctx.stroke();

    // Predicted path in dashed ghost color
    const cfg = GHOST_CONFIG[this.clip.ghostId];
    if (frame.predictedPath && frame.predictedPath.length >= 2) {
      ctx.strokeStyle = cfg.colorHex;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      frame.predictedPath.forEach((pt, idx) => {
        const px = (pt.x + 0.5) * t;
        const py = (pt.y + 0.5) * t;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Player dot
    ctx.fillStyle = '#FBF7EE';
    ctx.beginPath();
    ctx.arc((frame.player.x + 0.5) * t, (frame.player.y + 0.5) * t, t * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4A5A52';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Ghosts
    for (const g of frame.ghosts) {
      const gCfg = GHOST_CONFIG[g.id];
      ctx.fillStyle = gCfg.colorHex;
      ctx.beginPath();
      ctx.arc((g.x + 0.5) * t, (g.y + 0.5) * t, t * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
