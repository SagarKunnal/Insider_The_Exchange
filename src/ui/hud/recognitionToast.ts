import { CALLOUT_DISPLAY_MS, GHOST_CONFIG } from '../../data/tuning';
import type { GhostId } from '../../game/core/types';
import { springAnimate } from '../motion';

export function createRecognitionToast(): {
  element: HTMLElement;
  show: (ghostId: GhostId, message: string, reducedMotion: boolean) => void;
  clear: () => void;
} {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;top:76px;left:50%;transform:translateX(-50%);z-index:15;pointer-events:none;display:flex;flex-direction:column;gap:8px;align-items:center;';
  host.setAttribute('aria-live', 'polite');

  let activeTimer: ReturnType<typeof setTimeout> | null = null;

  const show = (ghostId: GhostId, message: string, reducedMotion: boolean) => {
    if (activeTimer) clearTimeout(activeTimer);
    host.innerHTML = '';

    const cfg = GHOST_CONFIG[ghostId];
    const pill = document.createElement('div');
    pill.className = 'mat-glassmorphism';
    pill.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:10px 18px;border-radius:999px;font-size:0.9rem;font-weight:600;color:var(--umber-ink);max-width:460px;';

    const orb = document.createElement('span');
    orb.style.cssText = `width:12px;height:12px;border-radius:50%;background:${cfg.colorHex};box-shadow:0 0 10px ${cfg.colorHex};flex-shrink:0;`;

    const text = document.createElement('span');
    text.textContent = message;

    pill.append(orb, text);
    host.appendChild(pill);

    springAnimate(pill, { opacity: [0, 1], y: [-14, 0] }, 'soft', reducedMotion);

    activeTimer = setTimeout(() => {
      pill.style.opacity = '0';
      pill.style.transition = 'opacity 180ms ease';
      setTimeout(() => {
        if (pill.parentNode === host) pill.remove();
      }, 200);
    }, CALLOUT_DISPLAY_MS);
  };

  const clear = () => {
    if (activeTimer) clearTimeout(activeTimer);
    host.innerHTML = '';
  };

  return { element: host, show, clear };
}
