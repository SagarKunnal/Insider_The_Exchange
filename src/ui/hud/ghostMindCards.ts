import { CONFIDENCE_ACT_THRESHOLD, GHOST_CONFIG } from '../../data/tuning';
import type { GhostId, GhostMindSnapshot, GhostMode } from '../../game/core/types';
import { iconGhostShape, iconMode } from '../components/icons';

const MODE_META: Record<GhostMode, { label: string; color: string }> = {
  chase: { label: 'Chasing', color: 'var(--umber-soft)' },
  predict: { label: 'Predicting', color: 'var(--verdigris-deep)' },
  ambush: { label: 'Ambushing', color: 'var(--cinnabar-deep)' },
  recalibrate: { label: 'Recalibrating', color: 'var(--saffron-deep)' },
  stumble: { label: 'Stumbled', color: 'var(--umber-soft)' },
};

export function createGhostMindCards(): {
  element: HTMLElement;
  update: (ghosts: Record<GhostId, GhostMindSnapshot>) => void;
} {
  const stack = document.createElement('div');
  stack.className = 'mind-cards-stack';
  stack.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

  const cardMap = new Map<
    GhostId,
    {
      card: HTMLElement;
      barFill: HTMLElement;
      stateEl: HTMLElement;
      lineEl: HTMLElement;
      pctEl: HTMLElement;
    }
  >();

  for (const id of ['pinky', 'inky', 'blinky'] as const) {
    const cfg = GHOST_CONFIG[id];
    const card = document.createElement('article');
    card.className = 'ghost-mind-card mat-glassmorphism';
    card.style.cssText =
      `padding:12px 14px;border-radius:14px;border-left:3px solid ${cfg.colorHex};display:flex;flex-direction:column;gap:6px;transition:box-shadow 220ms ease,transform 220ms ease;`;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const shapeWrap = document.createElement('span');
    shapeWrap.style.cssText = 'display:inline-flex;flex-shrink:0;';
    shapeWrap.innerHTML = iconGhostShape(id, cfg.colorHex, 20);

    const nameBlock = document.createElement('div');
    nameBlock.innerHTML = `<strong style="font-size:0.95rem;color:var(--umber-ink);">${cfg.name}</strong> <span style="font-size:0.78rem;color:var(--umber-soft);">· ${cfg.epithet}</span>`;

    titleWrap.append(shapeWrap, nameBlock);

    const stateEl = document.createElement('span');
    stateEl.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;font-weight:600;white-space:nowrap;padding:3px 8px;border-radius:999px;background:rgba(251,247,238,0.68);border:1px solid rgba(74,90,82,0.16);';
    stateEl.innerHTML = `${iconMode('chase', 'var(--umber-soft)')}<span>Chasing</span>`;

    header.append(titleWrap, stateEl);

    const barRow = document.createElement('div');
    barRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const groove = document.createElement('div');
    groove.className = 'mat-neu-inset';
    groove.style.cssText =
      'flex:1;height:8px;border-radius:999px;overflow:hidden;border-width:1px;';

    const barFill = document.createElement('div');
    barFill.className = 'mind-bar-fill';
    barFill.style.cssText = `height:100%;width:0%;background:${cfg.colorHex};border-radius:999px;transition:width 140ms var(--ease-out),opacity 150ms ease;`;
    groove.appendChild(barFill);

    const pctEl = document.createElement('span');
    pctEl.className = 'type-stat';
    pctEl.style.cssText = 'font-size:0.75rem;min-width:34px;text-align:right;color:var(--umber-soft);';
    pctEl.textContent = '0%';

    barRow.append(groove, pctEl);

    const lineEl = document.createElement('div');
    lineEl.style.cssText = 'font-size:0.8125rem;color:var(--umber-soft);min-height:1.2em;';
    lineEl.textContent = `Studying ${cfg.specialty.toLowerCase()}…`;

    card.append(header, barRow, lineEl);
    stack.appendChild(card);
    cardMap.set(id, { card, barFill, stateEl, lineEl, pctEl });
  }

  const update = (ghosts: Record<GhostId, GhostMindSnapshot>) => {
    for (const id of ['pinky', 'inky', 'blinky'] as const) {
      const entry = cardMap.get(id);
      const snap = ghosts[id];
      if (!entry || !snap) continue;

      const pct = Math.round(Math.max(0, Math.min(1, snap.confidence)) * 100);
      entry.barFill.style.width = `${pct}%`;
      entry.pctEl.textContent = `${pct}%`;

      const meta = MODE_META[snap.mode];
      entry.stateEl.style.color = meta.color;
      entry.stateEl.innerHTML = `${iconMode(snap.mode, meta.color)}<span>${meta.label}</span>`;

      if (snap.confidence >= CONFIDENCE_ACT_THRESHOLD || snap.mode === 'ambush' || snap.mode === 'recalibrate') {
        entry.lineEl.textContent = snap.predictionLine;
        entry.lineEl.style.color = 'var(--umber-ink)';
      } else {
        entry.lineEl.textContent = `Studying ${snap.specialty.toLowerCase()}…`;
        entry.lineEl.style.color = 'var(--umber-soft)';
      }

      entry.card.classList.toggle('is-recalibrating', snap.mode === 'recalibrate');
      entry.card.classList.toggle('is-ambushing', snap.mode === 'ambush');
    }
  };

  return { element: stack, update };
}
