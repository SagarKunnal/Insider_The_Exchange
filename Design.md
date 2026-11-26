# Design.md — Haunted by Yourself

**Chain:** PRD.md → architecture.md → **Design.md** → phase.md → rule.md
Every PRD feature with a UI surface appears in §7. All values below are the source of truth for implementation.

---

## 1. Design Philosophy

The game is about being *seen by something that has been watching you*, so the world is a **fogged greenhouse window at dusk**: warm, hushed, slightly uncanny, lit by candle-warm light rather than darkness. Haunting here is intimacy, not jump-scares: frosted glass that remembers where your fingers have been, brass instruments that measure you, and ghosts that look like glass jellies lit from within. Everything is lit from one source (top-left), everything is tactile, and everything moves with weight, like liquid and brass, never linear or robotic. The player should feel studied, not attacked.

---

## 2. Color System

**Why this palette:** warm fog and verdigris evoke old glasshouses and condensation, the "memory on glass" metaphor. Brass evokes instruments that measure you. Cinnabar and saffron are reserved for ghosts and danger. It deliberately avoids default dark mode, purple-blue gradients, and Material/Tailwind defaults, and it is warm everywhere (no pure black or white).

### Base and surfaces
| Token | Name | Hex | Use |
|---|---|---|---|
| `--fog-linen` | Fog Linen | `#E7E0D2` | Page base |
| `--parchment-haze` | Parchment Haze | `#F3EEE3` | Raised surfaces, neumorphic base |
| `--sage-mist` | Sage Mist | `#C5CFC3` | Corridor floor |
| `--moss-slate` | Moss Slate | `#4A5A52` | Maze walls |
| `--moss-deep` | Moss Deep | `#2F3D37` | Wall shadow, strong headings |
| `--pearl` | Pearl | `#FBF7EE` | Player, highlights |
| `--hedge` | Hedge Silhouette | `#AFBBAE` | Parallax far layer |

### Ink (text)
| Token | Hex | Use |
|---|---|---|
| `--umber-ink` | `#2A2622` | Primary text (≈ 12:1 on Fog Linen) |
| `--umber-soft` | `#5B544B` | Secondary text (≈ 6:1 on Fog Linen) |

### Accents
| Token | Name | Hex | Use |
|---|---|---|---|
| `--verdigris` | Verdigris | `#2F8F83` | Primary accent, Route Ghost (Pinky), high entropy |
| `--verdigris-deep` | Verdigris Deep | `#1F6359` | Accent *text* (≈ 6:1) |
| `--brass` | Brass | `#C28A2E` | Pellets, primary button, instrument trim |
| `--brass-light` / `--brass-dark` | | `#E2B866` / `#8C5F18` | Brass gradients |
| `--cinnabar` | Cinnabar | `#D2553F` | Panic Ghost (Blinky), danger, low entropy |
| `--cinnabar-deep` | | `#A83A27` | Danger text |
| `--saffron` | Saffron | `#E3A73B` | Timing Ghost (Inky) |
| `--saffron-deep` | | `#B57A12` | Saffron trails/text on light surfaces |

### Semantic
| Role | Hex |
|---|---|
| Success | Lichen `#6F9A4B` |
| Error | Oxblood `#9E3B33` |
| Warning | Saffron Deep `#B57A12` |
| Info | Verdigris Deep `#1F6359` |

### Glass tints
- `--glass-frost`: `rgba(251,247,238,0.52)`
- `--glass-fog`: `rgba(231,224,210,0.42)`
- `--glass-verdigris`: `rgba(47,143,131,0.14)`
- `--glass-scrim` *(text-bearing glass minimum)*: `rgba(243,238,227,0.78)`

### Background scene
Vertical gradient `#E7E0D2 → #D5D9CB`, with 4% SVG grain, a distant hedge silhouette layer, a mid fog layer, and sparse near-field condensation droplets. No dark mode is shipped.

**Translucency rule:** colored glass tints are never used behind body text. Text sits on `--glass-scrim` or a solid surface.

