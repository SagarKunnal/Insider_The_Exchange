import { getSession } from '../../platform/session';

/**
 * Non-interactive NeuChip displaying the active session (S-11).
 * Reads exclusively from platform/session.ts.
 */
export function createSessionChip(): HTMLElement {
  const session = getSession();
  const chip = document.createElement('div');
  chip.className = 'neu-chip';
  chip.setAttribute('aria-label', `Active session: ${session.displayName}`);
  chip.dataset.sessionId = session.userId;

  const dot = document.createElement('span');
  dot.style.width = '8px';
  dot.style.height = '8px';
  dot.style.borderRadius = '50%';
  dot.style.background = 'var(--verdigris)';
  dot.style.display = 'inline-block';

  const label = document.createElement('span');
  label.textContent = session.displayName;

  chip.append(dot, label);
  return chip;
}
