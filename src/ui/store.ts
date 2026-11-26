import { GHOST_CONFIG } from '../data/tuning';
import type { HudSnapshot, ScreenId } from '../game/core/types';

type Subscriber = (state: HudSnapshot) => void;

export function createInitialSnapshot(): HudSnapshot {
  return {
    screen: 'title',
    runId: 'run-init',
    elapsedS: 0,
    round: 1,
    score: 0,
    lives: 3,
    pelletsRemaining: 0,
    pelletsTotal: 0,
    entropy: 50,
    multiplier: 1.0,
    lanternRemainingS: 0,
    ghosts: {
      pinky: {
        ghostId: 'pinky',
        name: GHOST_CONFIG.pinky.name,
        epithet: GHOST_CONFIG.pinky.epithet,
        specialty: GHOST_CONFIG.pinky.specialty,
        mode: 'chase',
        confidence: 0,
        predictionLine: 'Observing your routes…',
      },
      inky: {
        ghostId: 'inky',
        name: GHOST_CONFIG.inky.name,
        epithet: GHOST_CONFIG.inky.epithet,
        specialty: GHOST_CONFIG.inky.specialty,
        mode: 'chase',
        confidence: 0,
        predictionLine: 'Timing your pace…',
      },
      blinky: {
        ghostId: 'blinky',
        name: GHOST_CONFIG.blinky.name,
        epithet: GHOST_CONFIG.blinky.epithet,
        specialty: GHOST_CONFIG.blinky.specialty,
        mode: 'chase',
        confidence: 0,
        predictionLine: 'Watching how you flinch…',
      },
    },
    trails: { route: true, timing: true, panic: true },
    paused: false,
  };
}

export class UiStore {
  private state: HudSnapshot = createInitialSnapshot();
  private subscribers = new Set<Subscriber>();

  getState(): HudSnapshot {
    return this.state;
  }

  setState(next: HudSnapshot): void {
    this.state = next;
    for (const fn of this.subscribers) {
      fn(this.state);
    }
  }

  patch(partial: Partial<HudSnapshot>): void {
    this.setState({ ...this.state, ...partial });
  }

  setScreen(screen: ScreenId): void {
    this.patch({ screen });
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    fn(this.state);
    return () => {
      this.subscribers.delete(fn);
    };
  }
}