---

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| Display | **Fraunces** (variable; SOFT axis 100, WONK 0) | Warm, slightly eccentric serif; gives the "old parlor" voice |
| UI / Body | **Instrument Sans** | Clean, unfussy, not Inter/Roboto |
| Data / Stats | **IBM Plex Mono** (500) | Stat numerals and timestamps feel measured |

Fallbacks: `Georgia, 'Times New Roman', serif` / `system-ui, sans-serif` / `ui-monospace, monospace`.

| Level | Spec |
|---|---|
| Display XL (title) | Fraunces 700, 72/0.95, tracking −0.01em |
| H1 | Fraunces 600, 44/1.05 |
| H2 | Fraunces 600, 28/1.15 |
| H3 | Instrument Sans 600, 20/1.25 |
| Body | Instrument Sans 400, 16/1.5 |
| Body small | Instrument Sans 500, 14/1.45 |
| Caption / label | Instrument Sans 600, 12.5/1.4, uppercase, tracking 0.08em |
| Stat numeral | Plex Mono 500, 28–48/1.0 |

---

## 4. Material & Depth System

**One light source: top-left (315°).** Every highlight sits top-left; every shadow falls bottom-right. This is what keeps four material languages cohesive.

| Material | Applied to | Spec |
|---|---|---|
| **Liquid Glass** | Top HUD bar, entropy tube vessel, ghost bodies, Autopsy header | `backdrop-filter: blur(22px) saturate(1.6) brightness(1.04)`; 1px border `rgba(255,255,255,.55)` top-left and `rgba(120,110,95,.25)` bottom-right; inset highlight `inset 1px 1px 0 rgba(255,255,255,.7)`; **specular sheen** gradient follows the pointer via `--lx/--ly`; edge refraction via SVG `feDisplacementMap` (progressive enhancement) |
| **Glassmorphism** | Modals (Pause, Replay), Settings drawer, Mind Cards, toasts, Autopsy cards | `backdrop-filter: blur(16px) saturate(1.3)`; background `--glass-scrim` behind text; 1px frost border; shadow `0 18px 40px -18px rgba(60,52,40,.35)` |
| **Skeuomorphism** *(selective)* | Primary button (brass push-button), entropy tube (glass tube with brass caps and ticks), pellets (brass beads), Autopsy "dossier" header stamp | Brass gradient `#E9C277 → #C28A2E → #9A6A1E`; inner top highlight; bottom bevel; knurled 2px rim; press = 3 px travel |
| **Neumorphism** *(secondary only)* | Toggles, chips, secondary buttons, stat cards, sliders, trail-layer switches | Base `--parchment-haze`; extrude `-6px -6px 14px rgba(255,255,255,.85), 6px 6px 16px rgba(110,98,78,.28)`; inset `inset -3px -3px 7px rgba(255,255,255,.8), inset 4px 4px 9px rgba(110,98,78,.30)`; **always plus a 1.5px `rgba(74,90,82,.4)` outline** for contrast |

**Playfield material:** the maze is an **etched glass slab**. Corridors are inset Sage Mist floors; walls are raised Moss Slate ridges (`#55655C → #3F4E47`) with a top-left 1px highlight `rgba(255,255,255,.35)`; a faint frost overlay with soft vignette sits at the edges.

**Avoid:** more than one liquid-glass element competing in the same area; neumorphism on anything carrying critical state; stacking blur layers over the playfield (performance and legibility).

---

## 5. Component Specs

