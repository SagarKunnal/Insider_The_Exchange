# rule.md — Haunted by Yourself

**Chain:** PRD.md → architecture.md → Design.md → phase.md → **rule.md**
Strict build rules for any AI coding assistant or teammate. When a rule conflicts with convenience, the rule wins. When a rule seems wrong, follow §5 (Change Management); never silently deviate.

---

## 1. Non-Negotiable Rules

1. **No login, signup, or auth.** Use the mock session via `platform/session.ts` only (architecture §9). Never read identity from anywhere else.
2. **No paid APIs or services.** Any proposal must be flagged **PAID — justify** and approved first. Current policy: zero external APIs at runtime.
3. **No machine learning.** Adaptation uses recorded events, decayed frequency tables, and explicit rules only (track requirement).
4. **Do not skip or silently simplify any PRD feature.** Every ID (C-01 to C-10, S-01 to S-11, ST-01 to ST-04) must be built or explicitly flagged. Ask before cutting scope.
5. **Follow phase order.** Do not start a phase until the previous phase's Definition of Done is met (phase.md §2).
6. **Do not deviate from Design.md** colors, typography, material system, or motion tokens.
7. **Every displayed value must come from the engine.** No UI element, trail, mind-card line, or Autopsy statement may show data the simulation did not record or compute. No fabricated stats.
8. **Never add demo, pitch, or marketing content** to code, copy, or docs.
9. **The simulation never touches the DOM.** UI reads snapshots and events only.
10. **Fairness is a hard constraint.** The player must always have at least one non-ambushed exit (S-06). Never remove or bypass the Fairness Governor.

---

## 2. Code / Build Quality Rules

1. **Stack is fixed:** TypeScript, Vite, Canvas 2D, vanilla DOM + CSS custom properties, `motion` for springs, Web Audio, localStorage, Vitest. Do not add a framework or game engine.
2. **Folder structure** follows architecture §5.1. New files go in the matching module; do not create parallel structures.
3. **All tunable numbers live in `data/tuning.ts`.** No magic numbers in logic files.
4. **Naming:** files `camelCase.ts`; types/interfaces `PascalCase`; constants `UPPER_SNAKE_CASE`; events `kebab-case` strings in a typed union.
5. **Fixed-step simulation (60 Hz)** with clamped delta; the render loop only interpolates.
6. **Determinism:** use the seeded RNG in `rng.ts`; never call `Math.random()` inside simulation code.
7. **One source of truth per concept:** probabilities only in the models; confidence only from the shared confidence function; entropy only in `entropy.ts`.
8. **No duplicated logic:** shared geometry/path code lives in `graph.ts`; shared UI primitives live in `ui/components`.
9. **Typed events:** every bus event has a defined payload type. Subscribers must never mutate sim state.
10. **Pure functions for reporting:** `autopsyBuilder` is a pure function of run data, so it is testable with fixtures.
11. **Tests are required** for: maze validator, graph utilities, each model's probability math, entropy, drift detector, fairness governor, Pattern Break conditions, and Autopsy thresholds.
12. **No `any`, no `// @ts-ignore`** without a one-line justification comment.

---

## 3. Design Fidelity Rules

1. **Exact (must match Design.md):** all hex values, font families and weights, spring tokens (stiffness/damping/mass), parallax factors, blur values for each material, the light-source direction (top-left), and the neumorphic outline requirement.
2. **Interpretive (allowed):** exact illustration of ghost art and droplet placement, micro-copy polish, and small timing tweaks within ±15% of a specified value, as long as the feel (spring vs. linear) is preserved.
3. **One light source:** every highlight top-left, every shadow bottom-right. Reject any element that breaks this.
4. **Materials are assigned, not freelanced:** Liquid Glass, Glassmorphism, Skeuomorphism, and Neumorphism go only on the elements listed in Design §4. Do not add a new material to an element ad hoc.
5. **No blur layers over the game canvas** (performance and legibility). Blur appears only on the HUD, modals, and drawers.
6. **No default dark mode, no purple-blue gradients, no pure black or white, no default component-library look, no rocket-ship/cliché iconography.**
7. **Text never sits on raw blur or colored glass.** Use `--glass-scrim` or a solid surface.
8. **Ghosts and trails must stay distinguishable without color** (hem style; solid / ring / chevron).
9. **Motion is mandatory and physical:** use the spring tokens for objects with mass; every item in Design §6 must be implemented. Respect Reduced Motion exactly as specified.
10. **Fallbacks are part of the design:** implement the no-`backdrop-filter` fallback and the font fallbacks; do not ship a state that only works in one browser.

