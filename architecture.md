# architecture.md — Haunted by Yourself

**Chain:** PRD.md → **architecture.md** → Design.md → phase.md → rule.md
**Upstream dependency:** every feature ID (C-xx, S-xx, ST-xx) below refers to PRD.md. Nothing in the PRD is left unmapped (see §5).

---

## 1. Architecture Overview

A **fully client-side** application. There is no server, no database server, and no external API call at runtime.

```
┌──────────────────────────── BROWSER ─────────────────────────────┐
│                                                                   │
│  UI SHELL (DOM + CSS)                 GAME CANVAS (Canvas 2D)     │
│  Title · Briefing · HUD · Mind Cards  Maze · Player · Ghosts      │
│  Autopsy · Settings · Pause · Replay  Trails (offscreen layers)   │
│        ▲  ▲                                  ▲                    │
│        │  │ store snapshots @10 Hz           │ render @rAF        │
│        │  └───────────────┐                  │                    │
│   ┌────┴─────┐      ┌─────┴──────────────────┴───────┐            │
│   │ UI Store │◄─────┤        SIMULATION CORE         │            │
│   └────┬─────┘      │  fixed 60 Hz step              │            │
│        │            │  ┌──────────┐  ┌────────────┐  │            │
│   ┌────┴─────┐      │  │ Maze/    │  │ Entities   │  │            │
│   │ Event Bus│◄─────┤  │ Graph    │  │ Player,    │  │            │
│   └────┬─────┘      │  └──────────┘  │ Ghosts     │  │            │
│        │            │  ┌──────────────────────────┐  │            │
│        │            │  │ HABIT MEMORY             │  │            │
│        │            │  │ Recorder → Route/Timing/ │  │            │
│        │            │  │ Panic models → Entropy   │  │            │
│        │            │  │ Drift detector           │  │            │
│        │            │  └──────────────────────────┘  │            │
│        │            │  ┌──────────────────────────┐  │            │
│        │            │  │ GHOST AI                 │  │            │
│        │            │  │ Brains · Ambush planner  │  │            │
│        │            │  │ Fairness governor        │  │            │
│        │            │  └──────────────────────────┘  │            │
│        │            └────────────────────────────────┘            │
│   ┌────┴─────────────────────────────────────────────┐            │
│   │ REPORTING: AutopsyBuilder · ClipRecorder/Player  │            │
│   └────┬─────────────────────────────────────────────┘            │
│   ┌────┴─────────────────────────────────────────────┐            │
│   │ PLATFORM: SessionProvider(mock) · Storage adapter│            │
│   │ Audio (Web Audio) · Settings · Input             │            │
│   └──────────────────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────────────┘
     Static hosting only (free tier). localStorage for persistence.
```

**Core principle:** the simulation is **deterministic given input and a seeded RNG**, and it knows nothing about the DOM. The UI reads snapshots and listens to events. This keeps the learning logic testable headlessly, which matters because the product's value rests on adaptation being measurable.

---

## 2. Tech Stack Recommendation

| Layer | Choice | Why it fits *this* project |
|---|---|---|
| Language | **TypeScript** | Memory models and event schemas are data-heavy; types prevent silent shape drift between recorder, models, and Autopsy. |
| Build | **Vite** | Instant dev reload for iterating on tuning constants; static output. |
| Game rendering | **Canvas 2D** (no engine) | A 21×23 grid game needs no engine. Offscreen canvases give cheap trail layers with fade; full control over ghost wobble and glow. |
| UI shell | **Vanilla DOM + CSS custom properties** with small component modules | The visual language (glass, blur, neumorphic inset, brass) is CSS-native; a framework adds nothing here and costs setup time. |
| State | Plain mutable sim state + tiny pub/sub store for UI snapshots | Avoids per-frame reactive overhead. |
| Motion | **`motion`** (motion.dev, MIT) for springs on DOM; custom spring integrator for canvas effects | Springs are required by Design.md; a library avoids hand-tuning CSS easing for everything. Fallback: CSS `linear()` spring curves. |
| Audio | **Web Audio API** (synthesized) | No asset files, no licensing, no network. |
| Persistence | **localStorage** (IndexedDB is unnecessary at this data size) | Settings, run summaries, and clips are tiny. |
| Testing | **Vitest** (pure logic) + a **Habit Simulator** harness (scripted bot policies) | The key claims (ghosts learn within 2 minutes, an always-left bot is punished) are testable without a browser. |
| Hosting | Any free static host (see §3) | No server needed. |
| AI/ML | **None**, by track rule | Frequency tables, decay, and rules only. |