| Component | Look and materiality | States |
|---|---|---|
| **BrassButton (primary)** | Skeuomorphic brass push-button; Fraunces 600 label in Umber on brass | Default: raised. Hover: sheen sweeps across, +2% brightness. Active: 3 px press, shadow compresses, 90 ms. Disabled: desaturated brass, no sheen. Focus: 3px Verdigris ring, 3px offset. |
| **NeuButton (secondary)** | Neumorphic extrude, Instrument Sans 600 | Hover: shadow softens/expands. Active: inset. Disabled: flattened, 50% ink. |
| **NeuToggle** | Neumorphic track with a glassy brass thumb | Off: inset track. On: Verdigris-tinted inset, thumb slides with spring.gooey. |
| **NeuChip** | Small extruded pill (e.g., multiplier, session chip) | Static, or pressed when filtering. |
| **HudBar** | Liquid-glass bar: Round, lives (pearl orbs), score (Plex Mono), multiplier chip | Score ticks with a roll animation; multiplier chip pulses on change. |
| **EntropyTube** | Vertical glass tube with brass caps and ticks every 10; liquid fill with meniscus and bubbles; Cinnabar (low) → Saffron → Verdigris (high) | Fill changes with spring.gooey wobble; Pattern Break adds a bubble burst; reduced motion = no wobble. |
| **GhostMindCard** | Glass panel: ghost orb, name and epithet, **learning bar** (etched groove, glowing fill), state tag, prediction line | State tag changes by color *and* icon; Recalibrating = bar flickers; Ambushing = pulse. |
| **TrailLegend + LayerSwitches** | Small glass panel with three NeuToggles | Each toggle shows its pattern swatch (solid / ring / chevron). |
| **Toast (Recognition)** | Glass pill with ghost orb | Enters with spring.soft from the top rail; exits after 2.4 s. |
| **CaptureCard** | Glass strip across the lower third of the playfield | Fades in 180 ms, holds 1.5 s, fades out; never blocks input on respawn. |
| **Modal (Pause/Replay)** | Glassmorphic panel over a blurred, dimmed (not blackened) playfield | Open: scale .96 → 1 with spring.soft. |
| **SettingsDrawer** | Glass drawer sliding from the right with NeuToggles and a NeuSlider | Open/close spring.soft. |
| **AutopsyCard** | Glass card with Fraunces statement and Plex Mono stat | Reveals with staggered rise; "quote" statements have a brass underline. |
| **EntropyChart** | Etched-line area chart on a neumorphic inset panel; Verdigris line, Cinnabar baseline zone | Draws left-to-right on reveal (1.2 s). |
| **ReplayScrubber (ST-01)** | Neumorphic slider with a glassy thumb | Thumb scale on drag; speed chips 0.25×/0.5×/1×. |
| **SessionChip** | NeuChip "Guest Haunt" (mock session; non-interactive) | Static. |

**Ghost visuals (canvas):** glass jellies with a colored inner glow (Verdigris / Saffron / Cinnabar), a soft refraction highlight top-left, and a wavy hem animated at 6 Hz. Distinguishable without color via **eye/hem patterns**: Pinky = rounded hem; Inky = scalloped hem with a small clock-tick mark; Blinky = jagged hem. **Player:** a Pearl orb with a warm halo and a short motion smear.

---

## 6. Motion & Animation System

**Physical, not linear.** Motion uses springs wherever DOM or canvas objects have mass.

### Spring tokens
| Token | Stiffness / Damping / Mass | Feel | Use |
|---|---|---|---|
| `spring.soft` | 170 / 20 / 1 | Smooth settle (~450 ms) | Modals, drawers, toasts |
| `spring.snappy` | 320 / 26 / 1 | Quick, minimal overshoot | Buttons, chips |
| `spring.gooey` | 120 / 14 / 1 | Liquid overshoot | Entropy tube, toggle thumb |

### Easing and timing (non-spring)
- `ease.out` = `cubic-bezier(.22,1,.36,1)`; `ease.inout` = `cubic-bezier(.65,0,.35,1)`.
- Micro 120–180 ms · Panel 420–520 ms · Screen 650 ms.

### Screen transitions
Screens **cross-dissolve with depth**: the outgoing screen scales 1 → 0.98 and blurs 0 → 6px while the incoming screen rises 24px → 0 with `spring.soft`, 650 ms total. Autopsy enters with a "developing photograph" effect: the frost clears from the header outward.

