import {
  AMBUSH_MIN_N,
  AMBUSH_TELEGRAPH_S,
  GHOST_BASE_SPEED_TPS,
  PLAYER_SPEED_TPS,
} from '../../data/tuning';
import { nearestTile } from '../core/collisions';
import type { EventBus } from '../core/eventBus';
import type { GhostRuntime } from '../core/ghost';
import type { MazeGraph } from '../core/graph';
import { tileKey } from '../core/maze';
import type { PlayerState } from '../core/player';
import type { GhostId, TileCoord } from '../core/types';
import type { PacingTracker } from '../memory/pacing';
import type { PanicModel } from '../memory/panicModel';

export interface AmbushReservation {
  ghostId: GhostId;
  corridorId: string;
  node: TileCoord;
  confidence: number;
  telegraphStartedAtS: number;
  activeAtS: number;
}

export interface AmbushLogEntry {
  t: number;
  ghostId: GhostId;
  corridorId: string;
  nickname: string;
  node: TileCoord;
}

const PRIORITY_ORDER: readonly GhostId[] = ['blinky', 'pinky', 'inky'];

export class AmbushPlanner {
  private readonly reservations = new Map<GhostId, AmbushReservation>();
  readonly ambushLog: AmbushLogEntry[] = [];

  getReservations(): ReadonlyMap<GhostId, AmbushReservation> {
    return this.reservations;
  }

  releaseGhost(ghostId: GhostId, ghosts: Record<GhostId, GhostRuntime>): void {
    this.reservations.delete(ghostId);
    const g = ghosts[ghostId];
    g.state.ambushCorridorId = undefined;
    g.state.ambushNode = undefined;
    g.state.telegraphUntilT = undefined;
    if (g.state.mode === 'ambush') {
      g.state.mode = 'chase';
      g.state.speedMul = GHOST_BASE_SPEED_TPS / PLAYER_SPEED_TPS;
    }
  }

  plan(
    ghosts: Record<GhostId, GhostRuntime>,
    player: PlayerState,
    panicModel: PanicModel,
    pacing: PacingTracker,
    graph: MazeGraph,
    nowS: number,
    bus: EventBus,
  ): void {
    const playerTile = nearestTile(player.pos, graph.maze.cols);
    const candidates = panicModel.getEscapeCandidates();
    const hasEligible = candidates.some((c) => c.rawCount >= AMBUSH_MIN_N);
    pacing.update(nowS, hasEligible);

    const threshold = pacing.getAmbushThreshold();
    const eligible = candidates.filter((c) => c.rawCount >= AMBUSH_MIN_N && c.confidence >= threshold);

    // Clear reservations whose confidence dropped or whose target became unreachable
    for (const [gid, res] of this.reservations.entries()) {
      const stillValid = eligible.some((c) => c.corridorId === res.corridorId);
      const g = ghosts[gid];
      const reachable =
        g.state.released &&
        !g.inDen &&
        Number.isFinite(graph.pathDistance(nearestTile(g.pos, graph.maze.cols), res.node, false));

      if (!stillValid || !reachable || g.state.mode === 'recalibrate' || g.state.mode === 'stumble') {
        this.releaseGhost(gid, ghosts);
      }
    }

    if (eligible.length === 0) return;

    const reservedNodeKeys = new Set<string>();
    const reservedCorridors = new Set<string>();
    for (const res of this.reservations.values()) {
      reservedNodeKeys.add(tileKey(res.node.x, res.node.y));
      reservedCorridors.add(res.corridorId);
    }

    for (const candidate of eligible) {
      if (reservedCorridors.has(candidate.corridorId)) continue;
      const cor = graph.getCorridorById(candidate.corridorId);
      if (!cor) continue;
      const jA = graph.getJunctionById(cor.a);
      const jB = graph.getJunctionById(cor.b);
      if (!jA || !jB) continue;

      // Pick the corridor exit node farther from the player (where the player would emerge)
      const dA = graph.pathDistance(playerTile, jA.tile, false);
      const dB = graph.pathDistance(playerTile, jB.tile, false);
      const ambushNode = dA >= dB ? jA.tile : jB.tile;
      const nodeKey = tileKey(ambushNode.x, ambushNode.y);
      if (reservedNodeKeys.has(nodeKey)) continue;

      // Pick highest-priority available ghost (Panic -> Route -> Timing)
      const ghostId = PRIORITY_ORDER.find((gid) => {
        const g = ghosts[gid];
        if (!g.state.released || g.inDen) return false;
        if (g.state.mode === 'recalibrate' || g.state.mode === 'stumble') return false;
        if (this.reservations.has(gid)) return false;
        return Number.isFinite(graph.pathDistance(nearestTile(g.pos, graph.maze.cols), ambushNode, false));
      });
      if (!ghostId) continue;

      const reservation: AmbushReservation = {
        ghostId,
        corridorId: cor.id,
        node: ambushNode,
        confidence: candidate.confidence,
        telegraphStartedAtS: nowS,
        activeAtS: nowS + AMBUSH_TELEGRAPH_S,
      };
      this.reservations.set(ghostId, reservation);
      reservedNodeKeys.add(nodeKey);
      reservedCorridors.add(cor.id);

      const g = ghosts[ghostId];
      g.state.mode = 'ambush';
      g.state.ambushCorridorId = cor.id;
      g.state.ambushNode = ambushNode;
      g.state.telegraphUntilT = reservation.activeAtS;
      g.state.confidence = Math.max(g.state.confidence, candidate.confidence);
      g.state.predictionLine = `Holding ${cor.nickname} exit.`;

      pacing.recordFirstAmbush(nowS);
      this.ambushLog.push({
        t: nowS,
        ghostId,
        corridorId: cor.id,
        nickname: cor.nickname,
        node: ambushNode,
      });

      bus.emit('ambush-telegraph', {
        t: nowS,
        ghostId,
        corridorId: cor.id,
        node: ambushNode,
      });
    }

    // Transition telegraphed ambushes to active hold after 0.6s
    for (const res of this.reservations.values()) {
      const g = ghosts[res.ghostId];
      if (g.state.telegraphUntilT !== undefined && nowS >= res.activeAtS) {
        g.state.telegraphUntilT = undefined;
        bus.emit('ambush-set', {
          t: nowS,
          ghostId: res.ghostId,
          corridorId: res.corridorId,
          node: res.node,
        });
      }
    }
  }
}
