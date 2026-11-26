# Project Memory Log

## Project Snapshot
- Current phase: Phase 8 Complete — All Phases (0–8) Implemented & Verified
- Features completed:
  - Core: C-01, C-02, C-03, C-04a, C-04b, C-04c, C-05, C-06, C-07, C-08, C-09, C-10
  - Supporting: S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08, S-09, S-10, S-11
  - Stretch: ST-01, ST-02, ST-03, ST-04
- Features in progress: none
- Features not started: none (human playtest sign-off remains for user in browser)
- Known issues/bugs open: none
- External services confirmed & integrated: zero runtime external APIs; all open-source build/runtime packages (`@fontsource-variable/fraunces`, `@fontsource/instrument-sans`, `@fontsource/ibm-plex-mono`, `motion`, `vite`, `typescript`, `vitest`, `jsdom`) installed and bundled cleanly
- External services pending confirmation: none
- Auth integration note: `platform/session.ts` (`MockSessionProvider`, returning `guest-local` / `Guest Haunt`) is the single identity point; real auth replaces `MockSessionProvider` and inserts a screen before `title` in `main.ts` without modifying game/report modules.
- Last updated: 2026-11-26 (All Phases 0–8 Complete & Verified)

## Activity Log

### 2026-11-26 — Session 1 (Step 0 Analysis & Step 1 Dependency Audit)
- What was done:
  - Read all five planning documents in full: `PRD.md`, `architecture.md`, `Design.md`, `phase.md`, and `rule.md`.
  - Cross-referenced all 27 features (`C-01`–`C-10`, `S-01`–`S-11`, `ST-01`–`ST-04`), algorithms, data models, design tokens, build phases, and rules.
  - Built the complete 27-feature checklist from `PRD.md`.
  - Conducted the Step 1 External Dependency Audit (confirming zero runtime external APIs, zero paid services, zero accounts/keys needed; documenting client-side/build-time npm packages from `architecture.md` and `phase.md`).
- Files created/modified:
  - `memory.md` (created)
- Features completed this session: none (halted at Step 1 gate per instructions)
- Issues found & how resolved:
  - Flagged 5 minor cross-document gaps/nuances to the user for clarification before coding:
    1. `ST-03` (Lantern Pellets) lacks visual styling specs in `Design.md` (§5/§7.3) and `lanternTiles` in `architecture.md` §4 `MazeDef`.
    2. `C-04a` Route Ghost activation: `PRD.md` AC states `≥ 6 observations in a context` while `architecture.md` §5.3 uses `confidence = max(p) × min(1, n/6) >= 0.45` (which can trigger at `n = 4` if `p` is high).
    3. `C-04b` hotspot rule (`≥ 3 dwells ≥ 350 ms` in `PRD.md` vs `mean dwell ≥ 350 ms with n ≥ 3` in `architecture.md` §5.3) and `C-04c` vs `C-09` panic count (`≥ 5` threat decisions for Blinky vs `≥ 6` for Autopsy statement).
    4. `AutopsyReport` schema sketch in `architecture.md` §4 omits `peakMultiplier`, `round`, and `score` shown in `Design.md` §7.6 (derivable from `Run` and `EntropySample`).
    5. Human playtest gate in `phase.md` Phase 5 and `rule.md` §6.9 (requires user playtest or explicit sign-off).
- Deviations from planning docs (if any) & why: none
- What the next agent/session should do next:
  - Wait for explicit user confirmation on Step 0 flagged items and Step 1 dependency audit, then begin Phase 0 (`Setup & Foundations`) per `phase.md`.
- Anything the next agent must NOT redo or must be careful about:
  - Do not start coding until user explicitly confirms Step 0 clarifications and Step 1 gate.
  - Keep `rule.md` constraints strictly enforced: no auth/login (mock session `guest-local` only), no ML, no external runtime APIs, no paid services, exact `Design.md` palette/typography/materials/motion, fixed 60 Hz sim completely decoupled from DOM.

