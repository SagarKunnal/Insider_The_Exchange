// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createFullAutopsyFixture, createMidRunInspectFixture } from '../src/dev/previewFixtures';
import { createAutopsyCard } from '../src/ui/components/autopsyCard';
import { createBrassButton, createNeuButton, createNeuChip } from '../src/ui/components/buttons';
import { createDrawer } from '../src/ui/components/drawer';
import { createEntropyChart } from '../src/ui/components/entropyChart';
import { createModal } from '../src/ui/components/modal';
import { createNeuSlider, createNeuToggle } from '../src/ui/components/neuToggle';
import { createEntropyTube } from '../src/ui/hud/entropyTube';
import { createGhostMindCards } from '../src/ui/hud/ghostMindCards';
import { createHudBar } from '../src/ui/hud/hudBar';
import { createRecognitionToast } from '../src/ui/hud/recognitionToast';
import { renderAutopsyScreen } from '../src/ui/screens/autopsyScreen';
import { createGameScreen } from '../src/ui/screens/gameScreen';
import { createReplayModal } from '../src/ui/screens/replayModal';

describe('Senior UI Component Library, Realistic States & Design Rules', () => {
  it('exposes all 12 reusable Design.md components with proper states and accessibility', () => {
    const brass = createBrassButton('Begin Haunting', vi.fn(), { disabled: true });
    expect(brass.className).toContain('brass-btn');
    expect(brass.disabled).toBe(true);

    const neu = createNeuButton('Skip', vi.fn());
    expect(neu.className).toContain('neu-btn');

    const toggle = createNeuToggle({ label: 'Routes', checked: true, onChange: vi.fn() });
    expect(toggle.element.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');

    const slider = createNeuSlider({ label: 'Volume', min: 0, max: 100, value: 70, onChange: vi.fn() });
    expect(slider.element.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('70');

    const chip = createNeuChip('2.4×', { pressed: true, onClick: vi.fn() });
    expect(chip.className).toContain('is-pressed');

    const hud = createHudBar(vi.fn());
    expect(hud.element.className).toContain('mat-liquid-glass');
    hud.cleanup();

    const tube = createEntropyTube();
    tube.update(78, true);
    expect(tube.element.textContent).toContain('78');

    const cards = createGhostMindCards();
    expect(cards.element.querySelectorAll('.ghost-mind-card').length).toBe(3);

    const toast = createRecognitionToast();
    toast.show('pinky', 'Pinky has learned your favorite loop.', true);
    expect(toast.element.textContent).toContain('Pinky');
    toast.clear();

    const modal = createModal({ ariaLabel: 'Paused', reducedMotion: true });
    modal.open();
    expect(modal.backdrop.hidden).toBe(false);
    modal.cleanup();

    const drawer = createDrawer({ ariaLabel: 'Settings', reducedMotion: true, onClose: vi.fn() });
    expect(drawer.backdrop.getAttribute('role')).toBe('dialog');
    drawer.cleanup();

    const fx = createFullAutopsyFixture();
    const card = createAutopsyCard(fx.report.statements[0]);
    expect(card.textContent).toContain('71%');

    const chart = createEntropyChart(fx.report.entropyTimeline, true);
    expect(chart.querySelector('svg')).not.toBeNull();
  });

  it('wires realistic mid-run (with recalibrating ghost), full Autopsy, and Replay states without banned clichés', () => {
    const mid = createMidRunInspectFixture();
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
    game.updateHud(mid.snapshot, true);

    expect(game.element.textContent).toContain('Recalibrating');
    expect(game.element.textContent).toContain('Ambushing');
    expect(game.element.textContent).toContain('Predicting');
    // Custom SVG icons used for ghost shapes & modes, zero emoji or raw Unicode arrows
    expect(game.element.querySelectorAll('.ghost-mind-card svg').length).toBeGreaterThanOrEqual(6);
    expect(game.element.textContent).not.toMatch(/[→◎⚑✦🚀🔥]/);
    game.cleanup();

    const autopsyFx = createFullAutopsyFixture();
    const autopsy = renderAutopsyScreen({
      report: autopsyFx.report,
      previousRun: autopsyFx.previousRun,
      debugJson: '{}',
      reducedMotion: true,
      onHauntAgain: vi.fn(),
      onTitle: vi.fn(),
      onWatchClip: vi.fn(),
    });
    expect(autopsy.element.textContent).toContain('When scared you turned left 71% of the time.');
    expect(autopsy.element.textContent).toContain('Knew you by 02:04');
    expect(autopsy.element.textContent).toContain('7% less predictable than last run');
    autopsy.cleanup();

    // Verify Replay modal mounts cleanly (mock canvas 2d in jsdom)
    const origGetCtx = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
    })) as unknown as typeof origGetCtx;

    const replay = createReplayModal({
      clip: autopsyFx.clip,
      maze: mid.world.maze,
      reducedMotion: true,
      onClose: vi.fn(),
    });
    expect(replay.element.textContent).toContain('Pinky expected you to turn left at Lantern Row.');
    expect(replay.element.textContent).toContain('0.25×');
    expect(replay.element.textContent).toContain('0.5×');
    expect(replay.element.textContent).toContain('1×');
    replay.cleanup();
    HTMLCanvasElement.prototype.getContext = origGetCtx;
  });
});
