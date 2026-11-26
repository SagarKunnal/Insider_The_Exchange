import { springAnimate } from '../motion';

export function createDrawer(opts: {
  ariaLabel: string;
  reducedMotion: boolean;
  onClose: () => void;
}): {
  backdrop: HTMLElement;
  drawer: HTMLElement;
  cleanup: () => void;
} {
  const backdrop = document.createElement('div');
  backdrop.className = 'glass-drawer-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', opts.ariaLabel);

  const drawer = document.createElement('aside');
  drawer.className = 'glass-drawer-panel mat-glassmorphism';
  backdrop.appendChild(drawer);

  springAnimate(drawer, { x: [80, 0], opacity: [0, 1] }, 'soft', opts.reducedMotion);

  const onBackdropClick = (ev: MouseEvent) => {
    if (ev.target === backdrop) opts.onClose();
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.code === 'Escape') {
      ev.stopPropagation();
      opts.onClose();
    }
  };

  backdrop.addEventListener('click', onBackdropClick);
  window.addEventListener('keydown', onKey);

  return {
    backdrop,
    drawer,
    cleanup: () => {
      backdrop.removeEventListener('click', onBackdropClick);
      window.removeEventListener('keydown', onKey);
    },
  };
}