### 2026-11-26 — Session 1 (Phase 0 Complete)
- What was done:
  - Installed dependencies (`@fontsource-variable/fraunces`, `@fontsource/instrument-sans`, `@fontsource/ibm-plex-mono`, `motion`, `typescript`, `vite`, `vitest`, `jsdom`).
  - Created `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/data/tuning.ts`, `src/game/core/types.ts`, `src/game/core/rng.ts`, `src/game/core/eventBus.ts`, `src/game/core/loop.ts`, `src/platform/session.ts`, `src/platform/storage.ts`, `src/ui/tokens.css`, `src/ui/store.ts`, `src/ui/motion.ts`, `src/ui/components/sessionChip.ts`, `src/ui/components/buttons.ts`, `src/ui/screens/titleScreen.ts`, `src/main.ts`, and `tests/phase0.test.ts`.
  - Fixed floating-point accumulator precision in `FixedStepLoop.onFrame` (`+ 1e-6`) and typed `EventBus` generic listener cast without `any`.
  - Verified `npm test` (5/5 passing) and `npm run build` (`tsc --noEmit` + `vite build` bundling self-hosted fonts).
- Files created/modified: All Phase 0 scaffold files listed above.
- Features completed this session: S-11 (`MockSessionProvider` + `SessionChip`), Phase 0 foundations.
- Issues found & how resolved:
  - `FixedStepLoop` accumulated `50 ms < 3 * 16.6667 ms` due to IEEE-754 rounding; fixed with `1e-6` tolerance and `Math.max(0, ...)`.
  - `EventBus.emit` TypeScript narrowing resolved via `GenericListener = (payload: never) => void`.
- Deviations from planning docs (if any) & why:
  - Resolved Step 0 cross-doc items upon user confirmation: `ST-03` uses brass/saffron glasshouse visuals + `lanternTiles` in `MazeDef`; `AutopsyReport` includes `round`, `score`, `peakMultiplier`; `C-04b` hotspot tracks `longDwellCount >= 3`; human playtest deferred to user after automated verification.
- What the next agent/session should do next:
  - Implement Phase 1 (`C-01` Maze, Movement, Pellets, Run Structure, and basic `S-07` Pause/Restart/End Run skeleton).
- Anything the next agent must NOT redo or must be careful about:
  - Keep `rule.md` folder layout and naming (`camelCase.ts`, `PascalCase` types, `UPPER_SNAKE_CASE` constants).

### 2026-11-26 — Session 1 (Phase 1 Complete)
- What was done:
  - Authored symmetric 21x23 maze in `src/data/maze.json` and 64 greenhouse corridor nicknames in `src/data/corridors.json`.
  - Implemented `src/game/core/maze.ts` (`buildMazeDef`, `validateMaze`, tunnel-aware neighbor queries), `src/game/core/graph.ts` (`MazeGraph` with BFS shortest path, `nextStepToward`, `projectAhead`, `getRelativeTurn`, `getNextJunctionFrom`), `src/game/core/collisions.ts`, `src/game/core/player.ts` (6.0 t/s grid movement, 250 ms turn buffer, auto corner-following, mid-corridor U-turns, smooth tunnel wrap), `src/game/core/world.ts`, `src/platform/input.ts`, `src/game/render/canvasRenderer.ts` (etched glass slab, brass pellets, pearl player orb), and `src/ui/screens/gameScreen.ts` (basic HUD + Pause/Restart/End Run overlay).
  - Wrote and passed `tests/phase1.test.ts` (5 tests) and verified `npm run build`.
- Files created/modified: `src/data/maze.json`, `src/data/corridors.json`, `src/game/core/maze.ts`, `src/game/core/graph.ts`, `src/game/core/collisions.ts`, `src/game/core/player.ts`, `src/game/core/world.ts`, `src/platform/input.ts`, `src/game/render/canvasRenderer.ts`, `src/ui/screens/gameScreen.ts`, `src/main.ts`, `tests/phase1.test.ts`.
- Features completed this session: C-01 (`Maze, Movement, Pellets & Run Structure`), S-07 basic skeleton.
- Issues found & how resolved: none.
- Deviations from planning docs (if any) & why: none.
- What the next agent/session should do next:
  - Implement Phase 2 (`C-02` Baseline Ghost Behavior Stage 0, den release stagger, capture & respawn).
