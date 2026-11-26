export const GRID_COLS = 21;
export const GRID_ROWS = 23;
export const TILE_SIZE_PX = 28;

export const FIXED_DT_S = 1 / 60;
export const FIXED_DT_MS = 1000 / 60;
export const MAX_DELTA_MS = 50;
export const UI_SNAPSHOT_HZ = 10;
export const UI_SNAPSHOT_INTERVAL_S = 1 / UI_SNAPSHOT_HZ;

export const PLAYER_SPEED_TPS = 6.0;
export const GHOST_BASE_SPEED_TPS = 5.4;
export const GHOST_AMBUSH_SPEED_CAP_TPS = 5.7;
export const GHOST_RECALIBRATE_SPEED_MUL = 0.5;
export const GHOST_LANTERN_SPEED_MUL = 0.6;
export const LANTERN_SLOW_DURATION_S = 5.0;

export const TURN_BUFFER_MS = 250;
export const RESPAWN_INVULN_S = 2.0;
export const INITIAL_LIVES = 3;
export const PELLET_BASE_POINTS = 10;
export const LANTERN_PELLET_POINTS = 50;

export const GHOST_RELEASE_TIMES_S = {
  blinky: 0,
  pinky: 6,
  inky: 12,
} as const;

export const INKY_STAGE0_CHASE_RANGE_TILES = 8;
export const PINKY_STAGE0_AHEAD_TILES = 4;

export const DECISION_ZONE_RADIUS_TILES = 0.6;
export const THREAT_DISTANCE_TILES = 6;
export const DWELL_FLAG_MS = 350;
export const STALL_FLAG_MS = 250;
export const HOTSPOT_MIN_DWELLS = 3;
export const HOTSPOT_MIN_MEAN_MS = 350;

export const LAPLACE_ALPHA = 0.5;
export const CONTEXT_DECAY_FACTOR = 0.95;
export const WARM_START_DECISIONS = 12;
export const WARM_START_WEIGHT = 2;
export const WARM_START_STAGE0_MAX_S = 25;

export const CONFIDENCE_FULL_N = 6;
export const CONFIDENCE_ACT_THRESHOLD = 0.45;
export const ROUTE_MIN_OBSERVATIONS = 6;
export const PANIC_MIN_THREAT_DECISIONS = 5;
export const PANIC_AUTOPSY_MIN_DECISIONS = 6;
export const PANIC_BIAS_THRESHOLD = 0.55;
export const TIMING_ETA_TOLERANCE_S = 0.5;

export const AMBUSH_CONFIDENCE_THRESHOLD = 0.40;
export const AMBUSH_RELAXED_THRESHOLD = 0.35;
export const AMBUSH_RELAX_TIME_S = 75;
export const AMBUSH_MIN_N = 3;
export const AMBUSH_TELEGRAPH_S = 0.6;

export const ROLLING_ACCURACY_WINDOW = 8;
export const DRIFT_RECENT_WINDOW = 4;
export const DRIFT_MIN_MISSES = 3;
export const DRIFT_MIN_PRIOR_ACC = 0.5;
export const RECALIBRATE_DURATION_S = 1.4;
export const RECALIBRATE_SOFTEN_FACTOR = 0.5;
export const RECALIBRATE_COOLDOWN_S = 8.0;

export const ENTROPY_DECISION_WINDOW = 24;
export const ENTROPY_PRED_WINDOW = 10;
export const ENTROPY_PRED_MIN_N = 3;
export const ENTROPY_PRED_DEFAULT_ACC = 0.3;
export const ENTROPY_EMA_ALPHA = 0.25;
export const ENTROPY_IMPULSE_DECAY_PER_S = 4.0;
export const PATTERN_BREAK_IMPULSE = 8;

export const PATTERN_BREAK_MIN_P = 0.55;
export const PATTERN_BREAK_MIN_N = 4;
export const PATTERN_BREAK_COOLDOWN_S = 6.0;
export const PATTERN_BREAK_STUMBLE_S = 0.9;
export const PATTERN_BREAK_BONUS_PER_ROUND = 100;

export const CALLOUT_COOLDOWN_S = 30.0;
export const CALLOUT_DISPLAY_MS = 2400;
export const CAPTURE_CARD_DISPLAY_MS = 1500;

export const CLIP_BUFFER_HZ = 10;
export const CLIP_BEFORE_S = 4.0;
export const CLIP_AFTER_S = 1.0;
export const CLIP_MAX_PER_RUN = 3;
export const CLIP_PROXIMITY_TILES = 3.0;
export const CLIP_WINDOW_S = 2.0;

export const GOVERNOR_SAME_SIDE_MAX = 2;
export const GOVERNOR_SIDE_RADIUS_TILES = 5;

export const AUTOPSY_MIN_DURATION_S = 45;
export const AUTOPSY_KNEW_BY_MIN_PRED = 5;
export const AUTOPSY_KNEW_BY_ACC = 0.6;

export const TRAIL_ROUTE_MIN_STRENGTH = 0.08;
export const TRAIL_TIMING_MIN_STRENGTH = 0.08;
export const TRAIL_PANIC_MIN_STRENGTH = 0.08;

export const ADAPTIVE_QUALITY_FPS_THRESHOLD = 45;
export const MAX_RUN_HISTORY = 10;
export const MAX_STORED_CLIP_RUNS = 3;

export const SPRING_TOKENS = {
  soft: { stiffness: 170, damping: 20, mass: 1 },
  snappy: { stiffness: 320, damping: 26, mass: 1 },
  gooey: { stiffness: 120, damping: 14, mass: 1 },
} as const;

export const GHOST_CONFIG = {
  pinky: {
    id: 'pinky' as const,
    name: 'Pinky',
    epithet: 'The Cartographer',
    specialty: 'Routes',
    colorHex: '#2F8F83',
    deepColorHex: '#1F6359',
    hemStyle: 'rounded' as const,
  },
  inky: {
    id: 'inky' as const,
    name: 'Inky',
    epithet: 'The Clockwatcher',
    specialty: 'Timing & Hesitation',
    colorHex: '#E3A73B',
    deepColorHex: '#B57A12',
    hemStyle: 'scalloped' as const,
  },
  blinky: {
    id: 'blinky' as const,
    name: 'Blinky',
    epithet: 'The Flincher',
    specialty: 'Panic Reflexes',
    colorHex: '#D2553F',
    deepColorHex: '#A83A27',
    hemStyle: 'jagged' as const,
  },
} as const;
