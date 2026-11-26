import { animate } from 'motion';
import { SPRING_TOKENS } from '../data/tuning';

export type SpringName = keyof typeof SPRING_TOKENS;

export function isReducedMotionPreferred(settingReducedMotion = false): boolean {
  if (settingReducedMotion) return true;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

/**
 * Animates a DOM element with Design.md spring tokens via `motion` (motion.dev),
 * falling back to <=150ms fade when reduced motion is enabled.
 */
export function springAnimate(
  el: HTMLElement,
  keyframes: Record<string, string | number | Array<string | number>>,
  springName: SpringName,
  reducedMotion = false,
): void {
  if (isReducedMotionPreferred(reducedMotion)) {
    animate(el, keyframes as Parameters<typeof animate>[1], { duration: 0.12 });
    return;
  }
  const token = SPRING_TOKENS[springName];
  animate(el, keyframes as Parameters<typeof animate>[1], {
    type: 'spring',
    stiffness: token.stiffness,
    damping: token.damping,
    mass: token.mass,
  });
}

/**
 * Screen cross-dissolve with depth (Design.md §6, 650ms total):
 * Outgoing scales 1 -> 0.98 and blurs 0 -> 6px while incoming rises 24px -> 0 with spring.soft.
 */
export function transitionScreen(
  host: HTMLElement,
  incoming: HTMLElement,
  reducedMotion: boolean,
): void {
  const existing = Array.from(host.children) as HTMLElement[];
  if (existing.length === 0 || isReducedMotionPreferred(reducedMotion)) {
    host.innerHTML = '';
    host.appendChild(incoming);
    if (!isReducedMotionPreferred(reducedMotion)) {
      springAnimate(incoming, { opacity: [0, 1], y: [24, 0] }, 'soft', false);
    }
    return;
  }

  for (const oldEl of existing) {
    oldEl.style.pointerEvents = 'none';
    oldEl.style.position = 'absolute';
    oldEl.style.inset = '0';
    animate(
      oldEl,
      { opacity: [1, 0], scale: [1, 0.98], filter: ['blur(0px)', 'blur(6px)'] } as Parameters<typeof animate>[1],
      { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
    );
    setTimeout(() => oldEl.remove(), 420);
  }

  host.appendChild(incoming);
  springAnimate(incoming, { opacity: [0, 1], y: [24, 0] }, 'soft', false);
}

/**
 * Updates --lx and --ly CSS custom properties on a Liquid Glass surface for pointer specular sheen.
 */
export function bindLiquidSheen(el: HTMLElement): () => void {
  const onMove = (ev: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
    el.style.setProperty('--lx', `${x.toFixed(1)}%`);
    el.style.setProperty('--ly', `${y.toFixed(1)}%`);
  };
  el.addEventListener('pointermove', onMove);
  return () => el.removeEventListener('pointermove', onMove);
}