- Anything the next agent must NOT redo or must be careful about:
  - Keep ghosts obeying no mid-corridor reversal rule and ensure Stage 0 fallback remains intact.

### 2026-11-26 — Session 1 (Phase 2 Complete)
- What was done:
  - Implemented `src/game/ai/baselineBrain.ts` (Blinky direct chase, Pinky 4-ahead, Inky chase within 8 tiles / patrol corners).
  - Implemented `src/game/core/ghost.ts` (0/6/12 s den stagger release, den exit navigation, no mid-corridor reversal rule, speed cap).
  - Updated `src/game/core/world.ts` (ghost stepping, capture collision, life loss, 2 s respawn invulnerability, memory-preserving reset, Cause-of-Capture line placeholder) and `src/game/render/canvasRenderer.ts` (glass jelly ghost art with Verdigris/Saffron/Cinnabar inner glow, 6 Hz animated hem, rounded/scalloped+clock/jagged colorblind shapes).
  - Wrote and passed `tests/phase2.test.ts` (4 tests, including 5-minute / 18,000-tick headless run with zero stalls or mid-corridor reversals).
- Files created/modified: `src/game/ai/baselineBrain.ts`, `src/game/core/ghost.ts`, `src/game/core/world.ts`, `src/game/render/canvasRenderer.ts`, `tests/phase2.test.ts`.
- Features completed this session: C-02 (`Baseline Ghost Behavior Stage 0`).
- Issues found & how resolved:
  - In `test-stagger`, stationary player was captured by Blinky before 6 s, resetting den timers; fixed test fixture with invulnerability during stagger observation.
- Deviations from planning docs (if any) & why: none.
- What the next agent/session should do next:
  - Implement Phase 3 (`C-03` Habit Capture Engine, `routeModel`, `timingModel`, `panicModel`, `entropy`, `drift`, `pacing`, and `Habit Simulator` with bots).
- Anything the next agent must NOT redo or must be careful about:
  - Keep confidence computation in one shared helper and guard every division/probability against `n = 0` or `NaN`.

### 2026-11-26 — Session 1 (Phase 3 Complete)
- What was done:
  - Implemented `src/game/memory/confidence.ts`, `routeModel.ts`, `timingModel.ts`, `panicModel.ts`, `entropy.ts`, `drift.ts`, `pacing.ts`, and `recorder.ts` (single-fire junction latch, threat & hesitation capture, mid-corridor death threat finalization, debug JSON export).
  - Implemented headless simulator & bots in `src/dev/bots.ts`, `src/dev/habitSimulator.ts`, and `src/dev/debugOverlay.ts`.
  - Integrated `HabitRecorder` into `WorldState` (`src/game/core/world.ts`) with live `entropy` and `multiplier` updates.
  - Wrote and passed `tests/phase3.test.ts` (7 tests; total 21 tests passing).
- Files created/modified: `src/game/memory/*.ts`, `src/dev/*.ts`, `src/game/core/world.ts`, `tests/phase3.test.ts`.
- Features completed this session: C-03 (`Habit Capture Engine`), C-10 data side (`Adaptation Pacing` & `Habit Simulator`).
- Issues found & how resolved:
  - In `EntropyEngine`, singleton `(junctionId, entryDir)` contexts visited once in the 24-decision window originally scored `H = 0`, depressing `randomWalk` entropy to `38.47`; fixed so single-visit contexts in the window score `1.0` (unrepeated), yielding `< 30` for `alwaysLeft` and `> 70` for `randomWalk`.
- Deviations from planning docs (if any) & why: none.
- What the next agent/session should do next:
  - Implement Phase 4 (`C-04a/b/c` specialist brains, `C-05` escape-corridor ambush planner, and `S-06` Fairness Governor).
- Anything the next agent must NOT redo or must be careful about:
  - Always run `FairnessGovernor` after specialist brains and before ghost movement; never allow ghost speed > 95% of player speed when ambushing or duplicate ambush reservations.

