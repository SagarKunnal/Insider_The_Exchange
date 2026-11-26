# phase.md — Haunted by Yourself

**Chain:** PRD.md → architecture.md → Design.md → **phase.md** → rule.md
Internal build sequencing only. No demo, pitch, or presentation content. Feature IDs refer to PRD.md; components and constants to architecture.md; visuals to Design.md.

---

## 1. Build Philosophy

1. **Simulation before skin.** The learning logic is the product. It is built and verified headlessly (Habit Simulator) before any visual polish, so tuning is done against numbers, not vibes.
2. **Data layer → models → behavior → visibility → report → polish.** Each layer depends only on the ones before it.
3. **Make adaptation measurable early.** The Habit Simulator exists by Phase 3 so every later phase can be checked against the time-to-adaptation targets (C-10).
4. **Visible truth over decoration.** Trails, mind cards, and the Autopsy read from the same recorded data; no UI element may display a value the engine did not compute.
5. **Polish last, but design tokens first.** Tokens and fonts are set in Phase 0 so no screen is built in a throwaway style.

---

## 2. Phase Breakdown

### Phase 0: Setup & Foundations
**Includes:** Vite + TypeScript scaffold; folder structure (architecture §5.1); `tuning.ts`; typed event bus and UI store; fixed-step loop skeleton; `tokens.css` (all Design.md colors, type, spring tokens); self-hosted fonts via `@fontsource`; `storage.ts` with safe wrappers; `MockSessionProvider` (S-11); Vitest setup; seeded RNG; screen FSM shell (title → … → autopsy placeholders).
**Dependencies:** none.
**Definition of Done:** app boots to a styled placeholder Title; fonts load with fallbacks verified; loop ticks at fixed 60 Hz with clamped delta; storage wrapper survives blocked/corrupt storage in a test; session chip shows "Guest Haunt"; `npm test` runs.
**Risk points:** font metrics causing layout shift → define fallback stacks now. Loop drift → test delta clamp. Storage exceptions → wrap everything from day one.

### Phase 1: Maze World — C-01
**Includes:** authored 21×23 maze with corridor IDs and **nicknames**; maze validator (connected, no dead ends, ≥ 4 loops, symmetric, tunnel); junction/corridor graph with path-distance and BFS utilities; renderer for the etched glass slab; player movement with buffered turns; pellets, score, lives, respawn invulnerability, Round progression; Pause/Restart/End Run skeleton (S-07, basic).
**Dependencies:** Phase 0.
**Definition of Done:** the validator passes; the player never gets stuck at a junction; the buffered turn works within 250 ms; all pellets collectable; Round advances; lives go to 0 → run-end event; tunnel wrap works; pause fully halts the sim.
**Risk points:** corner-cutting and turn buffering are the classic bugs → unit test movement on every junction type. Off-by-one in the graph → render a debug overlay of junction/corridor IDs.

### Phase 2: Baseline Ghosts & Collision — C-02
**Includes:** `ghost.ts`; den release stagger (0/6/12 s); Stage 0 brains (Blinky direct chase, Pinky 4-ahead, Inky chase-within-8 else patrol); no mid-corridor reversal rule; collision and capture → life loss; Cause-of-Capture placeholder (neutral line).
**Dependencies:** Phase 1.
**Definition of Done:** ghosts navigate without stalls for 5 minutes in a headless run; Stage 0 behaviors are visibly distinct; captures trigger correctly; respawn invulnerability honored.
**Risk points:** ghost oscillation at ties → deterministic tie-break by tile ID. Ghosts stuck in the den → dedicated test.

### Phase 3: Habit Capture Engine, Models & Simulator — C-03, C-10 (data side)
**Includes:** `recorder.ts` (DecisionEvent, ThreatEvent, HesitationEvent, corridor stats); `routeModel`, `timingModel`, `panicModel` with decay, Laplace smoothing, warm start; confidence calculation; `entropy.ts` (formula, EMA, multiplier); `drift.ts` (detector only); `pacing.ts` (milestone tracker, warm start); **Habit Simulator** with bots (`alwaysLeft`, `loopRunner`, `randomWalk`, `panicLeft`, `mixed`); debug JSON export and debug overlay.
**Dependencies:** Phases 1–2.
**Definition of Done:** exactly one DecisionEvent per junction crossing; threat tagging verified with scripted ghosts; models match hand-computed expected probabilities on fixtures; `alwaysLeft` bot yields entropy < 30 and `randomWalk` yields entropy > 70 after 90 s; memory persists across death and Round; no NaN under any fixture.
**Risk points:** the decision-zone boundary double-fires → single-fire latch per junction visit. Division by zero at n = 0 → uniform fallback tested. Decay constant mis-tuning → fixtures cover "habit abandoned → strength falls."

