import { GHOST_CONFIG } from '../../data/tuning';
import type { GhostId, Vec2 } from '../core/types';
import { createCanvasSpring, stepCanvasSpring, type CanvasSpring } from './fxSprings';

interface FrostParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeS: number;
  maxLifeS: number;
  radius: number;
}

interface HaloBurst {
  x: number;
  y: number;
  progress: number;
}

export class GhostFxManager {
  private readonly questionSprings: Record<GhostId, CanvasSpring> = {
    pinky: createCanvasSpring(0, 0),
    inky: createCanvasSpring(0, 0),
    blinky: createCanvasSpring(0, 0),
  };
  private readonly stumbleSprings: Record<GhostId, CanvasSpring> = {
    pinky: createCanvasSpring(1, 1),
    inky: createCanvasSpring(1, 1),
    blinky: createCanvasSpring(1, 1),
  };
  private readonly particles: FrostParticle[] = [];
  private readonly haloBursts: HaloBurst[] = [];

  triggerQuestionPop(ghostId: GhostId): void {
    const s = this.questionSprings[ghostId];
    s.value = 0.2;
    s.velocity = 8;
    s.target = 1;
  }

  clearQuestion(ghostId: GhostId): void {
    this.questionSprings[ghostId].target = 0;
  }

  triggerPatternBreak(playerTile: Vec2): void {
    this.haloBursts.push({ x: playerTile.x, y: playerTile.y, progress: 0 });
    for (const id of ['pinky', 'inky', 'blinky'] as const) {
      const s = this.stumbleSprings[id];
      s.value = 0.88;
      s.velocity = 4;
      s.target = 1;
    }
  }

  triggerCaptureDissolve(playerTile: Vec2): void {
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18;
      const speed = 1.4 + (i % 3) * 0.7;
      this.particles.push({
        x: playerTile.x,
        y: playerTile.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifeS: 0.5,
        maxLifeS: 0.5,
        radius: 2 + (i % 2),
      });
    }
  }

  step(dtS: number, reducedMotion: boolean): void {
    for (const id of ['pinky', 'inky', 'blinky'] as const) {
      if (reducedMotion) {
        this.questionSprings[id].value = this.questionSprings[id].target;
        this.stumbleSprings[id].value = 1;
      } else {
        stepCanvasSpring(this.questionSprings[id], dtS, 'gooey');
        stepCanvasSpring(this.stumbleSprings[id], dtS, 'snappy');
      }
    }

    for (let i = this.haloBursts.length - 1; i >= 0; i -= 1) {
      this.haloBursts[i].progress += dtS * 1.6;
      if (this.haloBursts[i].progress >= 1) {
        this.haloBursts.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.x += p.vx * dtS;
      p.y += p.vy * dtS;
      p.lifeS -= dtS;
      if (p.lifeS <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  getGhostScale(ghostId: GhostId): number {
    return Math.max(0.75, Math.min(1.15, this.stumbleSprings[ghostId].value));
  }

  getQuestionScale(ghostId: GhostId): number {
    return Math.max(0, this.questionSprings[ghostId].value);
  }

  renderOverlay(ctx: CanvasRenderingContext2D, tilePx: number, reducedMotion: boolean): void {
    if (!reducedMotion) {
      for (const burst of this.haloBursts) {
        const cx = (burst.x + 0.5) * tilePx;
        const cy = (burst.y + 0.5) * tilePx;
        const r = tilePx * (0.4 + burst.progress * 2.8);
        ctx.save();
        ctx.strokeStyle = '#2F8F83';
        ctx.globalAlpha = Math.max(0, 1 - burst.progress);
        ctx.lineWidth = 3 * (1 - burst.progress) + 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const p of this.particles) {
      const cx = (p.x + 0.5) * tilePx;
      const cy = (p.y + 0.5) * tilePx;
      ctx.save();
      ctx.fillStyle = '#FBF7EE';
      ctx.globalAlpha = Math.max(0, p.lifeS / p.maxLifeS);
      ctx.beginPath();
      ctx.arc(cx, cy, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderGhostQuestion(
    ctx: CanvasRenderingContext2D,
    ghostId: GhostId,
    cx: number,
    cy: number,
    tilePx: number,
  ): void {
    const scale = this.getQuestionScale(ghostId);
    if (scale <= 0.05) return;
    ctx.save();
    ctx.translate(cx, cy - tilePx * 0.68);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FBF7EE';
    ctx.strokeStyle = GHOST_CONFIG[ghostId].deepColorHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2A2622';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 0.5);
    ctx.restore();
  }
}
