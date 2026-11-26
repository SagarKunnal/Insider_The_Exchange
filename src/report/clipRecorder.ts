import {
  CLIP_AFTER_S,
  CLIP_BEFORE_S,
  CLIP_BUFFER_HZ,
  CLIP_MAX_PER_RUN,
  CLIP_PROXIMITY_TILES,
  CLIP_WINDOW_S,
  GHOST_CONFIG,
} from '../data/tuning';
import { nearestTile } from '../game/core/collisions';
import type { GhostId, PredictionRecord, ReplayClip, ReplayFrame, TileCoord } from '../game/core/types';
import type { WorldState } from '../game/core/world';

interface PendingTag {
  clipId: string;
  ghostId: GhostId;
  confidence: number;
  consequence: number;
  caption: string;
  highlightT: number;
  finalizeAtT: number;
  predictedPath?: TileCoord[];
}

/**
 * 10 Hz positional ring buffer + strong-prediction clip capture (S-02).
 * Keeps up to 3 top-ranked clips per run (4s before, 1s after).
 */
export class ClipRecorder {
  private readonly ringBuffer: ReplayFrame[] = [];
  private readonly clips: ReplayClip[] = [];
  private readonly pendingFinalizations: PendingTag[] = [];
  private readonly watchedPredictions: Array<{
    pred: PredictionRecord;
    expiresAtT: number;
  }> = [];
  private lastSampleT = -1;
  private clipSeq = 0;

  onPrediction(pred: PredictionRecord): void {
    if (pred.confidence >= 0.45 && pred.hit) {
      this.watchedPredictions.push({
        pred,
        expiresAtT: pred.t + CLIP_WINDOW_S,
      });
    }
  }

  onCapture(world: WorldState, ghostId: GhostId, caption: string): void {
    const lastPred = [...world.recorder.predictions].reverse().find((p) => p.ghostId === ghostId);
    const conf = lastPred?.confidence ?? Math.max(0.5, world.ghosts[ghostId].state.confidence);
    const jTile =
      lastPred?.junctionId !== undefined
        ? world.graph.getJunctionById(lastPred.junctionId)?.tile
        : nearestTile(world.player.pos, world.maze.cols);
    const predictedPath = jTile ? [jTile, world.ghosts[ghostId].state.target] : undefined;

    this.scheduleClip({
      ghostId,
      confidence: conf,
      consequence: 2.0,
      caption,
      highlightT: world.elapsedS,
      predictedPath,
    });
  }

  step(world: WorldState): void {
    const interval = 1 / CLIP_BUFFER_HZ;
    if (this.lastSampleT < 0 || world.elapsedS - this.lastSampleT >= interval) {
      this.lastSampleT = world.elapsedS;
      const frame: ReplayFrame = {
        t: world.elapsedS,
        player: { x: world.player.pos.x, y: world.player.pos.y },
        ghosts: (['blinky', 'pinky', 'inky'] as const).map((id) => ({
          id,
          x: world.ghosts[id].pos.x,
          y: world.ghosts[id].pos.y,
          mode: world.ghosts[id].state.mode,
        })),
      };
      this.ringBuffer.push(frame);

      const cutoff = world.elapsedS - (CLIP_BEFORE_S + 2.0);
      while (this.ringBuffer.length > 0 && this.ringBuffer[0].t < cutoff) {
        this.ringBuffer.shift();
      }
    }

    // Check watched confident prediction hits for proximity <= 3 tiles within 2s
    for (let i = this.watchedPredictions.length - 1; i >= 0; i -= 1) {
      const item = this.watchedPredictions[i];
      if (world.elapsedS > item.expiresAtT) {
        this.watchedPredictions.splice(i, 1);
        continue;
      }
      const g = world.ghosts[item.pred.ghostId];
      const dist = world.graph.continuousDistance(world.player.pos, g.pos);
      if (dist <= CLIP_PROXIMITY_TILES) {
        const cfg = GHOST_CONFIG[item.pred.ghostId];
        const loc = item.pred.corridorNickname ?? 'the crossing';
        const pct = Math.round(item.pred.confidence * 100);
        const caption = `${cfg.name} read your move at ${loc}. ${pct}% sure.`;
        const jTile =
          item.pred.junctionId !== undefined
            ? world.graph.getJunctionById(item.pred.junctionId)?.tile
            : undefined;
        this.scheduleClip({
          ghostId: item.pred.ghostId,
          confidence: item.pred.confidence,
          consequence: 1.2,
          caption,
          highlightT: world.elapsedS,
          predictedPath: jTile ? [jTile, g.state.target] : undefined,
        });
        this.watchedPredictions.splice(i, 1);
      }
    }

    // Finalize pending clips after 1s post-window
    for (let i = this.pendingFinalizations.length - 1; i >= 0; i -= 1) {
      const p = this.pendingFinalizations[i];
      if (world.elapsedS >= p.finalizeAtT) {
        this.finalizeClip(p);
        this.pendingFinalizations.splice(i, 1);
      }
    }
  }

  flushPending(): void {
    while (this.pendingFinalizations.length > 0) {
      const p = this.pendingFinalizations.shift()!;
      this.finalizeClip(p);
    }
  }

  private scheduleClip(opts: {
    ghostId: GhostId;
    confidence: number;
    consequence: number;
    caption: string;
    highlightT: number;
    predictedPath?: TileCoord[];
  }): void {
    // Avoid overlapping duplicate clips within 2.5s
    if (
      this.pendingFinalizations.some((p) => Math.abs(p.highlightT - opts.highlightT) < 2.5) ||
      this.clips.some((c) => Math.abs(c.highlightT - opts.highlightT) < 2.5)
    ) {
      return;
    }

    this.clipSeq += 1;
    this.pendingFinalizations.push({
      clipId: `clip-${this.clipSeq}`,
      ghostId: opts.ghostId,
      confidence: opts.confidence,
      consequence: opts.consequence,
      caption: opts.caption,
      highlightT: opts.highlightT,
      finalizeAtT: opts.highlightT + CLIP_AFTER_S,
      predictedPath: opts.predictedPath,
    });
  }

  private finalizeClip(tag: PendingTag): void {
    const startT = tag.highlightT - CLIP_BEFORE_S;
    const endT = tag.highlightT + CLIP_AFTER_S;
    const frames = this.ringBuffer
      .filter((f) => f.t >= startT && f.t <= endT)
      .map((f) => ({
        ...f,
        predictedPath: tag.predictedPath,
      }));

    if (frames.length === 0) return;

    const clip: ReplayClip = {
      clipId: tag.clipId,
      ghostId: tag.ghostId,
      confidence: tag.confidence,
      score: tag.confidence * tag.consequence,
      caption: tag.caption,
      frames,
      highlightT: tag.highlightT,
    };

    this.clips.push(clip);
    this.clips.sort((a, b) => b.score - a.score);
    if (this.clips.length > CLIP_MAX_PER_RUN) {
      this.clips.length = CLIP_MAX_PER_RUN;
    }
  }

  getClips(): ReplayClip[] {
    return [...this.clips];
  }
}