### 2026-11-26 — Session 1 (Phase 4 Complete)
- What was done:
  - Implemented `src/game/ai/routeBrain.ts` (loop detection + 2-junction lookahead cut-off node), `timingBrain.ts` (ETA convergence & hotspot lurking), `panicBrain.ts` (turn-bias approach blocking), `ambushPlanner.ts` (unique node reservations, 0.6 s telegraph, unreachable release), and `fairnessGovernor.ts` (speed caps, max 2 ghosts same side within 5 tiles, guaranteed non-ambushed exit).
  - Wired specialist AI, rolling accuracy, `knewAtT` tracking, ambush telegraph rendering, and Fairness Governor into `src/game/core/world.ts` and `src/game/render/canvasRenderer.ts`.
  - Tuned `EntropyEngine` small-sample smoothing (`ctx.total <= 2` light Laplace, `ctx.total >= 4` exact) and `TimingModel.getTimingConfidence()` / `bots.ts` corner following; verified all 27 tests pass across Phases 0–4.
- Files created/modified: `src/game/ai/routeBrain.ts`, `timingBrain.ts`, `panicBrain.ts`, `ambushPlanner.ts`, `fairnessGovernor.ts`, `src/game/core/world.ts`, `src/game/memory/entropy.ts`, `src/game/memory/timingModel.ts`, `src/game/memory/recorder.ts`, `src/dev/bots.ts`, `src/game/render/canvasRenderer.ts`, `tests/phase4.test.ts`.
- Features completed this session: C-04a, C-04b, C-04c, C-05, S-06.
- Issues found & how resolved:
  - Inky timing prediction hits were initially evaluating proximity (`dist <= 10.8`) even during `randomWalk`, depressing `randomWalk` entropy; restricted Inky prediction recording to registered hotspots and Blinky to `p >= 0.55`.
- Deviations from planning docs (if any) & why: none.
- What the next agent/session should do next:
  - Implement Phase 5 (`C-06` trails, `C-07` EntropyTube, `C-08` Recalibration, `S-01` Pattern Break, `S-02` ClipRecorder, `S-03` GhostMindCards, `S-04` Recognition Callouts, `S-05` Cause-of-Capture, `C-10` milestone checks).
- Anything the next agent must NOT redo or must be careful about:
  - Keep no-blur-over-canvas rule; keep trail canvases offscreen with `< 45 fps` adaptive resolution fallback.

### 2026-11-26 — Session 1 (Phase 5 Complete)
- What was done:
  - Implemented `src/game/ai/recalibration.ts` (`C-08`), `src/game/render/fxSprings.ts`, `ghostFx.ts` (`?` spring pop, wobble, Pattern Break squash/halo, capture frost particles), `trailLayers.ts` (`C-06` 3 offscreen canvases with strength scaling, decay fade, colorblind dashes/outlines, `<45 fps` half-res fallback), and `src/report/clipRecorder.ts` (`S-02` 10 Hz ring buffer, strong prediction capture, max 3 clips).
  - Implemented `src/data/phrases.json`, `src/report/phrases.ts`, `src/ui/hud/entropyTube.ts` (`C-07`), `ghostMindCards.ts` (`S-03`), `trailLegend.ts` (`C-06`), `recognitionToast.ts` (`S-04`), `captureCard.ts` (`S-05`), and wired full desktop/responsive layout into `gameScreen.ts`, `world.ts`, `canvasRenderer.ts`, and `main.ts`.
  - Fixed `PanicModel.getEscapeCandidates()` to compute per-junction escape probabilities (matching `architecture.md §5.3`) and fixed `AmbushPlanner.releaseGhost()` / `stepGhost` stumble exit `speedMul` reset.
  - Verified all 34 tests pass across Phases 0–5, including 10/10 `loopRunner` C-10 milestone runs (`firstTrail <= 10s`, `firstCallout <= 45s`, `firstAmbush <= 90s`).
