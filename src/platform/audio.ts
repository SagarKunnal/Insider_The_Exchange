import type { EventBus } from '../game/core/eventBus';
import type { Settings } from '../game/core/types';

export type AudioCueName =
  | 'pellet'
  | 'recognition'
  | 'ambush-telegraph'
  | 'stumble'
  | 'capture'
  | 'pattern-break'
  | 'round-clear';

/**
 * Synthesized Web Audio cues (S-10).
 * Lazily creates/resumes AudioContext only after first user gesture (rule.md §4.9).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private enabled = true;
  private volume = 0.7;

  applySettings(settings: Settings): void {
    this.enabled = settings.sound;
    this.volume = Math.max(0, Math.min(1, settings.volume));
  }

  unlockFromGesture(): void {
    this.unlocked = true;
    if (!this.enabled) return;
    this.ensureContext();
  }

  private ensureContext(): AudioContext | null {
    if (!this.unlocked || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playCue(cue: AudioCueName): void {
    if (!this.enabled || this.volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = this.volume * 0.18;

    const playTone = (
      freqStart: number,
      freqEnd: number,
      dur: number,
      type: OscillatorType,
      offsetS = 0,
      gainMul = 1,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now + offsetS);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + offsetS + dur);
      gain.gain.setValueAtTime(0.0001, now + offsetS);
      gain.gain.linearRampToValueAtTime(master * gainMul, now + offsetS + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offsetS + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offsetS);
      osc.stop(now + offsetS + dur + 0.02);
    };

    switch (cue) {
      case 'pellet':
        playTone(540, 660, 0.06, 'sine', 0, 0.45);
        break;
      case 'recognition':
        playTone(523.25, 659.25, 0.14, 'triangle', 0, 0.8);
        playTone(783.99, 783.99, 0.18, 'sine', 0.09, 0.6);
        break;
      case 'ambush-telegraph':
        playTone(196, 146.8, 0.32, 'sawtooth', 0, 0.55);
        break;
      case 'stumble':
        playTone(420, 210, 0.2, 'triangle', 0, 0.7);
        break;
      case 'capture':
        playTone(260, 92, 0.42, 'sawtooth', 0, 0.85);
        playTone(180, 68, 0.45, 'sine', 0.04, 0.7);
        break;
      case 'pattern-break':
        playTone(440, 554.37, 0.12, 'triangle', 0, 0.85);
        playTone(659.25, 880, 0.22, 'sine', 0.08, 0.9);
        break;
      case 'round-clear':
        playTone(392, 392, 0.12, 'sine', 0, 0.7);
        playTone(493.88, 493.88, 0.12, 'sine', 0.1, 0.7);
        playTone(587.33, 587.33, 0.14, 'sine', 0.2, 0.75);
        playTone(783.99, 783.99, 0.28, 'triangle', 0.3, 0.85);
        break;
    }
  }

  bindToBus(bus: EventBus): () => void {
    const unsubs = [
      bus.on('pellet-collected', (e) => this.playCue(e.isLantern ? 'recognition' : 'pellet')),
      bus.on('habit-locked', () => this.playCue('recognition')),
      bus.on('ambush-telegraph', () => this.playCue('ambush-telegraph')),
      bus.on('recalibrate-start', () => this.playCue('stumble')),
      bus.on('pattern-break', () => this.playCue('pattern-break')),
      bus.on('capture', () => this.playCue('capture')),
      bus.on('round-clear', () => this.playCue('round-clear')),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }
}