---

## 3. Free API & Service Mapping

The build needs **no external API**. External services are limited to hosting and fonts.

| Need | Service | Free-tier limits | Fallback |
|---|---|---|---|
| Fonts (Fraunces, Instrument Sans, IBM Plex Mono) | **`@fontsource` npm packages** (SIL OFL), self-hosted in the bundle | None | System serif and sans stacks defined in Design.md |
| Sound | **Web Audio API** (browser built-in) | None | Silent mode (graceful) |
| Animation | `motion` (MIT) | None | CSS `linear()` springs, then plain CSS transitions |
| Persistence | `localStorage` | ~5 MB per origin | In-memory only (S-09 states this) |
| Hosting | **Cloudflare Pages**, Vercel, Netlify, or GitHub Pages | Generous free static hosting on all four | Switch to any other of the four; no code change |
| Analytics / telemetry | **None** | n/a | n/a |
| LLM / text generation | **None**; Autopsy language is template-driven | n/a | n/a |

**Paid services: none.** If one is ever proposed, it must be flagged "PAID — justify" and approved (rule.md).

---

## 4. Data Model (schema-level)

All entities are run-scoped unless noted. IDs are strings or small ints.

**Session** *(mock, platform-scoped)*: `userId="guest-local"`, `displayName="Guest Haunt"`.

**Run**: `runId`, `startedAt`, `endedAt`, `round`, `score`, `lives`, `seed`, `endReason(lives|manual)`.

**MazeDef** *(static)*: `grid[][]`, `junctions[]{id, tile}`, `corridors[]{id, nickname, a, b, tiles[], centroid}`, `denTile`, `tunnelTiles`.

**DecisionEvent**: `t`, `junctionId`, `entryDir`, `exitDir`, `relTurn(L|R|S|U)`, `dwellMs`, `threat(bool)`, `threatDist?`, `nearestGhost?`, `corridorId`.

**ThreatEvent**: `t`, `ghostId`, `distance`, `escapeCorridorId`, `survived(bool)`, `relTurn`.

**HesitationEvent**: `t`, `junctionId`, `kind(stall|dwell|reversal)`, `ms`.

**CorridorStat**: `corridorId`, `visits`, `escapeVisits`, `lastUsedT`, `strength` (decayed).

**JunctionStat**: `junctionId`, `counts[entryDir][exitDir]` (decayed weights), `n`, `dwellMeanMs`, `dwellN`.

**GhostState**: `ghostId`, `mode(chase|predict|ambush|recalibrate|stumble)`, `confidence`, `target`, `speedMul`, `rollingHits[]`, `knewAtT?`, `cooldowns{}`.

**PredictionRecord**: `t`, `ghostId`, `kind(route|timing|panic)`, `context`, `predicted`, `confidence`, `actual`, `hit(bool)`, `consequential(bool)`.

**PatternBreakEvent**: `t`, `junctionId`, `predictedExit`, `p`, `chosenExit`, `bonus`.

**EntropySample**: `t`, `entropy`, `multiplier` (1 Hz, for the Autopsy chart).

**ReplayClip**: `clipId`, `ghostId`, `confidence`, `frames[]{t, player{x,y}, ghosts[{id,x,y,mode}], predictedPath?}`, `highlightT`.

**AutopsyReport** *(derived)*: `statements[]{id, text, confidenceOK}`, `knewBy{ghostId→t}`, `predictabilityIndex`, `patternBreaks`, `entropyTimeline[]`, `hotspots[]`, `favoriteLoop`, `favoriteEscape`, `clips[]`, `sufficientData(bool)`.

**Settings** *(persistent)*: `sound`, `volume`, `trails{route,timing,panic}`, `reducedMotion`, `colorblind`.