### Micro-interactions per key action
| Action | Motion |
|---|---|
| Button press | Brass: 3px travel, 90 ms, shadow compress; Neu: extrude → inset, 120 ms |
| Pellet collected | Bead shrinks 1 → 0 with a 2px sparkle; score numerals roll |
| Multiplier change | Chip scales 1 → 1.15 → 1 (`spring.snappy`) |
| Trail layer toggle | Layer fades 200 ms; swatch thumb slides with `spring.gooey` |
| Recognition toast | Slides in from the top rail with `spring.soft`; ghost orb pulses once |
| Ambush telegraph | Ghost glow expands in 600 ms with a ring pulse toward its target node |
| Recalibrating | "?" glyph pops with `spring.gooey`; ghost wobble ±3° at 8 Hz for 1.4 s; trail desaturates over 300 ms |
| Pattern Break | All ghosts freeze with a squash (scale 1 → .88 → 1.04 → 1); halo bursts from the player; entropy tube bubble burst |
| Capture | Player orb dissolves into frost particles (500 ms); Capture card appears; screen vignette warms (not red) |
| Round clear | A frost wipe crosses the maze (700 ms), then the new round fades in |
| Autopsy reveal | Cards rise with stagger 90 ms; chart line draws 1.2 s; "knew by" markers drop in with `spring.snappy` |
| Loading / first paint | Fog layers drift in over 800 ms; the title fades up |

### Parallax zones
| Zone | Behavior |
|---|---|
| **Title screen** | Four layers (hedge, mid fog, droplets, frost vignette) at pointer-parallax factors 0.02 / 0.05 / 0.09 / 0.14, plus idle drift of ≤ 6px |
| **In-game background** | Fog and hedge layers shift opposite the player's movement by 2–6px; the playfield itself never moves |
| **Autopsy scroll** | Header layers scroll at 0.3×; card columns at 0.85× / 1× / 0.95× for depth; the chart panel lags slightly |
| **Briefing** | Ghost illustrations float at differing depths (±8px) following the pointer |

**Reduced motion:** disables parallax, spring overshoot, wobble, and screen blur; keeps fades ≤ 150 ms and state changes (these are information, not decoration).

---

## 7. Screen-by-Screen Design Spec

### 7.1 Title ("The Threshold")
- **Layout:** centered Fraunces Display XL title; subtitle "The ghosts are built from you." (Instrument Sans); brass **Begin Haunting** button (C-01 entry); NeuButtons for How They Learn (S-08), Settings (S-09), and Run History (ST-02, hidden if none); SessionChip "Guest Haunt" (S-11) at the top right.
- **Material/motion:** layered parallax scene (title zone); the title letters have subtle liquid-glass refraction; button sheen on hover.

### 7.2 Briefing ("How They Learn") — S-08
- Three glass cards, one per ghost (orb, epithet, one-sentence specialty: routes / timing / panic) with a miniature trail swatch each. Skip control: NeuButton "Skip".
- Cards float at different parallax depths; staggered entrance.

### 7.3 Game ("The Glasshouse") — C-01 to C-08, C-10, S-01 to S-06, S-10
- **Layout (desktop):** the playfield (21:23) center-left; a right rail with the **EntropyTube** (C-07), three **GhostMindCards** (S-03), and the **TrailLegend + LayerSwitches** (C-06); a **HudBar** across the top (Round, lives, score, multiplier chip, Pause).
- **Playfield:** etched glass slab (see §4); brass pellets; trail layers rendered above the floor and below the actors; ghosts and player above.
- **Trails (C-06):** Route = solid verdigris ink lines whose width and opacity (0.15 → 0.75) scale with strength; Timing = saffron rings pulsing at hesitation junctions; Panic = cinnabar chevron streaks pointing along escape direction. Colorblind mode adds distinct dash/ring/chevron patterns (already default) plus a higher-contrast outline.
- **Ambush (C-05):** target node shows a faint ring; the ghost telegraphs with a glow before arrival.
- **Recalibration (C-08), Pattern Break (S-01), Capture line (S-05), Recognition toast (S-04):** as in §6; all placed away from the playfield center.
- **Pacing (C-10):** no dedicated UI; the milestones are expressed through trails, mind-card bars, and toasts.
- **Mobile/narrow:** the right rail collapses below the playfield (tube becomes horizontal); mind cards compress to icon + bar.

