import {
  GHOST_CONFIG,
  TRAIL_PANIC_MIN_STRENGTH,
  TRAIL_ROUTE_MIN_STRENGTH,
  TRAIL_TIMING_MIN_STRENGTH,
} from '../../data/tuning';
import type { WorldState } from '../core/world';

export interface TrailVisibility {
  route: boolean;
  timing: boolean;
  panic: boolean;
}

/**
 * Three offscreen trail canvases (C-06): Route (solid ink lines),
 * Timing (pulsing hotspot rings), and Panic (escape chevron streaks).
 */
export class TrailLayers {
  private readonly routeCanvas = document.createElement('canvas');
  private readonly timingCanvas = document.createElement('canvas');
  private readonly panicCanvas = document.createElement('canvas');
  private resolutionScale = 1;
  private widthPx = 0;
  private heightPx = 0;
  private lastDrawT = -1;

  configure(widthPx: number, heightPx: number, lowQuality: boolean): void {
    const nextScale = lowQuality ? 0.5 : 1;
    if (
      this.widthPx === widthPx &&
      this.heightPx === heightPx &&
      this.resolutionScale === nextScale
    ) {
      return;
    }
    this.widthPx = widthPx;
    this.heightPx = heightPx;
    this.resolutionScale = nextScale;

    for (const c of [this.routeCanvas, this.timingCanvas, this.panicCanvas]) {
      c.width = Math.max(1, Math.round(widthPx * nextScale));
      c.height = Math.max(1, Math.round(heightPx * nextScale));
    }
    this.lastDrawT = -1;
  }

  private drawRouteLayer(world: WorldState, tilePx: number, colorblind: boolean): void {
    const ctx = this.routeCanvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(this.resolutionScale, 0, 0, this.resolutionScale, 0, 0);
    ctx.clearRect(0, 0, this.widthPx, this.heightPx);

    const strengths = world.recorder.routeModel.getCorridorStrengths(world.graph, world.elapsedS);
    const desaturate = world.ghosts.pinky.state.mode === 'recalibrate';
    ctx.strokeStyle = desaturate ? '#7C8884' : GHOST_CONFIG.pinky.colorHex;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (colorblind) {
      ctx.setLineDash([8, 4]);
    } else {
      ctx.setLineDash([]);
    }

    for (const cor of world.maze.corridors) {
      const strength = strengths.get(cor.id) ?? 0;
      if (strength < TRAIL_ROUTE_MIN_STRENGTH) continue;
      const jA = world.graph.getJunctionById(cor.a);
      const jB = world.graph.getJunctionById(cor.b);
      if (!jA || !jB) continue;

      ctx.globalAlpha = 0.15 + strength * 0.6;
      ctx.lineWidth = 2 + strength * 4;
      ctx.beginPath();
      ctx.moveTo((jA.tile.x + 0.5) * tilePx, (jA.tile.y + 0.5) * tilePx);
      if (cor.isTunnel) {
        // Tunnel spans wrap edge; draw segment tiles cleanly instead of across the whole screen
        for (const tile of cor.tiles) {
          ctx.lineTo((tile.x + 0.5) * tilePx, (tile.y + 0.5) * tilePx);
        }
      } else {
        for (const tile of cor.tiles) {
          ctx.lineTo((tile.x + 0.5) * tilePx, (tile.y + 0.5) * tilePx);
        }
        ctx.lineTo((jB.tile.x + 0.5) * tilePx, (jB.tile.y + 0.5) * tilePx);
      }
      ctx.stroke();

      if (colorblind) {
        ctx.strokeStyle = '#1F6359';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = desaturate ? '#7C8884' : GHOST_CONFIG.pinky.colorHex;
      }
    }
    ctx.restore();
  }