### Phase 4: Specialist Ghosts, Ambush & Fairness — C-04a/b/c, C-05, S-06
**Includes:** `routeBrain` (cut-off node via 2-junction lookahead); `timingBrain` (ETA and hotspot lurking); `panicBrain` (turn-bias blocking); `ambushPlanner` with reservation and 0.6 s telegraph; `fairnessGovernor`; fallback to Stage 0 below confidence 0.45.
**Dependencies:** Phase 3.
**Definition of Done:** with the `loopRunner` bot, Pinky waits at the loop's next junction within 2 loops; with `panicLeft`, Blinky blocks the left-turn escape after ≥ 5 threat decisions; Inky arrives within ±0.5 s of ETA in ≥ 60% of attempts; ambush nodes never duplicate; across 20 worst-case simulated runs the player always has a non-ambushed exit (S-06); no ghost speed exceeds its cap.
**Risk points:** ghosts clumping → governor flank reassignment tested. Over-powered ambush → telegraph and speed cap verified. Unreachable ambush target → planner releases reservation (test).

### Phase 5: Visibility & Feedback Layer — C-06, C-07, C-08, S-01, S-02, S-03, S-04, S-05, C-10 (visible side)
**Includes:** three trail layers on offscreen canvases (Route/Timing/Panic) with strength mapping, decay fade, legend, and layer toggles; **EntropyTube** and live multiplier scoring; Recalibration (state, "?" FX, trail desaturation, memory softening, cooldown); **Pattern Break** (detection, Stumble, bonus, impulse, cooldown); clip recorder with strong-prediction tagging (S-02); **GhostMindCards**; **Recognition Callouts** (rate-limited); full **Cause-of-Capture** line; pacing milestone enforcement (first trail ≤ 10 s, callout ≤ 45 s, ambush ≤ 90 s, threshold relaxation at 75 s).
**Dependencies:** Phase 4.
**Definition of Done:** trails appear ≤ 10 s and scale with frequency; abandoning a habit visibly fades it; entropy responds within 3 decisions; multiplier applied to pellet points; a bot that switches habits triggers Recalibration on the affected ghost only; Pattern Break fires only under its exact conditions and respects its cooldown; ≤ 3 clips stored per run; callouts honor the 30 s limit; milestone log shows targets met in 10 of 10 `loopRunner` runs.
**Risk points:** trail rendering cost → offscreen layers with a quality fallback below 45 fps. Notification spam → rate limiter tests. Pattern Break farming → oscillation test.
**Tuning gate:** do not proceed until milestone targets are met in the simulator **and** a human playtest confirms "I could see them learning" within two minutes.

### Phase 6: Run Flow, Autopsy & Screens — C-09, S-07 (complete), S-08, S-09
**Includes:** run-end flow; `autopsyBuilder` with phrase templates and confidence thresholds; "knew by" calculation; Predictability Index; entropy timeline; Autopsy screen (statements, per-ghost row, stats, chart, insufficient-data state); full Pause overlay; Briefing; Settings drawer with persistence (sound, trail defaults, reduced motion, colorblind).
**Dependencies:** Phase 5 (data) and Phase 0 tokens.
**Definition of Done:** every Autopsy number matches the debug JSON export; statements below threshold are never shown; a run < 45 s shows the honest empty state; settings persist across reload; Pause halts the sim and the timer; Briefing is skippable.
**Risk points:** phrase templates producing wrong grammar or nonsense at low n → threshold tests. Autopsy/data mismatch → snapshot test comparing statements to the fixtures.

### Phase 7: Design & Motion Polish — Design.md in full; S-10
**Includes:** the Liquid Glass / Glassmorphism / Skeuomorphic / Neumorphic treatments per element (Design §4); all component states (§5); spring tokens and every micro-interaction (§6); parallax zones (Title, In-game, Autopsy, Briefing); ghost and player art; Web Audio cues (S-10); reduced-motion and colorblind variants; backdrop-filter fallbacks; accessibility checks (§8).
**Dependencies:** Phases 5–6.
**Definition of Done:** each screen matches Design.md §7; a visual regression pass confirms light-source consistency (top-left) everywhere; reduced motion disables the listed effects; contrast checks pass; fallback rendering is verified with `backdrop-filter` disabled; ≥ 55 fps in a mid-range laptop profile during active play.
**Risk points:** blur over the playfield hurts performance → no blur layers over the canvas (rule). Neumorphic contrast failures → outlines verified. Audio autoplay → first-gesture gate tested.

