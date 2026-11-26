import {
  DWELL_FLAG_MS,
  HOTSPOT_MIN_DWELLS,
  HOTSPOT_MIN_MEAN_MS,
  PLAYER_SPEED_TPS,
} from '../../data/tuning';
import type { MazeGraph } from '../core/graph';
import type { DecisionEvent, HesitationEvent } from '../core/types';
import { computeConfidence } from './confidence';

export interface TimingJunctionStat {
  junctionId: number;
  dwellMeanMs: number;
  dwellN: number;
  longDwellCount: number;
  lastDwellT: number;
  strength: number;
}

export class TimingModel {
  private readonly corridorTraversalS = new Map<string, { meanS: number; n: number }>();
  private readonly junctionDwell = new Map<number, TimingJunctionStat>();

  observeCorridorTraversal(corridorId: string, durationS: number): void {
    if (!Number.isFinite(durationS) || durationS <= 0 || durationS > 30) return;
    const prev = this.corridorTraversalS.get(corridorId);
    if (!prev) {
      this.corridorTraversalS.set(corridorId, { meanS: durationS, n: 1 });
      return;
    }
    prev.meanS = prev.meanS * 0.75 + durationS * 0.25;
    prev.n += 1;
  }

  observeDecision(event: DecisionEvent): void {
    const stat = this.junctionDwell.get(event.junctionId) ?? {
      junctionId: event.junctionId,
      dwellMeanMs: 0,
      dwellN: 0,
      longDwellCount: 0,
      lastDwellT: event.t,
      strength: 0,
    };

    const nextN = stat.dwellN + 1;
    stat.dwellMeanMs = (stat.dwellMeanMs * stat.dwellN + event.dwellMs) / nextN;
    stat.dwellN = nextN;
    if (event.dwellMs >= DWELL_FLAG_MS) {
      stat.longDwellCount += 1;
      stat.lastDwellT = event.t;
    }
    stat.strength = Math.min(1, stat.longDwellCount / HOTSPOT_MIN_DWELLS);
    this.junctionDwell.set(event.junctionId, stat);
  }

  observeHesitation(event: HesitationEvent): void {
    if (event.kind === 'stall' || event.kind === 'dwell') {
      const stat = this.junctionDwell.get(event.junctionId);
      if (stat) {
        stat.lastDwellT = event.t;
      }
    }
  }

  estimateEtaToJunctionS(corridorId: string, remainingTiles: number, graph: MazeGraph): number {
    const cor = graph.getCorridorById(corridorId);
    const stat = this.corridorTraversalS.get(corridorId);
    if (cor && stat && stat.n >= 2 && cor.length > 0) {
      const paceTps = cor.length / Math.max(0.1, stat.meanS);
      return remainingTiles / Math.max(1, paceTps);
    }
    return remainingTiles / PLAYER_SPEED_TPS;
  }

  getHotspots(): TimingJunctionStat[] {
    const hotspots: TimingJunctionStat[] = [];
    for (const stat of this.junctionDwell.values()) {
      if (
        stat.longDwellCount >= HOTSPOT_MIN_DWELLS ||
        (stat.dwellN >= HOTSPOT_MIN_DWELLS && stat.dwellMeanMs >= HOTSPOT_MIN_MEAN_MS)
      ) {
        hotspots.push(stat);
      }
    }
    return hotspots.sort((a, b) => b.longDwellCount - a.longDwellCount || b.dwellMeanMs - a.dwellMeanMs);
  }

  getTimingConfidence(): number {
    const hotspots = this.getHotspots();
    if (hotspots.length > 0) {
      return computeConfidence(0.85, hotspots[0].longDwellCount + 3);
    }
    let maxRepeats = 0;
    for (const s of this.corridorTraversalS.values()) {
      if (s.n > maxRepeats) maxRepeats = s.n;
    }
    if (maxRepeats < 3) {
      return computeConfidence(0.4, maxRepeats);
    }
    return computeConfidence(0.75, Math.min(maxRepeats, 6));
  }

  softenJunction(junctionId: number): void {
    const stat = this.junctionDwell.get(junctionId);
    if (stat) {
      stat.longDwellCount = Math.max(0, Math.floor(stat.longDwellCount * 0.5));
      stat.strength *= 0.5;
    }
  }

  getHotspotStrengths(nowS: number): Map<number, number> {
    const map = new Map<number, number>();
    for (const [jid, stat] of this.junctionDwell.entries()) {
      if (stat.longDwellCount <= 0 && stat.dwellMeanMs < DWELL_FLAG_MS) continue;
      const ageDecay = Math.max(0.15, Math.exp(-Math.max(0, nowS - stat.lastDwellT) / 90));
      const strength = Math.min(1, (stat.longDwellCount / HOTSPOT_MIN_DWELLS) * ageDecay);
      if (strength > 0.05) {
        map.set(jid, strength);
      }
    }
    return map;
  }
}