- Files created/modified: `src/game/ai/recalibration.ts`, `src/game/render/*.ts`, `src/report/clipRecorder.ts`, `src/report/phrases.ts`, `src/data/phrases.json`, `src/ui/hud/*.ts`, `src/game/core/world.ts`, `src/game/core/ghost.ts`, `src/game/memory/panicModel.ts`, `src/game/ai/ambushPlanner.ts`, `src/ui/screens/gameScreen.ts`, `src/main.ts`, `tests/phase5.test.ts`.
- Features completed this session: C-06, C-07, C-08, C-10 (visible side), S-01, S-02, S-03, S-04, S-05.
- Issues found & how resolved:
  - Global escape corridor probability diluted multi-corridor loop confidence below 0.35; switching `PanicModel` to per-junction escape probability fixed `C-05`/`C-10` cleanly.
  - Ambush speed (`0.95`) persisted for 1 frame when `releaseGhost` or `stumble` returned a ghost to `chase`; reset `speedMul` to base `0.90` on release/recovery.
- Deviations from planning docs (if any) & why: none (human playtest sign-off at Phase 5 gate noted for user at end of build).
- What the next agent/session should do next:
  - Implement Phase 6 (`C-09` Habit Autopsy, `S-07` complete Pause/Restart/End Run + Settings, `S-08` Briefing screen, `S-09` Settings drawer & persistence).
- Anything the next agent must NOT redo or must be careful about:
  - Autopsy numbers must match debug JSON export verbatim; omit statements below threshold; show honest empty state when run < 45 s.

### 2026-11-26 — Session 1 (Phase 6 Complete)
- What was done:
  - Implemented `src/platform/settings.ts`, `src/ui/components/settingsDrawer.ts` (`S-09` persistent settings + storage-health fallback note), `src/ui/screens/briefingScreen.ts` (`S-08` 3-card skippable briefing with parallax), `src/report/autopsyBuilder.ts` (`C-09` pure threshold-gated builder), and `src/ui/screens/autopsyScreen.ts` (brass dossier stamp, quote cards, per-ghost row, stats row, animated SVG entropy chart, insufficient-data empty state, debug JSON export).
  - Wired Briefing first-run gating, Settings drawer from Title & Pause, and full Autopsy flow into `src/main.ts`.
  - Wrote and passed `tests/phase6.test.ts` (4 tests; total 38 passing).
- Files created/modified: `src/platform/settings.ts`, `src/ui/components/settingsDrawer.ts`, `src/ui/screens/briefingScreen.ts`, `src/report/autopsyBuilder.ts`, `src/ui/screens/autopsyScreen.ts`, `src/main.ts`, `tests/phase6.test.ts`.
- Features completed this session: C-09, S-07, S-08, S-09.
- Issues found & how resolved: none.
- Deviations from planning docs (if any) & why: none.
- What the next agent/session should do next:
  - Implement Phase 7 (`S-10` Web Audio cues, full Design.md parallax/frost-wipe/warm-vignette/responsive polish), then Phase 8 (`ST-01`..`ST-04`).
- Anything the next agent must NOT redo or must be careful about:
  - AudioContext must only be created/resumed after first user gesture; reduced motion must disable parallax/wobble/blur.

### 2026-11-26 — Session 1 (Phases 7 & 8 + Final Verification Complete)
- What was done:
  - Implemented Phase 7 (`S-10` Web Audio synthesizer in `src/platform/audio.ts` gated on first user gesture, 4-layer Title/In-Game parallax in `src/main.ts`, Round clear frost wipe & warm capture vignette in `src/ui/screens/gameScreen.ts` and `tokens.css`, responsive narrow-viewport rail collapse).
  - Implemented Phase 8 Stretch Features (`ST-01` `ClipPlayer` + `createReplayModal`, `ST-02` `runHistory.ts` + `historyScreen.ts` + Autopsy comparison deltas, `ST-03` Lantern Pellets 60% slow for 5 s + HUD countdown chip, `ST-04` Touch/swipe controls in `src/platform/input.ts`).
  - Added `tests/phase7.test.ts`, `tests/phase8.test.ts`, and `tests/e2eDom.test.ts`; verified full test suite (10 files, 43 tests) and `tsc --noEmit && vite build`.
