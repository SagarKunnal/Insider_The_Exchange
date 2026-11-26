import {
  GHOST_BASE_SPEED_TPS,
  GHOST_RECALIBRATE_SPEED_MUL,
  PLAYER_SPEED_TPS,
  RECALIBRATE_DURATION_S,
} from '../../data/tuning';
import type { EventBus } from '../core/eventBus';
import type { GhostRuntime } from '../core/ghost';
import type { GhostId } from '../core/types';
import {
  createDriftTracker,
  nextRecalibrateCooldown,
  recordPredictionAndCheckDrift,
  type DriftTracker,
} from '../memory/drift';
import type { HabitRecorder } from '../memory/recorder';
import type { AmbushPlanner } from './ambushPlanner';

export class RecalibrationManager {
  private readonly trackers: Record<GhostId, DriftTracker> = {
    pinky: createDriftTracker(),
    inky: createDriftTracker(),
    blinky: createDriftTracker(),
  };

  evaluatePrediction(
    ghost: GhostRuntime,
    hit: boolean,
    contextKey: string,
    nowS: number,
    ambushPlanner: AmbushPlanner,
    ghosts: Record<GhostId, GhostRuntime>,
    recorder: HabitRecorder,
    bus: EventBus,
  ): boolean {
    const id = ghost.state.ghostId;
    const tracker = this.trackers[id];
    const check = recordPredictionAndCheckDrift(
      tracker,
      hit,
      contextKey,
      nowS,
      ghost.state.cooldowns.recalibrateUntil,
    );

    if (!check.shouldRecalibrate) return false;

    ghost.state.mode = 'recalibrate';
    ghost.state.recalibrateUntilT = nowS + RECALIBRATE_DURATION_S;
    ghost.state.recalibrateContextKey = contextKey;
    ghost.state.cooldowns.recalibrateUntil = nextRecalibrateCooldown(nowS);
    ghost.state.speedMul = (GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS) * GHOST_RECALIBRATE_SPEED_MUL;
    ghost.state.predictionLine = 'Recalibrating — losing the thread…';

    if (ambushPlanner.getReservations().has(id)) {
      ambushPlanner.releaseGhost(id, ghosts);
    }

    recorder.entropy.markRecalibration();
    bus.emit('recalibrate-start', { t: nowS, ghostId: id, context: contextKey });
    return true;
  }

  stepRecalibrations(
    ghosts: Record<GhostId, GhostRuntime>,
    recorder: HabitRecorder,
    nowS: number,
  ): void {
    for (const id of ['pinky', 'inky', 'blinky'] as const) {
      const g = ghosts[id];
      if (g.state.mode !== 'recalibrate') continue;

      g.state.speedMul = (GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS) * GHOST_RECALIBRATE_SPEED_MUL;
      if (g.state.recalibrateUntilT !== undefined && nowS >= g.state.recalibrateUntilT) {
        // Soften affected memory after recalibration finishes (C-08)
        if (id === 'pinky' && g.state.recalibrateContextKey) {
          recorder.routeModel.softenContext(g.state.recalibrateContextKey);
        } else if (id === 'inky' && g.state.recalibrateContextKey?.startsWith('timing:')) {
          const jid = Number(g.state.recalibrateContextKey.slice(7));
          if (Number.isFinite(jid)) recorder.timingModel.softenJunction(jid);
        } else if (id === 'blinky') {
          recorder.panicModel.softenPanic();
        }
        g.state.mode = 'chase';
        g.state.recalibrateUntilT = undefined;
        g.state.recalibrateContextKey = undefined;
      }
    }
  }
}