---

## 4. Error-Prevention Rules

1. **One DecisionEvent per junction visit.** Use a single-fire latch at the decision-zone boundary (phase 3 risk).
2. **Guard every division and probability.** Fall back to a uniform distribution on n = 0 or NaN; log it in debug.
3. **Below confidence 0.45, ghosts use Stage 0 behavior.** Never act on a low-confidence prediction.
4. **Respect cooldowns:** Pattern Break 6 s; Recalibration 8 s per ghost; Recognition callouts one per ghost per 30 s; ambush telegraph 0.6 s before closing.
5. **Pattern Break fires only when:** top predicted exit `p ≥ 0.55`, `n ≥ 4`, player chooses a different non-reverse exit, cooldown clear.
6. **Ambush node reservation is mandatory.** Two ghosts may never hold the same node; unreachable targets release their reservation.
7. **Ghost speed caps:** ambush ≤ 95% of player speed; base 90%; never exceed the player's speed.
8. **All storage access goes through `storage.ts` wrappers** with try/catch and an in-memory fallback. Never crash on blocked, full, or corrupt storage.
9. **Audio** creates/resumes the `AudioContext` only after a user gesture; failure means silence, not an error.
10. **Pause must freeze the simulation clock;** auto-pause on `visibilitychange`; clamp delta on resume.
11. **Autopsy statements are shown only above their thresholds.** Never pad with filler; use the honest empty state for sparse runs.
12. **Quality fallback:** if fps < 45, halve trail-layer resolution and disable ghost glow blur; never lower the simulation rate.
13. **Dev assertion:** each frame in dev builds asserts the player has at least one legal exit; any failure is a blocking bug.
14. **Simulator gates:** before leaving Phase 3, 4, and 5, run the Habit Simulator suites (entropy ranges, ambush behavior, milestones, 20-run fairness). A failing suite blocks the phase.

---

## 5. Change Management Rule

If any change to scope, stack, constants, or design is needed mid-build:

1. **Stop and flag it** in writing: what, why, and which documents it touches.
2. **Cross-check** against PRD.md (feature impact), architecture.md (component/data impact), Design.md (visual impact), and phase.md (phase/DoD impact).
3. **Update the affected documents first**, in chain order, then re-check every document after the changed one (PRD → architecture → Design → phase → rule).
4. **Get explicit approval** before implementing anything that removes, simplifies, or replaces a PRD feature.
5. **Tuning-value changes** (constants in `tuning.ts`) are allowed without document edits, but must be re-validated against the simulator suites and the milestone targets.
6. **Never** change scope, stack, palette, typography, or materials silently.

---

## 6. Definition of "Ready to Ship"

The core build is done only when **all** of the following hold:

1. The **Feature Complete checklist in phase.md §6 is fully checked**: all Core and Supporting items verified; Stretch items either complete or explicitly recorded as deferred.
2. No auth/login exists; the mock session is the only identity path.
3. Zero paid services; no runtime external API calls.
4. Simulator suites pass: milestones (first trail ≤ 10 s, first callout ≤ 45 s, first ambush ≤ 90 s), entropy ranges (`alwaysLeft` < 30, `randomWalk` > 70 at 90 s), 20-run fairness, zero softlocks.
5. Every Autopsy number matches the debug JSON export; thresholds enforced; empty state verified.
6. Design.md implemented: palette, typography, materials, springs, parallax zones, reduced-motion, colorblind, and glass fallbacks all verified.
7. Contrast checks pass; full keyboard operation works.
8. ≥ 55 fps during active play on a mid-range laptop profile.
9. A fresh human playtest confirms that adaptation is visible within the first two minutes and that Autopsy statements feel true.
10. No open "flagged" items remain unresolved in the Change Management log.