**RunSummary** *(persistent, last 10, ST-02)*: `runId`, `date`, `score`, `rounds`, `predictabilityIndex`, `meanEntropy`, `patternBreaks`.

**Storage keys:** `hby:v1:settings`, `hby:v1:runs`, `hby:v1:clips:<runId>` (latest 3 runs only).

---

## 5. Feature-to-Component Mapping

### 5.1 Module layout
```
src/
  game/
    core/      loop.ts · maze.ts · graph.ts · player.ts · ghost.ts · collisions.ts · rng.ts
    memory/    recorder.ts · routeModel.ts · timingModel.ts · panicModel.ts
               entropy.ts · drift.ts · pacing.ts
    ai/        baselineBrain.ts · routeBrain.ts · timingBrain.ts · panicBrain.ts
               ambushPlanner.ts · fairnessGovernor.ts · recalibration.ts
    render/    canvasRenderer.ts · trailLayers.ts · ghostFx.ts · fxSprings.ts
  report/      autopsyBuilder.ts · phrases.ts · clipRecorder.ts · clipPlayer.ts
  ui/          screens/ · components/ · hud/ · store.ts · motion.ts · tokens.css
  platform/    session.ts · storage.ts · audio.ts · settings.ts · input.ts
  data/        maze.json · corridors.json · phrases.json · tuning.ts
  dev/         habitSimulator.ts · bots.ts · debugOverlay.ts
```

### 5.2 Mapping table

| PRD feature | Responsible component(s) |
|---|---|
| **C-01** Maze, movement, pellets, run structure | `maze.ts`, `graph.ts`, `player.ts`, `loop.ts`, `input.ts`; maze validator in tests; `data/maze.json` (+ nicknames) |
| **C-02** Baseline ghosts | `baselineBrain.ts`, `ghost.ts` |
| **C-03** Habit Capture Engine | `recorder.ts` (events) → `routeModel`, `timingModel`, `panicModel` |
| **C-04a** Route Ghost | `routeModel.ts` + `routeBrain.ts` |
| **C-04b** Timing Ghost | `timingModel.ts` + `timingBrain.ts` |
| **C-04c** Panic Ghost | `panicModel.ts` + `panicBrain.ts` |
| **C-05** Escape-corridor ambush | `ambushPlanner.ts` (node reservation, telegraph), `panicModel` escape stats |
| **C-06** Memory trails | `trailLayers.ts` (3 offscreen canvases), model strength accessors, legend/toggles in HUD |
| **C-07** Entropy meter and multiplier | `entropy.ts`, scoring in `loop.ts`, `EntropyTube` component |
| **C-08** Recalibration | `drift.ts`, `recalibration.ts`, `ghostFx.ts` |
| **C-09** Habit Autopsy | `autopsyBuilder.ts`, `phrases.ts`, Autopsy screen |
| **C-10** Adaptation pacing | `pacing.ts` (warm-start weights, milestone tracker), tuning constants |
| **S-01** Pattern Break | `routeModel` lookup in `loop.ts` decision hook, `PatternBreakEvent`, `ghost.ts` stumble state |
| **S-02** Prediction moment capture | `clipRecorder.ts` + `PredictionRecord` tagging |
| **S-03** Ghost Mind Cards | HUD component reading `GhostState` snapshots |
| **S-04** Recognition Callouts | event bus (`habit-locked`) → toast component, rate limiter |
| **S-05** Cause-of-capture line | last `PredictionRecord` + `phrases.ts` → capture card |
| **S-06** Fairness Governor | `fairnessGovernor.ts` (runs after brains, before movement) |
| **S-07** Pause / restart / end | loop pause flag, `visibilitychange` handler, Pause overlay |
| **S-08** Briefing | Briefing screen |
| **S-09** Settings | `settings.ts`, `storage.ts`, Settings drawer |
| **S-10** Audio cues | `audio.ts` subscribed to event bus |
| **S-11** Mock session | `session.ts` (see §9) |
| **ST-01** Replay viewer | `clipPlayer.ts`, Replay screen |
| **ST-02** Run history | `storage.ts` run summaries, Autopsy comparison block |
| **ST-03** Lantern pellets | `player.ts` pickup, `ghost.ts` speed modifier, governor-aware |
| **ST-04** Touch/swipe | `input.ts` gesture adapter |

