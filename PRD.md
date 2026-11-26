# PRD.md — Haunted by Yourself

**Version:** 1.0 · **Track:** II, Learning / Adaptive Behavior (prompt: *The Haunted Algorithm*)
**Chain:** idea → **PRD.md** → architecture.md → Design.md → phase.md → rule.md

---

## 1. Product Overview

**Problem.** Game enemies are usually either dumb scripts that feel arbitrary, or hidden "smart" systems whose adaptation the player can't see. In both cases the player never learns that *they* are the thing being modeled. Players have strong unexamined habits (favorite turns, panic reflexes, hesitation spots), and games almost never show them.

**Product.** A browser-based, Pac-Man-style maze game. The player collects pellets while three ghosts learn three different layers of the player's behavior:

| Ghost | Specialty | Learns |
|---|---|---|
| **Pinky, "The Cartographer"** | Routes | Favorite turns, loops, junction transitions |
| **Inky, "The Clockwatcher"** | Timing & hesitation | Arrival cadence, dwell, stalls, reversals |
| **Blinky, "The Flincher"** | Panic | What the player does when cornered or threatened |

What each ghost knows is drawn on the maze as **visible memory trails**. The only way to score well is to become unpredictable, and an **entropy meter** measures that. At the end, a **Habit Autopsy** reports what the ghosts learned in specific, quotable terms.

**Target user.** Desktop-browser casual and mid-core arcade players, in 3–6 minute sessions.

**One-line value proposition.** A maze chase where the ghosts are built from your own habits, and the only way to win is to stop being predictable.

**Track compliance.** No machine learning. All adaptation uses movement history, decayed frequency tables, and explicit prediction rules.

---

## 2. Goals & Non-Goals

### Goals
1. Make adaptation **visible, legible, and personal** within the first two minutes of play.
2. Give each ghost a distinct, observable specialty.
3. Reward unpredictability with score, and give the player a skill to master: breaking their own patterns.
4. End every run with a truthful, specific Habit Autopsy.
5. Capture **every** feature of the finalized idea (see §4).

### Non-Goals (this build)
- **No login / signup / auth.** A mock guest session is assumed (S-11).
- No backend server, accounts, leaderboards, multiplayer, or cloud sync.
- No ML models or training.
- No payments or monetization.
- No native mobile app. Touch controls are a stretch item only (ST-04).
- No build-order, pitch, or presentation content in these documents.

---

## 3. User Personas

**P1: Arjun, 32, commuter casual.** Plays 3-minute sessions between tasks. *Motivation:* quick, satisfying, a bit funny. *Pain:* enemies that feel cheap or random; doesn't want a tutorial wall. Needs the "why did that ghost get me" answer in one line.

**P2: Dev, 24, pattern-hunting arcade enthusiast.** Replays to master a game. *Motivation:* sees the system and tries to beat it. *Pain:* adaptive AI that is invisible, so there's nothing to outplay. Wants to bait ghosts with fake habits.

**P3: Ishita, 21, game-design student.** Interested in how enemies "learn." *Motivation:* sees the mechanism, not just the result. *Pain:* "AI" claims with nothing inspectable. Wants trails, ghost mind cards, and Autopsy stats she can trust.

---

## 4. Feature List

**Origin key:** **Idea** = in the finalized idea. **Idea-risk** = added to mitigate the idea's stated weakness. **Added** = not in the original idea (flagged; not silently inserted).
**Priority:** Core = defines the win condition. Supporting = strengthens core. Stretch = if time allows.

### 4.1 Core Features

#### C-01 Maze, Movement, Pellets & Run Structure *(Idea: Pac-Man-style maze, collect pellets)*
Hand-authored 21×23 original maze: left-right symmetric, no dead ends, ≥4 loops, one wrap tunnel, central ghost den. Arrow/WASD movement with buffered turns. Pellets are collected by passing over them. Clearing all pellets starts the next Round (ghost memory persists). 3 lives. Every corridor has an ID and an authored nickname (used by the Autopsy).
**Story:** As a player, I want responsive grid movement with buffered turns, so that my turns reflect my intent and deaths feel fair.
**Acceptance criteria**
- Player moves at 6.0 tiles/s; a turn input is buffered for up to 250 ms before a junction.
- Pellet count and score update live; clearing the last pellet advances to Round n+1.
- Losing a life respawns the player with 2 s invulnerability; 0 lives ends the run.
- Maze validator passes: fully connected, no dead ends, all corridors have an ID and nickname.

