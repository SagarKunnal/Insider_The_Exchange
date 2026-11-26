import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/game/core/eventBus';
import { AudioEngine } from '../src/platform/audio';
import { getDefaultSettings } from '../src/platform/settings';

describe('Phase 7 Design, Motion & Audio Cues (S-10)', () => {
  it('does not create AudioContext before user gesture and stays silent when muted', () => {
    const audio = new AudioEngine();
    const bus = new EventBus();
    const unbind = audio.bindToBus(bus);

    // Before user gesture, emitting events must not throw or crash
    expect(() => {
      bus.emit('pellet-collected', { t: 1, points: 10, isLantern: false });
      bus.emit('pattern-break', { t: 2, junctionId: 1, predictedExit: 'W', p: 0.8, chosenExit: 'N', bonus: 100 });
    }).not.toThrow();

    // Mute test with mocked AudioContext
    const createOsc = vi.fn(() => ({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }));
    vi.stubGlobal('window', {
      AudioContext: class {
        state = 'running';
        currentTime = 0;
        destination = {};
        createOscillator = createOsc;
        createGain = () => ({ gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() });
        resume = vi.fn(async () => {});
      },
    });

    const settings = getDefaultSettings();
    settings.sound = false;
    audio.applySettings(settings);
    audio.unlockFromGesture();
    bus.emit('capture', { t: 3, ghostId: 'blinky', causeLine: 'test', livesRemaining: 2 });
    expect(createOsc).not.toHaveBeenCalled();

    // Unmute and trigger cue
    settings.sound = true;
    audio.applySettings(settings);
    audio.unlockFromGesture();
    bus.emit('habit-locked', { t: 4, ghostId: 'pinky', category: 'route', message: 'test' });
    expect(createOsc).toHaveBeenCalled();

    unbind();
    vi.unstubAllGlobals();
  });
});