### 5.3 Core algorithms (rules only, no ML)

**Tuning constants** (all in `data/tuning.ts`, **initial values to be tuned**):
- Grid 21×23; sim 60 Hz fixed step; delta clamp 50 ms.
- Player 6.0 t/s; ghost base 5.4 t/s (90%); ambush travel ≤ 5.7 t/s (95%); recalibrating 50%.
- Decision zone: 0.6 tile before junction center. Threat: path distance ≤ 6 tiles and ghost approaching.
- Dwell flag ≥ 350 ms; stall ≥ 250 ms; hotspot = mean dwell ≥ 350 ms with n ≥ 3.
- Memory: Laplace α = 0.5; before adding an observation to a context, multiply that context's weights by **0.95**; first 12 global decisions weighted ×2 (warm start, C-10).
- Confidence = `max(p) × min(1, n/6)`. Act threshold 0.45; ambush threshold 0.40 with n ≥ 3.
- Rolling accuracy window: 8 predictions per ghost.

**Route model (C-04a).** Context = `(junctionId, entryDir)`. Predict top exit; fall back to `(junctionId)` pooled, then to Stage 0. Look ahead 2 junctions via the top-probability path. Brain targets the **cut-off node** (next predicted junction, approached from the opposite side).

**Timing model (C-04b).** Tracks per-corridor traversal time to estimate ETA at each junction; tracks dwell per junction. Brain computes `ETA_player` and routes to arrive at the junction (or the nearest hotspot) within ±0.5 s; lurks adjacent to hotspots.

**Panic model (C-04c).** On threat decisions only: histogram of `relTurn` and of `escapeCorridorId` per junction. Brain picks the approach side that blocks the biased turn; escape-corridor stats feed the ambush planner.

**Ambush planner (C-05).** For each eligible corridor (confidence ≥ 0.40, n ≥ 3), compute the exit node. Reserve it for one ghost (Panic first, Route second, Timing third). The ghost telegraphs for 0.6 s (glow plus audio), then holds the node until the player commits or the confidence drops.

**Drift detector (C-08).** Per ghost: if ≥ 3 of the last 4 confident predictions missed and prior rolling accuracy ≥ 50% → `recalibrate` for 1.4 s (speed 50%, "?" FX, trail desaturate). Then multiply that context's weights by 0.5. Per-ghost cooldown 8 s.

**Entropy engine (C-07).**
`H_norm` = frequency-weighted mean of per-context Shannon entropy over the last 24 decisions, each normalized by `log2(available exits)`.
`A` = pooled hit rate of confident predictions in the last 10 (default 0.3 if fewer than 3).
`E_raw = 100 × (0.5·H_norm + 0.5·(1 − A))`; displayed `E` = EMA(0.25) of `E_raw`, clamped 0–100, plus Pattern Break impulse +8 (decaying).
`multiplier = 1 + E/50` (1.0–3.0), applied to pellet points.

**Pattern Break (S-01).** At each decision: if any route-model top exit has `p ≥ 0.55`, `n ≥ 4`, and the player picks a different, non-reverse exit, and the cooldown (6 s) is clear → emit `pattern-break`: all ghosts Stumble 0.9 s, bonus = 100 × round, entropy impulse.

**Fairness Governor (S-06).** After brains choose targets: cap ambush speed at 95%; if > 2 ghosts within 5 tiles on the same side, reassign the farthest to flank or chase; ensure at least one exit from the player's next junction is not claimed (release the lowest-confidence ambush if needed).

**Pacing (C-10).** Stage 0 until 12 decisions or 25 s. Milestone tracker logs: first trail, first callout, first ambush. If a confident ambush is possible but none has fired by 75 s, the planner lowers its ambush threshold from 0.40 to 0.35 for that run (logged).

**Clip recorder (S-02/ST-01).** A 10 Hz ring buffer (6 s) of positions. On a strong-prediction event (confident hit and ghost within 3 tiles within 2 s, or a capture), freeze 4 s before and 1 s after into a clip with the predicted path. Keep the top 3 per run. Replay is **positional playback**, not re-simulation, so it is robust to later logic changes.