#### C-02 Baseline Ghost Behavior (Stage 0) *(Idea: "at first… simple chasing rules")*
Before enough data exists, ghosts use simple rules: Blinky takes the shortest path to the player, Pinky targets 4 tiles ahead of the player, Inky chases when within 8 path-tiles and otherwise patrols. Ghosts leave the den at 0 s, 6 s, 12 s.
**Story:** As a player, I want ghosts to start as ordinary chasers, so that I can feel them get smarter.
**Acceptance criteria**
- Ghosts only reverse at junctions, never mid-corridor (except during Stumble/Recalibration).
- Each ghost's Stage 0 behavior is distinguishable by an observer.
- Ghosts fall back to Stage 0 for any decision where confidence < 0.45.

#### C-03 Habit Capture Engine *(Idea: ghosts "remember…" paths, turns, escapes)*
Records, run-scoped and surviving deaths and rounds: **DecisionEvents** (junction, entry dir, exit dir, relative turn, dwell ms, threat flag, timestamp), **ThreatEvents** (nearest ghost, distance, escape corridor chosen, survived?), **HesitationEvents** (stalls ≥ 250 ms, reversals, dwell ≥ 350 ms), and corridor traffic.
**Story:** As a ghost, I want a faithful record of how the player behaves, so that my predictions come from evidence.
**Acceptance criteria**
- Exactly one DecisionEvent per junction crossing.
- A decision is tagged `threat=true` when any ghost is within 6 path-tiles and approaching.
- Memory persists through life loss and Round change; resets only on a new run.
- A debug JSON export of all events exists for verification.

#### C-04 Three Specialist Ghosts *(Idea: three ghosts, each specializing in one kind of habit)*

**C-04a Route Ghost, Pinky.** Learns P(exit | junction, entry direction) and favorite loops; intercepts at the predicted next junction instead of chasing from behind.
**Story:** As a player, I want one ghost that learns my routes, so that repeating a loop gets punished.
**AC:** after ≥ 6 observations in a context, Pinky routes to the predicted junction's cut-off node; hits and misses are logged; two repeats of the same loop cause Pinky to wait at the loop's next junction.

**C-04b Timing Ghost, Inky.** Learns arrival cadence and hesitation. It estimates when the player will reach a junction and arrives at the same moment, and lurks at hesitation hotspots.
**Story:** As a player, I want a ghost that learns my timing, so that freezing at a junction is a real risk.
**AC:** a hotspot is registered after ≥ 3 dwells ≥ 350 ms at one junction; Inky arrives within ±0.5 s of the player's ETA in ≥ 60% of attempts (measured in the simulator).

**C-04c Panic Ghost, Blinky.** Learns what the player does when threatened: relative-turn bias (left/right/straight/U-turn) and preferred escape corridor.
**Story:** As a player, I want a ghost that learns my panic reflex, so that my instinctive escape stops working.
**AC:** after ≥ 5 threat decisions with ≥ 55% bias, Blinky approaches so as to block the biased turn; the "knew by" timestamp is recorded.

#### C-05 Escape-Corridor Ambush *(Idea: ambush at most-used escape corridor instead of chasing from behind)*
When the player's top escape corridor reaches confidence ≥ 0.40 with n ≥ 3, a ghost stops chasing and **waits near that corridor's exit**, telegraphing for 0.6 s. Ambush nodes are reserved, so two ghosts never take the same one.
**Story:** As a player, I want to see a ghost waiting where I usually flee, so that I understand my habit has been learned.
**AC:** the ambush ghost holds position ahead of the player's flight path; reservation prevents duplicates; telegraph glow is visible before the ghost is in position; ambushes are logged for the Autopsy.

#### C-06 Visible Memory Trails *(Idea: ghosts visibly carry your trail as a faint "memory")*
Three togglable trail layers drawn on the maze: **Route** (solid ink lines), **Timing** (rings pulsing at hesitation junctions), **Panic** (chevron streaks on escape corridors). Strength maps to opacity and thickness, and fades as memory decays.
**Story:** As a player, I want to see what the ghosts remember, so that adaptation is understandable instead of mysterious.
**AC:** first trail appears ≤ 10 s into play; more frequent behavior is visibly heavier; abandoned habits fade; each layer toggles independently; a legend explains the three layers; frame rate stays ≥ 55 fps.