- Files created/modified: `src/platform/audio.ts`, `src/platform/runHistory.ts`, `src/platform/input.ts`, `src/report/clipPlayer.ts`, `src/ui/screens/replayModal.ts`, `src/ui/screens/historyScreen.ts`, `src/ui/screens/gameScreen.ts`, `src/ui/hud/entropyTube.ts`, `src/ui/tokens.css`, `src/game/core/world.ts`, `src/main.ts`, `tests/phase7.test.ts`, `tests/phase8.test.ts`, `tests/e2eDom.test.ts`.
- Features completed this session: S-10, ST-01, ST-02, ST-03, ST-04 (all 27 PRD features complete).
- Issues found & how resolved:
  - `tests/phase7.test.ts` initially mocked `createOscillator` returning `undefined`; updated mock to return an oscillator stub.
- Deviations from planning docs (if any) & why: none.
- What the next agent/session should do next:
  - Run `npm run dev` in a local browser for human playtest verification (`phase.md` Phase 5 & `rule.md` §6.9).
- Anything the next agent must NOT redo or must be careful about:
  - Do not introduce runtime external APIs, ML, or real auth without following `rule.md` §5 Change Management.

### 2026-11-26 — Session 2 (Senior Game UI & Component Library Upgrade)
- What was done:
  - Extracted & completed all 12 named reusable UI components: `BrassButton` (with knurled `::before` rim preserving `:focus-visible` ring), `NeuButton`, `NeuChip`, `NeuToggle`, `NeuSlider` (neumorphic groove + brass thumb), `HudBar`, `EntropyTube`, `GhostMindCard`, `Toast`, `Modal`, `Drawer`, `AutopsyCard`, `EntropyChart`.
  - Replaced all Unicode UI symbols (`→`, `◎`, `⚑`, `✦`) with custom 1.5 px thin brass-line SVG icons (`src/ui/components/icons.ts`), including distinct ghost hem silhouettes (`rounded` / `scalloped + clock` / `jagged`) on HUD cards, Briefing, and Autopsy.
  - Added 650 ms physical cross-dissolve screen transitions (`transitionScreen`), Autopsy developing-photograph header reveal + scroll parallax, SVG `feDisplacementMap` refraction filter (`#liquid-refract`), and realistic mid-run / recalibrating / full-Autopsy fixtures (`src/dev/previewFixtures.ts`, accessible via `?inspect=midrun|autopsy|replay|briefing`).
  - Self-critique caught & fixed `#FFFFFF` on pearl life orbs in `hudBar.ts` (replaced with warm Pearl `rgba(251,247,238,0.9)`), moved knurled rim onto `::before` in `tokens.css`, and replaced raw `<input type="range">` with `createNeuSlider`.
- Files created/modified: `src/ui/components/icons.ts`, `neuToggle.ts`, `modal.ts`, `drawer.ts`, `autopsyCard.ts`, `entropyChart.ts`, `buttons.ts`, `settingsDrawer.ts`, `src/ui/hud/hudBar.ts`, `ghostMindCards.ts`, `trailLegend.ts`, `src/ui/screens/titleScreen.ts`, `briefingScreen.ts`, `gameScreen.ts`, `autopsyScreen.ts`, `replayModal.ts`, `src/ui/motion.ts`, `src/ui/tokens.css`, `src/dev/previewFixtures.ts`, `src/main.ts`, `tests/uiDesign.test.ts`.
- Verification: `npm test` (11 files, 45 tests passing) and `npm run build` (`tsc --noEmit && vite build`).

### 2026-11-26 — Session 2 (README & Git Push)
- What was done:
  - Added `.gitignore` (`node_modules/`, `dist/`, `.vite/`, local/OS files) and `README.md`.
  - Initialized git repository, committed project files, and pushed to `https://github.com/SagarKunnal/Haunted-by-Yourself`.
- Updated `README.md` to match submission format (`insiders`, `Track II — Learning / Adaptive Behavior`, `The Haunted Algorithm`, concise non-technical `Idea`, `How to Run`) and renaming GitHub repo to `I_The_Exchange`.

