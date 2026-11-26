import phrasesJson from '../data/phrases.json';
import { GHOST_CONFIG } from '../data/tuning';
import type { GhostId, HabitKind, PredictionRecord, RelativeTurn } from '../game/core/types';

export function formatTimeMMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function turnToPhrase(turn: RelativeTurn): string {
  switch (turn) {
    case 'L':
      return 'turned left';
    case 'R':
      return 'turned right';
    case 'U':
      return 'doubled back';
    case 'S':
      return 'bolted straight';
  }
}

export function buildRecognitionMessage(ghostId: GhostId, _category: HabitKind, isSpecificVariant = false): string {
  const r = phrasesJson.recognition;
  if (ghostId === 'pinky') return isSpecificVariant ? r.pinky_loop : r.pinky_route;
  if (ghostId === 'inky') return isSpecificVariant ? r.inky_hotspot : r.inky_timing;
  return isSpecificVariant ? r.blinky_escape : r.blinky_panic;
}

export function buildCauseOfCaptureLine(opts: {
  ghostId: GhostId;
  corridorNickname: string;
  ambushEscapeCount?: number;
  lastPrediction?: PredictionRecord;
}): string {
  const ghostName = GHOST_CONFIG[opts.ghostId].name;
  const cor = opts.corridorNickname || 'the glass corridor';

  if (opts.ambushEscapeCount !== undefined && opts.ambushEscapeCount >= 3) {
    return phrasesJson.capture.ambush
      .replace('{ghost}', ghostName)
      .replace('{corridor}', cor)
      .replace('{count}', String(opts.ambushEscapeCount));
  }

  const pred = opts.lastPrediction;
  if (pred && pred.confidence >= 0.45) {
    if (pred.kind === 'panic') {
      const turnWord =
        pred.predicted === 'L'
          ? 'left-turn'
          : pred.predicted === 'R'
            ? 'right-turn'
            : pred.predicted === 'U'
              ? 'U-turn'
              : 'straight';
      return phrasesJson.capture.panic
        .replace('{ghost}', ghostName)
        .replace('{turn}', turnWord)
        .replace('{corridor}', pred.corridorNickname ?? cor);
    }
    if (pred.kind === 'timing') {
      return phrasesJson.capture.timing
        .replace('{ghost}', ghostName)
        .replace('{corridor}', pred.corridorNickname ?? cor);
    }
    return phrasesJson.capture.route
      .replace('{ghost}', ghostName)
      .replace('{corridor}', pred.corridorNickname ?? cor);
  }

  return phrasesJson.capture.neutral
    .replace('{ghost}', ghostName)
    .replace('{corridor}', cor);
}