#### C-07 Entropy (Unpredictability) Meter & Score Multiplier *(Idea: entropy meter that rewards breaking your own patterns; game scores you on unpredictability)*
A live 0–100 unpredictability value (formula in architecture.md §5.4) sets a score multiplier of 1.0×–3.0× on pellets.
**Story:** As a player, I want a live gauge of how predictable I am, so that I can deliberately change my behavior.
**AC:** meter responds within 3 junction decisions of a behavior change; the multiplier is shown and applied to pellet points; staying predictable lowers the multiplier toward 1.0×; value is always clamped to 0–100.

#### C-08 Visible Recalibration Hesitation *(Idea: ghosts visibly "hesitate" when behavior changes)*
When a ghost's confident predictions start failing (drift), it enters a 1.4 s **Recalibrating** state: it slows to 50%, wobbles with a "?" glyph, and its trail desaturates. Afterward, its affected memory is softened so it relearns faster.
**Story:** As a player, I want to see a ghost lose its footing when I change tactics, so that I feel rewarded for adapting.
**AC:** triggered when ≥ 3 of the last 4 confident predictions miss and prior rolling accuracy ≥ 50%; the visual state is unmistakable; speed is 50% for 1.4 s; each ghost's cooldown is 8 s.

#### C-09 Habit Autopsy *(Idea: end-of-run screen with specific, quotable stats)*
A results screen with templated, data-driven statements, e.g. "When scared you turned left 71% of the time. Blinky knew by 02:04." It also includes: favorite escape corridor, hesitation hotspots, favorite loop, per-ghost "knew by" time, Predictability Index, Pattern Break count, and an entropy-over-time chart.
**Story:** As a player, I want a truthful breakdown of my habits, so that I learn something real about how I play.
**AC:** every statement is computed from recorded data and shown only above its confidence threshold; a run with insufficient data shows an honest "not enough habits yet" state with partial stats; all numbers match the debug JSON export.

#### C-10 Adaptation Pacing (first two minutes) *(Idea-risk: "if adaptation isn't dramatic within the first two minutes, the idea falls flat")*
Early learning is accelerated (first 12 decisions are double-weighted) and the game guarantees visible milestones: first trail ≤ 10 s, first Recognition Callout ≤ 45 s, first ambush attempt ≤ 90 s (if play yields a confident habit).
**Story:** As a player, I want to see the ghosts learn quickly, so that the premise lands before I lose interest.
**AC:** in simulated runs of a habitual bot, all three milestones occur within their time targets; a milestone log is available in debug.

### 4.2 Supporting Features

#### S-01 Pattern Break Stumble & Bonus *(Added, from the ideation recommendation: "break your pattern with a payoff")*
When the player deliberately breaks a strong prediction, all ghosts **Stumble** (freeze and dizzy for 0.9 s), a bonus is awarded, and the entropy meter gets an impulse.
**Story:** As a player, I want out-of-character moves rewarded, so that unpredictability becomes a skill.
**AC:** triggers at a decision where the top predicted exit has p ≥ 0.55 and n ≥ 4 and the player picks a different non-reverse exit; 6 s cooldown; bonus = 100 × Round; counted in the Autopsy.

#### S-02 Prediction Moment Capture *(Idea: supports the optional replay)*
Tags "strong prediction" events (confident hit followed by the ghost within 3 tiles of the player within 2 s, or a capture) and stores a short positional clip per event (4 s before, 1 s after). Max 3 clips per run, ranked by confidence × consequence.
**Story:** As a player, I want the game to remember the moment I was predicted, so that I can revisit it.
**AC:** clips contain player and ghost positions plus the prediction overlay data; at most 3 are kept; capture overhead is negligible.

#### S-03 Ghost Mind Cards *(Added: HUD legibility for the idea's "visible adaptation")*
Three HUD cards, one per ghost, each showing specialty, a **learning bar** (confidence), state (Chasing / Predicting / Ambushing / Recalibrating / Stumbled), and a one-line "what I think you'll do."
**Story:** As a player, I want to see what each ghost currently believes, so that I can plan to defy it.
**AC:** bar and state update ≤ 100 ms after changes; the prediction line only shows above confidence 0.45; cards stay legible while the ghosts act.

