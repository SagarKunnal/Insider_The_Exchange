import { CAPTURE_CARD_DISPLAY_MS } from '../../data/tuning';

export function createCaptureCard(): {
  element: HTMLElement;
  show: (causeLine: string) => void;
  clear: () => void;
} {
  const strip = document.createElement('div');
  strip.className = 'mat-glassmorphism';
  strip.style.cssText =
    'position:absolute;left:50%;bottom:24px;transform:translateX(-50%);padding:10px 18px;border-radius:14px;font-size:0.9rem;font-weight:600;color:var(--umber-ink);pointer-events:none;opacity:0;transition:opacity 180ms ease;z-index:12;max-width:90%;text-align:center;';
  strip.setAttribute('aria-live', 'polite');

  let timer: ReturnType<typeof setTimeout> | null = null;

  const show = (causeLine: string) => {
    if (timer) clearTimeout(timer);
    strip.textContent = causeLine;
    strip.style.opacity = '1';
    timer = setTimeout(() => {
      strip.style.opacity = '0';
    }, CAPTURE_CARD_DISPLAY_MS);
  };

  const clear = () => {
    if (timer) clearTimeout(timer);
    strip.style.opacity = '0';
  };

  return { element: strip, show, clear };
}