  private drawTimingLayer(world: WorldState, tilePx: number, colorblind: boolean): void {
    const ctx = this.timingCanvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(this.resolutionScale, 0, 0, this.resolutionScale, 0, 0);
    ctx.clearRect(0, 0, this.widthPx, this.heightPx);

    const strengths = world.recorder.timingModel.getHotspotStrengths(world.elapsedS);
    const desaturate = world.ghosts.inky.state.mode === 'recalibrate';
    const pulse = 0.5 + 0.5 * Math.sin(world.elapsedS * 4);

    for (const [jid, strength] of strengths.entries()) {
      if (strength < TRAIL_TIMING_MIN_STRENGTH) continue;
      const j = world.graph.getJunctionById(jid);
      if (!j) continue;
      const cx = (j.tile.x + 0.5) * tilePx;
      const cy = (j.tile.y + 0.5) * tilePx;

      ctx.strokeStyle = desaturate ? '#8E887B' : GHOST_CONFIG.inky.deepColorHex;
      ctx.globalAlpha = 0.22 + strength * 0.55;
      ctx.lineWidth = 1.8 + strength * 1.5;

      const r1 = tilePx * (0.35 + pulse * 0.25);
      const r2 = tilePx * (0.58 + (1 - pulse) * 0.22);
      ctx.beginPath();
      ctx.arc(cx, cy, r1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r2, 0, Math.PI * 2);
      ctx.stroke();

      if (colorblind) {
        ctx.fillStyle = GHOST_CONFIG.inky.deepColorHex;
        ctx.fillRect(cx - 2, cy - r2 - 2, 4, 4);
      }
    }
    ctx.restore();
  }

  private drawPanicLayer(world: WorldState, tilePx: number, colorblind: boolean): void {
    const ctx = this.panicCanvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(this.resolutionScale, 0, 0, this.resolutionScale, 0, 0);
    ctx.clearRect(0, 0, this.widthPx, this.heightPx);

    const strengths = world.recorder.panicModel.getCorridorStrengths(world.elapsedS);
    const desaturate = world.ghosts.blinky.state.mode === 'recalibrate';
    ctx.strokeStyle = desaturate ? '#8C7A76' : GHOST_CONFIG.blinky.colorHex;
    ctx.lineCap = 'round';

    for (const cor of world.maze.corridors) {
      const strength = strengths.get(cor.id) ?? 0;
      if (strength < TRAIL_PANIC_MIN_STRENGTH) continue;

      const cx = (cor.centroid.x + 0.5) * tilePx;
      const cy = (cor.centroid.y + 0.5) * tilePx;
      const jA = world.graph.getJunctionById(cor.a);
      const jB = world.graph.getJunctionById(cor.b);
      const angle =
        jA && jB ? Math.atan2(jB.tile.y - jA.tile.y, jB.tile.x - jA.tile.x) : 0;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.22 + strength * 0.58;
      ctx.lineWidth = colorblind ? 3 : 2 + strength * 2;

      // Draw pair of chevron streaks
      for (const offset of [-5, 4]) {
        ctx.beginPath();
        ctx.moveTo(offset - 4, -5);
        ctx.lineTo(offset + 2, 0);
        ctx.lineTo(offset - 4, 5);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  renderTo(
    targetCtx: CanvasRenderingContext2D,
    world: WorldState,
    tilePx: number,
    visibility: TrailVisibility,
    colorblind: boolean,
  ): void {
    // Redraw offscreen buffers at ~15 Hz or when elapsed advances for smooth pulses at low cost
    if (Math.abs(world.elapsedS - this.lastDrawT) >= 0.06 || this.lastDrawT < 0) {
      this.lastDrawT = world.elapsedS;
      if (visibility.route) this.drawRouteLayer(world, tilePx, colorblind);
      if (visibility.timing) this.drawTimingLayer(world, tilePx, colorblind);
      if (visibility.panic) this.drawPanicLayer(world, tilePx, colorblind);
    }

    if (visibility.route) {
      targetCtx.drawImage(this.routeCanvas, 0, 0, this.widthPx, this.heightPx);
    }
    if (visibility.timing) {
      targetCtx.drawImage(this.timingCanvas, 0, 0, this.widthPx, this.heightPx);
    }
    if (visibility.panic) {
      targetCtx.drawImage(this.panicCanvas, 0, 0, this.widthPx, this.heightPx);
    }
  }
}
