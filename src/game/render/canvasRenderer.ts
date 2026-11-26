import { ADAPTIVE_QUALITY_FPS_THRESHOLD, GHOST_CONFIG, TILE_SIZE_PX } from '../../data/tuning';
import type { GhostRuntime } from '../core/ghost';
import { CELL_DEN, CELL_GATE, CELL_WALL } from '../core/maze';
import type { GhostId } from '../core/types';
import type { WorldState } from '../core/world';
import { GhostFxManager } from './ghostFx';
import { TrailLayers, type TrailVisibility } from './trailLayers';

const COLORS = {
  sageMist: '#C5CFC3',
  mossTop: '#55655C',
  mossBottom: '#3F4E47',
  mossDeep: '#2F3D37',
  brass: '#C28A2E',
  brassLight: '#E9C277',
  pearl: '#FBF7EE',
  saffron: '#E3A73B',
  umberInk: '#2A2622',
} as const;

export interface RenderOptions {
  alpha: number;
  fps: number;
  trails: TrailVisibility;
  colorblind: boolean;
  reducedMotion: boolean;
  showDebugOverlay?: boolean;
}

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly slabCanvas: HTMLCanvasElement;
  private readonly trailLayers = new TrailLayers();
  readonly fx = new GhostFxManager();
  private readonly tilePx: number;
  private lastMode = new Map<GhostId, string>();

  constructor(private readonly canvas: HTMLCanvasElement, tilePx = TILE_SIZE_PX) {
    this.tilePx = tilePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.slabCanvas = document.createElement('canvas');
  }

  prepareMazeLayer(world: WorldState): void {
    const w = world.maze.cols * this.tilePx;
    const h = world.maze.rows * this.tilePx;
    this.canvas.width = w;
    this.canvas.height = h;
    this.slabCanvas.width = w;
    this.slabCanvas.height = h;
    this.trailLayers.configure(w, h, false);

    const sctx = this.slabCanvas.getContext('2d');
    if (!sctx) return;

    sctx.fillStyle = COLORS.sageMist;
    sctx.fillRect(0, 0, w, h);

    const grid = world.maze.grid;
    for (let y = 0; y < world.maze.rows; y += 1) {
      for (let x = 0; x < world.maze.cols; x += 1) {
        const cell = grid[y][x];
        const px = x * this.tilePx;
        const py = y * this.tilePx;

        if (cell === CELL_WALL) {
          const grad = sctx.createLinearGradient(px, py, px + this.tilePx, py + this.tilePx);
          grad.addColorStop(0, COLORS.mossTop);
          grad.addColorStop(1, COLORS.mossBottom);
          sctx.fillStyle = grad;
          sctx.fillRect(px, py, this.tilePx, this.tilePx);

          sctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          if (y > 0 && grid[y - 1][x] !== CELL_WALL) {
            sctx.fillRect(px, py, this.tilePx, 1.5);
          }
          if (x > 0 && grid[y][x - 1] !== CELL_WALL) {
            sctx.fillRect(px, py, 1.5, this.tilePx);
          }
          sctx.fillStyle = 'rgba(47, 61, 55, 0.45)';
          if (y < world.maze.rows - 1 && grid[y + 1][x] !== CELL_WALL) {
            sctx.fillRect(px, py + this.tilePx - 2, this.tilePx, 2);
          }
          if (x < world.maze.cols - 1 && grid[y][x + 1] !== CELL_WALL) {
            sctx.fillRect(px + this.tilePx - 2, py, 2, this.tilePx);
          }
        } else if (cell === CELL_DEN) {
          sctx.fillStyle = 'rgba(74, 90, 82, 0.22)';
          sctx.fillRect(px, py, this.tilePx, this.tilePx);
        } else if (cell === CELL_GATE) {
          sctx.fillStyle = COLORS.brass;
          sctx.fillRect(px + 2, py + this.tilePx * 0.42, this.tilePx - 4, 4);
        }
      }
    }

    const vig = sctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.35, w * 0.5, h * 0.5, w * 0.72);
    vig.addColorStop(0, 'rgba(251, 247, 238, 0)');
    vig.addColorStop(1, 'rgba(251, 247, 238, 0.26)');
    sctx.fillStyle = vig;
    sctx.fillRect(0, 0, w, h);
  }

  private drawGhost(
    ghost: GhostRuntime,
    elapsedS: number,
    alpha: number,
    lowQuality: boolean,
    reducedMotion: boolean,
    lanternSlow: boolean,
  ): void {
    const ctx = this.ctx;
    const t = this.tilePx;
    const id = ghost.state.ghostId;
    const cfg = GHOST_CONFIG[id];

    const prevMode = this.lastMode.get(id);
    if (prevMode !== ghost.state.mode) {
      this.lastMode.set(id, ghost.state.mode);
      if (ghost.state.mode === 'recalibrate') {
        this.fx.triggerQuestionPop(id);
      } else if (prevMode === 'recalibrate') {
        this.fx.clearQuestion(id);
      }
    }

    const gx =
      Math.abs(ghost.pos.x - ghost.prevPos.x) > 2
        ? ghost.pos.x
        : ghost.prevPos.x + (ghost.pos.x - ghost.prevPos.x) * alpha;
    const gy = ghost.prevPos.y + (ghost.pos.y - ghost.prevPos.y) * alpha;
    const cx = (gx + 0.5) * t;
    const cy = (gy + 0.5) * t;
    const r = t * 0.39;
    const wave = reducedMotion ? 0 : Math.sin(elapsedS * Math.PI * 12) * 1.6;
    const wobbleRad =
      !reducedMotion && ghost.state.mode === 'recalibrate'
        ? Math.sin(elapsedS * Math.PI * 16) * ((3 * Math.PI) / 180)
        : 0;
    const squashScale = this.fx.getGhostScale(id);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wobbleRad);
    ctx.scale(squashScale, 2 - squashScale);
    if (!ghost.state.released) {
      ctx.globalAlpha = 0.6;
    } else if (lanternSlow) {
      ctx.globalAlpha = 0.72;
    }

    if (!lowQuality) {
      const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.45);
      glow.addColorStop(0, `${cfg.colorHex}88`);
      glow.addColorStop(1, `${cfg.colorHex}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(0, -r * 0.12, r, Math.PI, 0, false);
    const baseY = r * 0.86;
    ctx.lineTo(r, baseY);

    if (cfg.hemStyle === 'rounded') {
      ctx.quadraticCurveTo(r * 0.5, baseY + 3 + wave, 0, baseY);
      ctx.quadraticCurveTo(-r * 0.5, baseY - 3 - wave, -r, baseY);
    } else if (cfg.hemStyle === 'scalloped') {
      const steps = 4;
      for (let i = steps; i > 0; i -= 1) {
        const x1 = -r + (2 * r * (i - 0.5)) / steps;
        const x2 = -r + (2 * r * (i - 1)) / steps;
        ctx.quadraticCurveTo(x1, baseY + 4 + wave * (i % 2 === 0 ? 1 : -1), x2, baseY);
      }
    } else {
      const spikes = 4;
      for (let i = spikes; i > 0; i -= 1) {
        const xm = -r + (2 * r * (i - 0.5)) / spikes;
        const x2 = -r + (2 * r * (i - 1)) / spikes;
        ctx.lineTo(xm, baseY + 4 + wave * 0.7);
        ctx.lineTo(x2, baseY - 1);
      }
    }
    ctx.closePath();

    if (lanternSlow) {
      ctx.fillStyle = 'rgba(197, 207, 195, 0.88)';
    } else {
      const bodyGrad = ctx.createLinearGradient(-r, -r, r, r);
      bodyGrad.addColorStop(0, `${cfg.colorHex}DD`);
      bodyGrad.addColorStop(1, `${cfg.deepColorHex}CC`);
      ctx.fillStyle = bodyGrad;
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 247, 238, 0.72)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Top-left specular highlight
    ctx.fillStyle = 'rgba(251, 247, 238, 0.52)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.42, r * 0.25, r * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = COLORS.pearl;
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.12, r * 0.2, 0, Math.PI * 2);
    ctx.arc(r * 0.32, -r * 0.12, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.umberInk;
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.1, r * 0.09, 0, Math.PI * 2);
    ctx.arc(r * 0.36, -r * 0.1, r * 0.09, 0, Math.PI * 2);
    ctx.fill();

    if (cfg.hemStyle === 'scalloped') {
      ctx.strokeStyle = COLORS.pearl;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.65);
      ctx.lineTo(0, -r * 0.42);
      ctx.lineTo(r * 0.18, -r * 0.42);
      ctx.stroke();
    }

    ctx.restore();

    this.fx.renderGhostQuestion(ctx, id, cx, cy, t);
  }

  render(world: WorldState, opts: RenderOptions): void {
    const { alpha, fps, trails, colorblind, reducedMotion, showDebugOverlay } = opts;
    const lowQuality = fps > 0 && fps < ADAPTIVE_QUALITY_FPS_THRESHOLD;
    this.trailLayers.configure(this.canvas.width, this.canvas.height, lowQuality);
    this.fx.step(1 / 60, reducedMotion);

    const ctx = this.ctx;
    const t = this.tilePx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.slabCanvas, 0, 0);

    // Offscreen memory trails rendered above floor and below actors (Design.md §7.3)
    this.trailLayers.renderTo(ctx, world, t, trails, colorblind);

    // Brass pellets
    for (const key of world.pellets) {
      const [xs, ys] = key.split(',');
      const cx = (Number(xs) + 0.5) * t;
      const cy = (Number(ys) + 0.5) * t;
      ctx.fillStyle = COLORS.brass;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.brassLight;
      ctx.beginPath();
      ctx.arc(cx - 0.8, cy - 0.8, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lantern pellets
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(world.elapsedS * 4);
    for (const key of world.lanterns) {
      const [xs, ys] = key.split(',');
      const cx = (Number(xs) + 0.5) * t;
      const cy = (Number(ys) + 0.5) * t;
      ctx.strokeStyle = `rgba(227, 167, 59, ${0.35 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 7 + pulse * 1.8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = COLORS.saffron;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.pearl;
      ctx.beginPath();
      ctx.arc(cx - 1.4, cy - 1.4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (showDebugOverlay) {
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.mossDeep;
      for (const j of world.maze.junctions) {
        ctx.fillText(`J${j.id}`, (j.tile.x + 0.5) * t, (j.tile.y + 0.5) * t);
      }
    }

    // Ambush telegraph rings
    for (const id of ['blinky', 'pinky', 'inky'] as const) {
      const g = world.ghosts[id];
      if (g.state.ambushNode) {
        const cfg = GHOST_CONFIG[id];
        const nx = (g.state.ambushNode.x + 0.5) * t;
        const ny = (g.state.ambushNode.y + 0.5) * t;
        const isTelegraphing =
          g.state.telegraphUntilT !== undefined && world.elapsedS < g.state.telegraphUntilT;
        const ringR =
          isTelegraphing && !reducedMotion
            ? t * (0.45 + 0.25 * Math.sin(world.elapsedS * 16))
            : t * 0.48;
        ctx.save();
        ctx.strokeStyle = cfg.colorHex;
        ctx.globalAlpha = isTelegraphing ? 0.85 : 0.35;
        ctx.lineWidth = isTelegraphing ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(nx, ny, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Player Pearl orb
    const p = world.player;
    const drawX =
      Math.abs(p.pos.x - p.prevPos.x) > 2
        ? p.pos.x
        : p.prevPos.x + (p.pos.x - p.prevPos.x) * alpha;
    const drawY = p.prevPos.y + (p.pos.y - p.prevPos.y) * alpha;
    const px = (drawX + 0.5) * t;
    const py = (drawY + 0.5) * t;

    const invulnBlink = p.invulnUntilT > world.elapsedS && Math.floor(world.elapsedS * 12) % 2 === 0;
    ctx.save();
    if (invulnBlink) ctx.globalAlpha = 0.45;

    const halo = ctx.createRadialGradient(px, py, 2, px, py, t * 0.65);
    halo.addColorStop(0, 'rgba(251, 247, 238, 0.72)');
    halo.addColorStop(1, 'rgba(251, 247, 238, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, t * 0.65, 0, Math.PI * 2);
    ctx.fill();

    if (p.moving && !reducedMotion) {
      const dx = p.pos.x - p.prevPos.x;
      const dy = p.pos.y - p.prevPos.y;
      if (Math.abs(dx) < 2) {
        ctx.fillStyle = 'rgba(251, 247, 238, 0.38)';
        ctx.beginPath();
        ctx.arc(px - dx * t * 1.6, py - dy * t * 1.6, t * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = COLORS.pearl;
    ctx.beginPath();
    ctx.arc(px, py, t * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 90, 82, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(px - t * 0.12, py - t * 0.12, t * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Ghosts
    const lanternSlow = world.lanternRemainingS > 0;
    for (const id of ['blinky', 'pinky', 'inky'] as const) {
      this.drawGhost(world.ghosts[id], world.elapsedS, alpha, lowQuality, reducedMotion, lanternSlow);
    }

    this.fx.renderOverlay(ctx, t, reducedMotion);
  }
}