#### S-04 Recognition Callouts *(Added)*
Brief toasts when a ghost first locks onto a habit, e.g. "Pinky has learned your favorite loop." Max one per ghost per 30 s.
**Story:** As a player, I want to be told when a habit has been learned, so that the learning moment is clear.
**AC:** fires on first confident prediction per habit category; rate-limited; never covers the playfield center.

#### S-05 Cause-of-Capture Line *(Added)*
On life loss, a one-line card explains the capture from the prediction record: "Blinky was waiting in Moth Alley. You've fled there 6 times."
**Story:** As a player, I want to know why I was caught, so that deaths feel earned.
**AC:** generated from the last prediction record; falls back to a neutral line if no prediction contributed; visible 1.5 s without blocking respawn.

#### S-06 Fairness Governor *(Added: safeguards the idea's "ambush" from becoming unwinnable)*
Guarantees: ghost speed ≤ 95% of player speed while ambushing; at most 2 ghosts within 5 tiles on the same side; at least one non-ambushed exit remains; ambushes telegraph before they close.
**Story:** As a player, I want ambushes to be beatable, so that adaptation feels clever and not cheap.
**AC:** in 20 simulated worst-case runs the player always has a non-ambushed exit at every decision.

#### S-07 Pause / Restart / End Run *(Added)*
Pause overlay (resume, restart, settings, end run → Autopsy). The game auto-pauses on tab blur.
**Story:** As a player, I want to pause and exit cleanly.
**AC:** simulation fully halts while paused; end run goes to the Autopsy; the timer does not advance during pause.

#### S-08 Briefing Screen *(Added)*
A short, skippable screen showing the three ghosts and what they learn.
**Story:** As a first-time player, I want a 15-second explanation, so that the premise is clear.
**AC:** skippable with one input; shown on first load, accessible later from the title screen.

#### S-09 Settings *(Added)*
Sound on/off and volume, trail layer defaults, reduced motion, colorblind pattern mode.
**Story:** As a player, I want to tune comfort and accessibility.
**AC:** settings persist locally; reduced motion removes parallax and spring overshoot; colorblind mode adds pattern differences to trails and ghosts.

#### S-10 Audio Cues *(Added)*
Synthesized cues for pellet, recognition, ambush telegraph, stumble, capture, and Pattern Break.
**Story:** As a player, I want audible feedback, so that learning moments register even when I'm not looking at them.
**AC:** each cue is distinct; global mute works; audio starts only after the first user gesture.

#### S-11 Mock Guest Session *(Added: infrastructure for the no-auth requirement)*
A hard-coded session `guest-local` ("Guest Haunt") is always active and shown as a chip.
**Story:** As a developer, I want a mock user, so that nothing blocks on auth.
**AC:** no login UI anywhere; session accessed only through the provider defined in architecture.md §9.

### 4.3 Stretch Features

#### ST-01 Prediction Replay Viewer *(Idea: "optional replay of the exact moment a ghost predicted you correctly")*
Replay a captured clip in slow motion with the ghost's predicted path overlaid. Scrubber and speed control.
**Story:** As a player, I want to rewatch the moment I was read, so that I see my own habit.
**AC:** plays clips from S-02; shows predicted vs. actual path; scrub and 0.25×/0.5×/1× speeds.

#### ST-02 Run History & Comparison *(Added)*
Last 10 run summaries stored locally, with an Autopsy comparison ("more predictable than last run").
**AC:** summaries persist; comparison shows Predictability Index and entropy deltas.

#### ST-03 Lantern Pellets *(Added)*
Four power pellets that briefly slow ghosts, giving the player a breathing window.
**AC:** ghosts slow to 60% for 5 s; they are never "eaten"; the Fairness Governor stays valid.

#### ST-04 Touch / Swipe Controls *(Added)*
**AC:** swipe sets the buffered direction; playable on a phone-sized viewport.

---

## 5. User Flows

**F-A: First run.** Title → (first load) Briefing → "Begin Haunting" → Round 1 → play → run ends (0 lives or End Run) → Habit Autopsy → [Replay Viewer (ST-01)] → Title or "Haunt Again."

**F-B: Learning loop (C-03 → C-04 → C-06).** Player crosses junction → DecisionEvent recorded → models update → trail strength updates → ghost confidence rises → mind card bar grows → Recognition Callout → prediction used in ghost steering.

