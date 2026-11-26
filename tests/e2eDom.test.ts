// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FIXED_DT_S } from '../src/data/tuning';
import { EventBus } from '../src/game/core/eventBus';
import { createWorld, endWorldRun, queueWorldInput, stepWorld } from '../src/game/core/world';
import { buildAutopsyFromWorld } from '../src/report/autopsyBuilder';
import { createSettingsDrawer } from '../src/ui/components/settingsDrawer';
import { renderAutopsyScreen } from '../src/ui/screens/autopsyScreen';
import { renderBriefingScreen } from '../src/ui/screens/briefingScreen';
import { createGameScreen } from '../src/ui/screens/gameScreen';
import { renderHistoryScreen } from '../src/ui/screens/historyScreen';
import { renderTitleScreen } from '../src/ui/screens/titleScreen';
import { createInitialSnapshot } from '../src/ui/store';

describe('End-to-End Screen DOM Verification', () => {
  it('mounts Title, Briefing, Game HUD, Settings Drawer, Autopsy, and Run History without console errors', () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));

    // 1. Title screen + SessionChip "Guest Haunt"
    const title = renderTitleScreen({
      onBeginHaunting: vi.fn(),
      onHowTheyLearn: vi.fn(),
      onSettings: vi.fn(),
      onRunHistory: vi.fn(),
      hasRunHistory: true,
      reducedMotion: true,
    });
    expect(title.element.textContent).toContain('Haunted by Yourself');
    expect(title.element.textContent).toContain('Guest Haunt');
    expect(title.element.textContent).toContain('Run History');
    title.cleanup();

    // 2. Briefing screen
    const briefing = renderBriefingScreen({
      onContinue: vi.fn(),
      onSkip: vi.fn(),
      reducedMotion: true,
    });
    expect(briefing.element.textContent).toContain('Pinky');
    expect(briefing.element.textContent).toContain('Inky');
    expect(briefing.element.textContent).toContain('Blinky');
    briefing.cleanup();

    // 3. Game HUD + Mind Cards + EntropyTube + TrailLegend + Pause Modal
    const game = createGameScreen({
      onPauseToggle: vi.fn(),
      onResume: vi.fn(),
      onRestart: vi.fn(),
      onSettings: vi.fn(),
      onEndRun: vi.fn(),
      onTrailsChange: vi.fn(),
      initialTrails: { route: true, timing: true, panic: true },
      reducedMotion: true,
    });
    const snap = createInitialSnapshot();
    game.updateHud(snap, true);
    game.showRecognition('pinky', 'Pinky has learned your favorite loop.', true);
    game.showCapture('Blinky was waiting in Moth Alley.');
    expect(game.element.textContent).toContain('Entropy');
    expect(game.element.textContent).toContain('Memory Trails');
    game.cleanup();

    // 4. Settings drawer
    const drawer = createSettingsDrawer({
      initial: { sound: true, volume: 0.7, trails: { route: true, timing: true, panic: true }, reducedMotion: true, colorblind: false },
      onChange: vi.fn(),
      onClose: vi.fn(),
    });
    expect(drawer.element.textContent).toContain('Reduced Motion');
    expect(drawer.element.textContent).toContain('Colorblind Patterns');
    drawer.cleanup();

    // 5. Simulation -> Autopsy screen
    const bus = new EventBus();
    const world = createWorld(9, 'dom-e2e');
    world.player.invulnUntilT = 30;
    queueWorldInput(world, 'W');
    for (let i = 0; i < 60 * 5; i += 1) {
      stepWorld(world, FIXED_DT_S, bus);
    }
    endWorldRun(world, 'manual', bus);
    const report = buildAutopsyFromWorld(world);
    const autopsy = renderAutopsyScreen({
      report,
      debugJson: '{}',
      reducedMotion: true,
      onHauntAgain: vi.fn(),
      onTitle: vi.fn(),
      onWatchClip: vi.fn(),
    });
    expect(autopsy.element.textContent).toContain('Habit Autopsy');
    expect(autopsy.element.textContent).toContain('Not enough habits yet');
    autopsy.cleanup();

    // 6. Run History screen
    const historyEl = renderHistoryScreen({
      runs: [
        { runId: 'r1', date: new Date().toISOString(), score: 500, rounds: 2, predictabilityIndex: 62, meanEntropy: 41, patternBreaks: 3 },
      ],
      onBack: vi.fn(),
    });
    expect(historyEl.textContent).toContain('Run History');
    expect(historyEl.textContent).toContain('Score 500');

    expect(errors).toEqual([]);
    spy.mockRestore();
  });
});
