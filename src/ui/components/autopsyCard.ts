import { GHOST_CONFIG } from '../../data/tuning';
import type { AutopsyStatement } from '../../game/core/types';
import { formatTimeMMSS } from '../../report/phrases';
import { iconGhostShape } from './icons';

export function createAutopsyCard(statement: AutopsyStatement): HTMLElement {
  const card = document.createElement('article');
  card.className = 'autopsy-card mat-glassmorphism';

  const knewTxt =
    statement.knewByT !== undefined ? `Knew by ${formatTimeMMSS(statement.knewByT)}` : 'Observed';
  const cfg = statement.ghostId ? GHOST_CONFIG[statement.ghostId] : null;
  const ghostTag = cfg
    ? `<span style="display:inline-flex;align-items:center;gap:6px;">${iconGhostShape(cfg.id, cfg.colorHex, 16)}<span>${cfg.name}</span></span>`
    : '';

  const quoteStyle = statement.isQuote
    ? 'border-bottom:2px solid rgba(194,138,46,0.6);padding-bottom:10px;'
    : '';

  card.innerHTML = `
    <p style="margin:0;font-family:var(--font-display);font-size:1.18rem;line-height:1.35;${quoteStyle}">“${statement.text}”</p>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:0.8125rem;color:var(--umber-soft);">
      <span class="type-stat" style="font-size:0.85rem;color:var(--umber-ink);">${statement.stat}</span>
      <span style="display:inline-flex;align-items:center;gap:8px;">${ghostTag}<span>${knewTxt}</span></span>
    </div>
  `;
  return card;
}
