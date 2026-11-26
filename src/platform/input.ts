import type { Direction } from '../game/core/types';

export interface InputHandlers {
  onDirection: (dir: Direction) => void;
  onPauseToggle: () => void;
}

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'N',
  KeyW: 'N',
  ArrowRight: 'E',
  KeyD: 'E',
  ArrowDown: 'S',
  KeyS: 'S',
  ArrowLeft: 'W',
  KeyA: 'W',
};

export function bindKeyboardInput(handlers: InputHandlers): () => void {
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.code === 'Escape') {
      ev.preventDefault();
      handlers.onPauseToggle();
      return;
    }
    const dir = KEY_TO_DIR[ev.code];
    if (dir) {
      ev.preventDefault();
      handlers.onDirection(dir);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}

export function bindTouchSwipeInput(
  target: HTMLElement,
  onDirection: (dir: Direction) => void,
): () => void {
  let startX = 0;
  let startY = 0;
  let active = false;
  const SWIPE_THRESHOLD_PX = 22;

  const onTouchStart = (ev: TouchEvent) => {
    if (ev.touches.length === 0) return;
    startX = ev.touches[0].clientX;
    startY = ev.touches[0].clientY;
    active = true;
  };

  const onTouchMove = (ev: TouchEvent) => {
    if (!active || ev.touches.length === 0) return;
    const dx = ev.touches[0].clientX - startX;
    const dy = ev.touches[0].clientY - startY;
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD_PX) return;

    if (Math.abs(dx) >= Math.abs(dy)) {
      onDirection(dx > 0 ? 'E' : 'W');
    } else {
      onDirection(dy > 0 ? 'S' : 'N');
    }
    startX = ev.touches[0].clientX;
    startY = ev.touches[0].clientY;
  };

  const onTouchEnd = () => {
    active = false;
  };

  target.addEventListener('touchstart', onTouchStart, { passive: true });
  target.addEventListener('touchmove', onTouchMove, { passive: true });
  target.addEventListener('touchend', onTouchEnd, { passive: true });

  return () => {
    target.removeEventListener('touchstart', onTouchStart);
    target.removeEventListener('touchmove', onTouchMove);
    target.removeEventListener('touchend', onTouchEnd);
  };
}
