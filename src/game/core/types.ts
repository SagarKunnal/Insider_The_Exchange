export type Direction = 'N' | 'E' | 'S' | 'W';
export type RelativeTurn = 'L' | 'R' | 'S' | 'U';
export type GhostId = 'pinky' | 'inky' | 'blinky';
export type GhostMode = 'chase' | 'predict' | 'ambush' | 'recalibrate' | 'stumble';
export type HabitKind = 'route' | 'timing' | 'panic';
export type ScreenId = 'title' | 'briefing' | 'playing' | 'paused' | 'autopsy' | 'replay' | 'history';

export interface TileCoord {
  x: number;
  y: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Session {
  userId: string;
  displayName: string;
}

export interface JunctionDef {
  id: number;
  tile: TileCoord;
  exits: Direction[];
  corridorByDir: Partial<Record<Direction, string>>;
}

export interface CorridorDef {
  id: string;
  nickname: string;
  a: number;
  b: number;
  tiles: TileCoord[];
  centroid: Vec2;
  length: number;
  isTunnel?: boolean;
}

export interface MazeDef {
  cols: number;
  rows: number;
  grid: number[][];
  junctions: JunctionDef[];
  corridors: CorridorDef[];
  denTile: TileCoord;
  playerSpawn: TileCoord;
  ghostSpawns: Record<GhostId, TileCoord>;
  tunnelTiles: [TileCoord, TileCoord];
  pelletTiles: TileCoord[];
  lanternTiles: TileCoord[];
}

export interface DecisionEvent {
  t: number;
  junctionId: number;
  entryDir: Direction;
  exitDir: Direction;
  relTurn: RelativeTurn;
  dwellMs: number;
  threat: boolean;
  threatDist?: number;
  nearestGhost?: GhostId;
  corridorId: string;
}

export interface ThreatEvent {
  t: number;
  ghostId: GhostId;
  distance: number;
  escapeCorridorId: string;
  survived: boolean;
  relTurn: RelativeTurn;
}

export interface HesitationEvent {
  t: number;
  junctionId: number;
  kind: 'stall' | 'dwell' | 'reversal';
  ms: number;
}

export interface CorridorStat {
  corridorId: string;
  visits: number;
  escapeVisits: number;
  lastUsedT: number;
  strength: number;
}

export interface JunctionStat {
  junctionId: number;
  counts: Partial<Record<Direction, Partial<Record<Direction, number>>>>;
  n: number;
  rawN: number;
  dwellMeanMs: number;
  dwellN: number;
  longDwellCount: number;
}

export interface GhostState {
  ghostId: GhostId;
  mode: GhostMode;
  confidence: number;
  target: TileCoord;
  speedMul: number;
  rollingHits: boolean[];
  knewAtT?: number;
  cooldowns: {
    recalibrateUntil: number;
    calloutUntil: number;
  };
  predictionLine: string;
  tile: Vec2;
  dir: Direction;
  released: boolean;
  ambushCorridorId?: string;
  ambushNode?: TileCoord;
  telegraphUntilT?: number;
  recalibrateUntilT?: number;
  stumbleUntilT?: number;
  recalibrateContextKey?: string;
}

export interface PredictionRecord {
  t: number;
  ghostId: GhostId;
  kind: HabitKind;
  context: string;
  predicted: string;
  confidence: number;
  actual?: string;
  hit?: boolean;
  consequential: boolean;
  junctionId?: number;
  corridorNickname?: string;
}

export interface PatternBreakEvent {
  t: number;
  junctionId: number;
  predictedExit: Direction;
  p: number;
  chosenExit: Direction;
  bonus: number;
}

export interface EntropySample {
  t: number;
  entropy: number;
  multiplier: number;
  eventMarker?: 'recalibrate' | 'pattern-break';
}

export interface ReplayFrame {
  t: number;
  player: Vec2;
  ghosts: Array<{
    id: GhostId;
    x: number;
    y: number;
    mode: GhostMode;
  }>;
  predictedPath?: TileCoord[];
}

export interface ReplayClip {
  clipId: string;
  ghostId: GhostId;
  confidence: number;
  score: number;
  caption: string;
  frames: ReplayFrame[];
  highlightT: number;
}

export interface AutopsyStatement {
  id: string;
  ghostId?: GhostId;
  text: string;
  stat: string;
  knewByT?: number;
  confidenceOK: boolean;
  isQuote?: boolean;
}

export interface AutopsyReport {
  runId: string;
  round: number;
  score: number;
  durationS: number;
  sufficientData: boolean;
  statements: AutopsyStatement[];
  knewBy: Partial<Record<GhostId, number>>;
  ghostHitRates: Record<GhostId, number>;
  predictabilityIndex: number;
  meanEntropy: number;
  peakMultiplier: number;
  patternBreaks: number;
  entropyTimeline: EntropySample[];
  hotspots: Array<{ junctionId: number; corridorHint: string; meanDwellMs: number; count: number }>;
  favoriteLoop?: { description: string; repeats: number };
  favoriteEscape?: { corridorId: string; nickname: string; count: number; pct: number };
  clips: ReplayClip[];
}

export interface Settings {
  sound: boolean;
  volume: number;
  trails: {
    route: boolean;
    timing: boolean;
    panic: boolean;
  };
  reducedMotion: boolean;
  colorblind: boolean;
}

export interface RunSummary {
  runId: string;
  date: string;
  score: number;
  rounds: number;
  predictabilityIndex: number;
  meanEntropy: number;
  patternBreaks: number;
}

export interface GhostMindSnapshot {
  ghostId: GhostId;
  name: string;
  epithet: string;
  specialty: string;
  mode: GhostMode;
  confidence: number;
  predictionLine: string;
  knewAtT?: number;
}

export interface HudSnapshot {
  screen: ScreenId;
  runId: string;
  elapsedS: number;
  round: number;
  score: number;
  lives: number;
  pelletsRemaining: number;
  pelletsTotal: number;
  entropy: number;
  multiplier: number;
  lanternRemainingS: number;
  ghosts: Record<GhostId, GhostMindSnapshot>;
  trails: {
    route: boolean;
    timing: boolean;
    panic: boolean;
  };
  paused: boolean;
}

export type GameEvent =
  | { type: 'decision'; payload: DecisionEvent }
  | { type: 'threat-start'; payload: { t: number; ghostId: GhostId; distance: number } }
  | { type: 'habit-locked'; payload: { t: number; ghostId: GhostId; category: HabitKind; message: string } }
  | { type: 'ambush-telegraph'; payload: { t: number; ghostId: GhostId; corridorId: string; node: TileCoord } }
  | { type: 'ambush-set'; payload: { t: number; ghostId: GhostId; corridorId: string; node: TileCoord } }
  | { type: 'recalibrate-start'; payload: { t: number; ghostId: GhostId; context: string } }
  | { type: 'pattern-break'; payload: PatternBreakEvent }
  | { type: 'capture'; payload: { t: number; ghostId: GhostId; causeLine: string; livesRemaining: number } }
  | { type: 'round-clear'; payload: { t: number; round: number; nextRound: number } }
  | { type: 'run-end'; payload: { t: number; runId: string; reason: 'lives' | 'manual' } }
  | { type: 'pellet-collected'; payload: { t: number; points: number; isLantern: boolean } };