### 7.4 Pause — S-07
- Glass modal over a blurred playfield: **Resume** (brass), **Restart**, **Settings**, **End Run** (NeuButtons). Esc toggles. Motion: spring.soft scale-in.

### 7.5 Settings drawer — S-09
- Glass drawer: Sound toggle + volume slider (S-10), default trail layers, Reduced Motion, Colorblind Patterns (all NeuToggles). Settings apply instantly.

### 7.6 Habit Autopsy — C-09 (and S-01/S-02 stats, ST-02)
- **Header (liquid glass):** "Habit Autopsy" with a brass "dossier stamp" showing Round reached and score.
- **Statement cards (Fraunces quotes):** templated lines — panic turn bias, favorite escape corridor (nicknamed), hesitation hotspots, favorite loop; each with its "knew by" marker. Statements below threshold are omitted.
- **Per-ghost row:** three compact cards showing the ghost, its specialty, "knew you by mm:ss," and hit rate.
- **Stats row (neumorphic cards, Plex Mono):** Predictability Index, Pattern Breaks, Peak multiplier, Rounds.
- **Entropy chart:** area chart over time, with the Recalibration and Pattern Break events marked.
- **Highlights (ST-01):** up to 3 clip thumbnails with "Watch the moment" NeuButtons.
- **Comparison (ST-02):** compact delta chips vs. the previous run.
- **Insufficient-data state:** a frosted card, "Not enough habits yet. The ghosts barely got to know you," with partial stats and a brass **Haunt Again**.
- **Footer:** brass **Haunt Again**, NeuButton **Title**.
- **Motion:** developing-photograph header reveal, staggered card rise, chart draw, scroll parallax (Autopsy zone).

### 7.7 Replay Viewer — ST-01
- Glass modal containing a replay canvas showing player and ghosts, the **predicted path** drawn as a dashed ghost-colored line against the actual path in Pearl; ReplayScrubber and speed chips; caption describing the prediction ("Pinky expected you to turn left at Lantern Row. 74% sure.").
- Motion: spring.soft open; slow-motion default (0.5×).

### 7.8 Run History — ST-02
- A glass list of the last 10 runs (neumorphic rows, Plex Mono stats) with a small sparkline of Predictability Index.

---

## 8. Accessibility Notes

- **Contrast:** body text ≥ 4.5:1 and large text ≥ 3:1. Text always sits on `--glass-scrim` or solid surfaces, never on raw blur. Accent *text* uses the `-deep` variants.
- **Neumorphic controls** always carry a 1.5px outline (≥ 3:1 against the surface) and a visible label; state is never conveyed by shadow alone.
- **Color independence:** ghosts and trails differ by **shape/pattern** (hem style, solid/ring/chevron), not just hue; mind-card states use icon + text. The entropy tube also shows the numeric value.
- **Focus:** all interactive elements show a 3px Verdigris ring with 3px offset; full keyboard operation (Tab/Enter/Esc); game controls are arrows/WASD.
- **Motion:** Reduced Motion setting (and `prefers-reduced-motion`) per §6.
- **Screen readers:** Autopsy statements are real text in reading order; HUD values use `aria-live="polite"` and throttle announcements (score every 5 s, lives immediately).
- **Glass fallback:** if `backdrop-filter` is unsupported or `prefers-reduced-transparency` is set, panels use opaque `--parchment-haze` with a border.

---

## 9. Explicit Login Placeholder Note

No login, signup, or auth screen is designed in this pass. The only identity surface is the non-interactive **SessionChip** ("Guest Haunt", S-11). When real auth is added, its screen slots in **before the Title screen** in the flow, and the SessionChip becomes the account entry point. No other navigation or design-system change is needed.
