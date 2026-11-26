import {
  AMBUSH_CONFIDENCE_THRESHOLD,
  AMBUSH_RELAXED_THRESHOLD,
  AMBUSH_RELAX_TIME_S,
  WARM_START_DECISIONS,
  WARM_START_STAGE0_MAX_S,
} from '../../data/tuning';

export interface PacingMilestones {
  firstTrailAtS?: number;
  firstCalloutAtS?: number;
  firstAmbushAtS?: number;
  thresholdRelaxedAtS?: number;
}

/**
 * Adaptation Pacing (C-10): manages warm-start Stage 0 cutoff,
 * 75 s ambush threshold relaxation, and milestone tracking.
 */
export class PacingTracker {
  readonly milestones: PacingMilestones = {};
  private ambushThreshold = AMBUSH_CONFIDENCE_THRESHOLD;
  private decisionCount = 0;

  onDecision(): void {
    this.decisionCount += 1;
  }

  isWarmStartActive(): boolean {
    return this.decisionCount < WARM_START_DECISIONS;
  }

  isStage0Forced(elapsedS: number): boolean {
    return this.decisionCount < WARM_START_DECISIONS && elapsedS < WARM_START_STAGE0_MAX_S;
  }

  recordFirstTrail(t: number): void {
    if (this.milestones.firstTrailAtS === undefined) {
      this.milestones.firstTrailAtS = t;
    }
  }

  recordFirstCallout(t: number): void {
    if (this.milestones.firstCalloutAtS === undefined) {
      this.milestones.firstCalloutAtS = t;
    }
  }

  recordFirstAmbush(t: number): void {
    if (this.milestones.firstAmbushAtS === undefined) {
      this.milestones.firstAmbushAtS = t;
    }
  }

  update(elapsedS: number, hasEligibleAmbushCandidate: boolean): void {
    if (
      this.milestones.firstAmbushAtS === undefined &&
      this.milestones.thresholdRelaxedAtS === undefined &&
      elapsedS >= AMBUSH_RELAX_TIME_S &&
      hasEligibleAmbushCandidate
    ) {
      this.ambushThreshold = AMBUSH_RELAXED_THRESHOLD;
      this.milestones.thresholdRelaxedAtS = elapsedS;
    }
  }

  getAmbushThreshold(): number {
    return this.ambushThreshold;
  }

  getDecisionCount(): number {
    return this.decisionCount;
  }
}
