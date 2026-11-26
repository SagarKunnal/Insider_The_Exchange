# Haunted by Yourself

A client-side, Pac-Man-style maze chase built with TypeScript, Canvas 2D, and Vite. Three ghosts model distinct layers of your movement habits using decayed frequency tables and explicit prediction rules (no machine learning), draw what they learn as visible memory trails on the maze, and report their findings in a post-run **Habit Autopsy**.

## How It Works

- **Pinky (*The Cartographer*) — Routes:** Learns transition probabilities `P(exit | junction, entryDir)` and loop repetitions; intercepts at predicted cut-off junctions with solid Verdigris ink trails.
- **Inky (*The Clockwatcher*) — Timing & Hesitation:** Tracks corridor traversal pace and junction dwell hotspots (`>= 3` dwells `>= 350 ms`), arriving to match your ETA and pulsing Saffron rings at stall spots.
- **Blinky (*The Flincher*) — Panic:** Learns relative-turn reflexes and escape corridors under threat, approaching to block biased turns and setting telegraphed ambushes with Cinnabar chevrons.
- **Entropy & Pattern Breaks:** An unpredictability gauge (`0–100`) drives a `1.0×–3.0×` pellet score multiplier. Choosing a non-reverse exit against a strong prediction triggers a **Pattern Break** (bonus points and a `0.9 s` ghost stumble).
- **Drift & Recalibration:** Switching habits causes the affected ghost to visibly wobble (`?`) at 50% speed for `1.4 s` and soften its prior memory.
- **Fairness Governor:** Enforces ghost speed caps (`<= 95%` when ambushing), caps same-side proximity, and guarantees at least one non-ambushed exit at every decision.

## Controls

- **Move:** Arrow keys or `WASD` (250 ms turn buffer before junctions), or touch swipe on mobile viewports.
- **Pause:** `Esc` (auto-pauses on tab blur).

## Stack & Architecture

- **Runtime:** 100% client-side (`TypeScript`, `Vite`, `Canvas 2D`, vanilla DOM + CSS custom properties, `motion`, `@fontsource`, Web Audio API, `localStorage` with in-memory fallback). Zero external runtime APIs or backend services.
- **Simulation:** Fixed `60 Hz` deterministic simulation in `src/game/` decoupled from the DOM; UI subscribes to `10 Hz` snapshots and typed `EventBus` events.
- **Identity:** Mock guest session (`guest-local` / `Guest Haunt`) isolated behind `src/platform/session.ts`.
- **Testing:** `Vitest` unit suites and a headless Habit Simulator (`src/dev/habitSimulator.ts`) covering maze validation, probability math, entropy separation, milestones, fairness, Autopsy parity, audio gating, and DOM rendering.

## Scripts

```bash
npm install        # Install dependencies
npm run dev        # Start local Vite dev server
npm test           # Run all 11 Vitest suites (45 tests)
npm run build      # Type-check (tsc --noEmit) and build production bundle
```

### URL Inspection Views (during `npm run dev`)

- `/?inspect=midrun` — Mid-run state with active trails and a recalibrating ghost
- `/?inspect=autopsy` — Full Habit Autopsy dossier and entropy chart
- `/?inspect=replay` — Prediction Replay Viewer modal (`0.25×` / `0.5×` / `1×`)
- `/?inspect=briefing` — Three-ghost Briefing screen

## Project Documents

- [PRD.md](PRD.md) — Product requirements and acceptance criteria
- [architecture.md](architecture.md) — Module layout, schemas, and algorithms
- [Design.md](Design.md) — Color palette, typography, materials, and motion tokens
- [phase.md](phase.md) — Phase sequencing and Definitions of Done
- [rule.md](rule.md) — Build, design fidelity, and change-management rules
- [memory.md](memory.md) — Build and verification log