**Autopsy builder (C-09).** Pure function over the run's events. Each phrase template has a threshold (for example panic bias needs ≥ 6 threat decisions and ≥ 55%). "Knew by" = the first time a ghost's rolling accuracy reached ≥ 60% over ≥ 5 predictions. Predictability Index = mean pooled hit rate × 100.

---

## 6. State Management Strategy

- **Simulation state:** one mutable `World` object mutated only inside the fixed-step `update()`. Rendering reads it.
- **UI store:** a ~50-line pub/sub store updated by **snapshot at 10 Hz** (score, lives, round, entropy, multiplier, ghost mode/confidence/prediction text) and by **discrete events**.
- **Event bus** (typed): `decision`, `threat-start`, `habit-locked`, `ambush-telegraph`, `ambush-set`, `recalibrate-start`, `pattern-break`, `capture`, `round-clear`, `run-end`. Audio, toasts, FX, and the clip recorder subscribe; none of them mutate sim state.
- **Screen state:** a small finite state machine: `title → briefing → playing ⇄ paused → autopsy → (replay) → title`. No router library; screens are mounted/unmounted by the FSM.
- **Pause correctness:** pause freezes the sim clock; `visibilitychange` auto-pauses; the first frame after resume uses a clamped delta.

---

## 7. Error Handling & Resilience

Because no external APIs are used, quota and rate-limit failures cannot occur. The relevant failure modes are browser-level.

| Failure | Handling |
|---|---|
| `localStorage` unavailable, full, or corrupt JSON | Wrap all access; on failure use in-memory defaults; show a non-blocking note in Settings; never crash |
| `AudioContext` blocked until a gesture | Create/resume on first input; silent until then |
| `backdrop-filter` or SVG refraction unsupported | Feature-detect; fall back to Glassmorphism with a higher-opacity panel (Design.md) |
| Font load failure | Use fallback stacks with matched metrics; no layout break |
| Low frame rate | Adaptive quality: halve trail-layer resolution and disable ghost glow blur below 45 fps; sim stays fixed-step |
| Tab backgrounded | Auto-pause; clamp delta on return |
| Insufficient habit data | Stage 0 fallback in AI; honest empty state in Autopsy |
| Model produces NaN/invalid probability | Guard all divisions; fall back to uniform distribution and log in debug |
| Ambush plan unreachable | Planner drops the node and releases the reservation |
| Softlock risk | Maze validator in tests; per-frame assertion in dev that the player has ≥ 1 legal exit |

---

## 8. Scalability Notes (post-hackathon awareness only)

- Cross-run persistent "haunting" profiles would need real storage and a schema migration path (`hby:v2`).
- A server would be required for leaderboards or shared profiles; the event schemas are already serializable.
- Additional mazes need authored nicknames and validator coverage.
- If predictions get richer (longer n-grams), keep the context key bounded to avoid sparse-data failure; the current design intentionally stays at first-order contexts.
- Liquid Glass refraction is Chromium-first; a WebGL layer would be the upgrade for universal fidelity.

---

## 9. Explicit Auth Placeholder

`platform/session.ts` exports a `SessionProvider` interface (`getSession(): Session`). The only implementation is `MockSessionProvider`, returning `{ userId: "guest-local", displayName: "Guest Haunt" }`.

- All code that needs a user identity (storage key namespacing, the title-screen chip) calls `getSession()` and **nowhere else**.
- Storage keys already namespace by app version; user-scoping will be added inside `storage.ts` only.
- When real auth is added, it replaces `MockSessionProvider` and adds a screen *before* `title` in the FSM. No other module changes.

---

## 10. Cross-Check Result

Every PRD feature (C-01 to C-10, S-01 to S-11, ST-01 to ST-04) maps to a concrete component in §5.2.

**Gaps and caveats, called out explicitly:**
1. Liquid Glass refraction cannot be guaranteed outside Chromium; fallback is defined.
2. Replay is positional playback, not deterministic re-simulation (intentional; documented).
3. Autopsy language is template-driven, not generated; phrase quality is an authoring task, not an engineering one.
4. All numeric tuning values are initial and expected to change during tuning; they live in one file.