### Phase 8: Stretch Features — ST-01 to ST-04
**Order:** ST-01 Replay Viewer → ST-02 Run History → ST-03 Lantern Pellets → ST-04 Touch/Swipe.
**Definition of Done (per item):**
- **ST-01:** plays the captured clips with the predicted-vs-actual path overlay, scrubber, and 0.25×/0.5×/1× speeds.
- **ST-02:** persists 10 summaries; the Autopsy shows deltas.
- **ST-03:** ghosts slow to 60% for 5 s; Fairness Governor tests still pass.
- **ST-04:** swipe sets the buffered direction on a phone viewport.
**Dependencies:** Phases 5–7 (S-02 data for ST-01).
**Risk points:** ST-03 changing balance → re-run fairness tests. ST-04 gesture conflicts with scrolling → lock touch-action on the canvas.

---

## 3. Login/Auth Handling Note

Every phase assumes the mock session `guest-local` (S-11). **No phase builds login, signup, or auth.** The single integration point for real auth is `platform/session.ts` (`SessionProvider`) plus one new FSM screen *before* `title`. No other phase's code changes when auth is added.

---

## 4. Free API Integration Checklist

There are no external APIs to sign up for. Per phase:

| Phase | Service / resource | Setup | Quota / fallback |
|---|---|---|---|
| 0 | `@fontsource` (Fraunces, Instrument Sans, IBM Plex Mono) | `npm install`, import weights used | No quota; system fallback stacks |
| 0 | `localStorage` | Wrap access | Blocked/full → in-memory defaults |
| 7 | Web Audio API | Create context on first gesture | Blocked → silent |
| 7 | `motion` (MIT) | `npm install` | Fallback to CSS `linear()` springs |
| Release | Free static host (Cloudflare Pages / Vercel / Netlify / GitHub Pages) | Connect repo, build `vite build` | Switch hosts; no code change |

Anything proposed outside this list must be flagged **PAID — justify** and approved (rule.md).

---

## 5. Testing Checkpoints

| After | Verify manually |
|---|---|
| Phase 0 | Boots; fonts and fallbacks; loop timing; storage wrapper failure paths |
| Phase 1 | Play 2 full rounds; every junction turns correctly; tunnel works; pause freezes everything |
| Phase 2 | Watch 5 minutes of ghost-only play; no stalls; captures and respawns correct |
| Phase 3 | Run all bots; check the debug JSON for event counts, threat tags, and entropy ranges |
| Phase 4 | Replay each bot scenario; watch Pinky/Inky/Blinky behaviors; run the 20-run fairness check |
| Phase 5 | Human playtest: do trails, bars, callouts, recalibration, and Pattern Break read clearly? Milestones met? |
| Phase 6 | Compare Autopsy to the debug export; trigger the empty state; reload to confirm settings persist |
| Phase 7 | Screen-by-screen against Design.md; reduced-motion and colorblind passes; fallback rendering; fps |
| Phase 8 | Each stretch item against its Definition of Done; re-run the fairness and milestone suites |

---

## 6. Definition of "Feature Complete"

Every box must be checked and verified functional.

**Core**
- [ ] **C-01** Maze, Movement, Pellets & Run Structure
- [ ] **C-02** Baseline Ghost Behavior (Stage 0)
- [ ] **C-03** Habit Capture Engine
- [ ] **C-04a** Route Ghost (Pinky)
- [ ] **C-04b** Timing Ghost (Inky)
- [ ] **C-04c** Panic Ghost (Blinky)
- [ ] **C-05** Escape-Corridor Ambush
- [ ] **C-06** Visible Memory Trails
- [ ] **C-07** Entropy Meter & Score Multiplier
- [ ] **C-08** Visible Recalibration Hesitation
- [ ] **C-09** Habit Autopsy
- [ ] **C-10** Adaptation Pacing

**Supporting**
- [ ] **S-01** Pattern Break Stumble & Bonus
- [ ] **S-02** Prediction Moment Capture
- [ ] **S-03** Ghost Mind Cards
- [ ] **S-04** Recognition Callouts
- [ ] **S-05** Cause-of-Capture Line
- [ ] **S-06** Fairness Governor
- [ ] **S-07** Pause / Restart / End Run
- [ ] **S-08** Briefing Screen
- [ ] **S-09** Settings
- [ ] **S-10** Audio Cues
- [ ] **S-11** Mock Guest Session

**Stretch** *(complete only if time allows, but tracked)*
- [ ] **ST-01** Prediction Replay Viewer
- [ ] **ST-02** Run History & Comparison
- [ ] **ST-03** Lantern Pellets
- [ ] **ST-04** Touch / Swipe Controls

**Cross-cutting**
- [ ] No auth/login anywhere; mock session only
- [ ] Zero paid services
- [ ] Design.md palette, type, materials, and motion implemented; reduced-motion and colorblind variants work
- [ ] All Autopsy numbers match the debug export
- [ ] Milestones (trail ≤ 10 s, callout ≤ 45 s, ambush ≤ 90 s) met in simulator
- [ ] Fairness check passes (20 runs); zero softlocks; ≥ 55 fps
