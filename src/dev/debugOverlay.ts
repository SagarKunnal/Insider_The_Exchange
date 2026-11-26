import type { WorldState } from '../game/core/world';

/**
 * Formats a concise debug readout and JSON export helper for dev inspection (C-03 AC).
 */
export function buildDebugSummary(world: WorldState): string {
  const milestones = world.recorder.pacing.milestones;
  return [
    `Run: ${world.runId} | Round ${world.round} | t=${world.elapsedS.toFixed(1)}s`,
    `Decisions: ${world.recorder.decisions.length} | Threats: ${world.recorder.threats.length} | Hesitations: ${world.recorder.hesitations.length}`,
    `Entropy: ${world.entropy.toFixed(1)} (${world.multiplier.toFixed(2)}x)`,
    `Milestones: trail=${milestones.firstTrailAtS?.toFixed(1) ?? '-'}s, callout=${milestones.firstCalloutAtS?.toFixed(1) ?? '-'}s, ambush=${milestones.firstAmbushAtS?.toFixed(1) ?? '-'}s`,
  ].join('\n');
}

export function exportWorldDebugJson(world: WorldState): string {
  return world.recorder.exportDebugJson({
    runId: world.runId,
    round: world.round,
    score: world.score,
    durationS: world.elapsedS,
  });
}
