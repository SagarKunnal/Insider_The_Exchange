import { springAnimate } from '../motion';

export function createModal(opts: {
  ariaLabel: string;
  maxWidthPx?: number;
  reducedMotion: boolean;
  onClose?: () => void;
}): {
  backdrop: HTMLElement;
  panel: HTMLElement;
  open: () => void;
  close: () => void;
  cleanup: () => void;
} {
  const backdrop = document.createElement('div');
  backdrop.className = 'glass-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', opts.ariaLabel);
  backdrop.hidden = true;
  backdrop.style.display = 'none';

  const panel = document.createElement('div');
  panel.className = 'glass-modal-panel mat-glassmorphism';
  panel.style.maxWidth = `${opts.maxWidthPx ?? 460}px`;
  backdrop.appendChild(panel);

  const onBackdropClick = (ev: MouseEvent) => {
    if (ev.target === backdrop && opts.onClose) {
      opts.onClose();
    }
  };
  backdrop.addEventListener('click', onBackdropClick);

  const open = () => {
    backdrop.hidden = false;
    backdrop.style.display = 'flex';
    springAnimate(panel, { opacity: [0, 1], scale: [0.96, 1] }, 'soft', opts.reducedMotion);
  };

  const close = () => {
    backdrop.hidden = true;
    backdrop.style.display = 'none';
  };

  return {
    backdrop,
    panel,
    open,
    close,
    cleanup: () => {
      backdrop.removeEventListener('click', onBackdropClick);
    },
  };
}