**F-C: Ambush (C-05).** Player flees through the same corridor repeatedly → escape-corridor confidence ≥ 0.40 → ghost telegraphs → ghost holds the exit → player either breaks the pattern (S-01 Pattern Break) or is caught (S-05 line shown).

**F-D: Pattern Break and Recalibration (S-01, C-08).** Player picks an unexpected exit against a strong prediction → ghosts Stumble, bonus, entropy up → subsequent predictions miss → affected ghost enters Recalibrating → trail desaturates → memory softened → relearning.

**F-E: Entropy loop (C-07).** Behavior repeats → predictor hit rate up, entropy down → multiplier falls toward 1.0×; behavior varies → entropy up → multiplier rises toward 3.0×.

**F-F: Pause (S-07).** Esc or tab blur → Pause overlay → Resume / Restart / Settings / End Run.

**F-G: Autopsy (C-09).** Run end → data check → (sufficient) full statement set + chart + highlights; (insufficient) honest partial state.

---

## 6. Data Requirements

| Data | Source | Use |
|---|---|---|
| Player input and position | Live keyboard (or touch) | DecisionEvents, trails, timing |
| Ghost positions and states | Simulation | Threat detection, replay clips |
| Maze layout, corridor IDs, nicknames | Authored static data | Pathing, trail anchors, Autopsy language |
| Autopsy phrase templates | Authored static data | Quotable statements |
| Settings, run summaries, clips | Browser local storage | Persistence |

No external datasets or APIs are required; free-first policy is satisfied by default.

---

## 7. Success Metrics (informal)

- **Time-to-adaptation:** first trail ≤ 10 s, first callout ≤ 45 s, first ambush ≤ 90 s (habitual bot, simulator).
- **Legibility:** ≥ 70% of test players can name at least two ghost specialties after one run.
- **Responsiveness:** entropy meter reacts within 3 decisions of a behavior change.
- **Differential outcome:** an "always-left" bot is captured ≥ 2× faster than a random-walk bot after minute 2.
- **Autopsy truth:** ≥ 4 of 5 testers say a stat "sounds like me."
- **Stability:** zero softlocks across 20 simulated runs; ≥ 55 fps on a mid-range laptop.
- **Fairness:** new players survive an average of 90–240 s.

---

## 8. Edge Cases & Failure States

| Feature | Edge case | Expected behavior |
|---|---|---|
| C-01 | Input pressed between junctions | Buffered ≤ 250 ms, then discarded |
| C-01 | Tunnel wrap during a threat | Treated as a normal corridor in the graph |
| C-03 | Player stands still | Stall events recorded; no DecisionEvent spam |
| C-03 | Death mid-corridor | Pending event finalized as `survived=false`; memory kept |
| C-04 | Too little data | Stage 0 fallback |
| C-04 | Player stalls to farm Inky | Inky hovers; Fairness Governor caps proximity; others still chase |
| C-05 | Two ghosts choose the same node | Reservation assigns one; the other falls back |
| C-06 | Too many trails on screen | Strength-based thresholds hide weak entries; layer toggles |
| C-07 | Few predictions yet | Predictor term uses a neutral default; value clamped |
| C-07 | Player random-walks | High entropy is valid; multiplier rises as intended |
| C-08 | Repeated triggers | 8 s per-ghost cooldown |
| C-09 | Run < 45 s | "Not enough habits yet" state with partial stats |
| C-09 | Statement below threshold | Omitted, never fabricated |
| S-01 | Farming by oscillating | Requires non-reverse exit at a strong prediction, plus 6 s cooldown |
| S-02 | No strong event occurred | Replay section hidden or shows empty state |
| S-09 | Storage blocked | Settings fall back to in-memory defaults |

---

## 9. Out of Scope (explicit)
Login, signup, auth, accounts; payments; leaderboards and any server; multiplayer; ML training; native apps; demo, pitch, and marketing material; localization.

---

## 10. Flags & Open Items
1. **Ghost names.** Blinky/Pinky/Inky are used as working names (they match the idea's example quote). They are Namco-associated; display names are config-driven so they can be renamed trivially.
2. **Replay (ST-01)** is optional in the original idea. It is classified Stretch, but its data capture (S-02) is Supporting so it stays cheap to add.
3. **Added features** (S-01 through S-11, ST-02 through ST-04) are flagged above; none replace or simplify an original feature.
4. **Liquid Glass fidelity** is browser-dependent (see Design.md); this does not affect gameplay.