## Post-Game Recording & Autopsy Display Fix
- **Junction exit capture (`src/game/memory/recorder.ts`)**: Added `reachedCenter` latch to `ActiveJunctionVisit` so exit directions are only recorded after crossing a junction's center (`dist <= 0.25`), preventing premature recording of `entryDir` as `exitDir` on approach.
- **Autopsy statement coverage (`src/game/memory/routeModel.ts`, `src/report/autopsyBuilder.ts`)**: Added `RouteModel.getTopJunctionHabit(graph)` plus `favorite-route` and `top-corridor` fallback statements so organic runs (`>= 45s`) populate truthful Autopsy findings instead of empty lists.
- **Post-game transitions & run reset (`src/ui/motion.ts`, `src/ui/screens/autopsyScreen.ts`, `src/main.ts`)**: Split `transitionScreen` into eased opacity fade + spring `y` transform, removed competing header/card opacity springs, wired `Run History` navigation from the Autopsy footer, and reset full HUD/run state in `startNewRun()`.
- **Verification**: All 11 test suites (46 tests including `tests/e2eDom.test.ts` regression coverage) and `npm run build` (`tsc --noEmit && vite build`) pass.

## Per-Ghost Progress & Inky/Pinky Record Fix
- **Pinky (`src/game/memory/routeModel.ts`, `src/game/memory/recorder.ts`, `src/game/core/world.ts`)**: Allowed RouteModel predictions to evaluate on `rawN >= 2` across both exact `(junctionId, entryDir)` contexts and pooled junction history (`source !== 'uniform'`), added `RouteModel.getLearningProgress()`, and retained accumulated progress on Pinky's live Ghost Mind Card.
- **Inky (`src/game/memory/timingModel.ts`, `src/game/memory/recorder.ts`, `src/game/core/world.ts`)**: Added `TimingModel.predictJunctionDwell` and `TimingModel.getSummary()` so Inky evaluates real timing/cadence predictions (proximity intercept `<= 5` or predicted hesitation) without requiring repeated `>= 350ms` stalls at the same junction.
- **Autopsy & Run History (`src/game/core/types.ts`, `src/report/autopsyBuilder.ts`, `src/ui/screens/autopsyScreen.ts`, `src/ui/screens/historyScreen.ts`, `src/main.ts`)**: Added `GhostProgressSummary` (`progressPct`, `hits`, `total`, `hitRate`, `knewByT`) for Pinky, Inky, and Blinky computed strictly from run telemetry, added Inky `timing-cadence` and Pinky `top-corridor` Autopsy statement fallbacks, and rendered per-ghost progress bars on both Habit Autopsy and every saved Run History entry.
- **Verification**: All 11 test files (46 tests) and `npm run build` (`tsc --noEmit && vite build`) pass with exit code 0.

## UI & Header Craft Polish
- **Title / Header Page (`src/ui/screens/titleScreen.ts`, `src/ui/tokens.css`)**: Added full-width Glasshouse Liquid Glass top header bar with custom brass compass emblem + `Guest Haunt` session chip, framed hero centerpiece with inset hairline trim, ghost specimen trio pill (`Pinky`, `Inky`, `Blinky`), trait chips, and clean keyboard/goal footer strip.
- **Briefing, Game HUD, Autopsy & Run History (`src/ui/screens/briefingScreen.ts`, `src/ui/hud/hudBar.ts`, `src/ui/hud/ghostMindCards.ts`, `src/ui/screens/gameScreen.ts`, `src/ui/screens/autopsyScreen.ts`, `src/ui/components/autopsyCard.ts`, `src/ui/screens/historyScreen.ts`)**: Unified `page-shell-header` Liquid Glass navigation bars across pages, stacked HUD metrics with elapsed timer & divider lines, engraved brass-bordered canvas frame, ghost color accents on cards/statements, and sparkline guide lines + data points + empty state in Run History.
- **Verification**: All 11 test files (46/46 tests) and `npm run build` (`tsc --noEmit && vite build`) pass cleanly.
