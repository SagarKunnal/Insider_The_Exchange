import type { RunSummary } from '../../game/core/types';
import { createNeuButton } from '../components/buttons';

function renderSparkline(runs: RunSummary[]): HTMLElement {
  const ordered = [...runs].reverse();
  const w = 520;
  const h = 64;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.cssText = 'width:100%;height:auto;display:block;';

  if (ordered.length >= 2) {
    const pts = ordered.map((r, i) => {
      const x = (i / (ordered.length - 1)) * (w - 20) + 10;
      const y = h - 8 - (Math.max(0, Math.min(100, r.predictabilityIndex)) / 100) * (h - 16);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pts.join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#2F8F83');
    path.setAttribute('stroke-width', '2.5');
    svg.appendChild(path);
  }
  const wrap = document.createElement('div');
  wrap.className = 'mat-neu-inset';
  wrap.style.cssText = 'padding:12px 14px;border-radius:14px;';
  wrap.innerHTML = '<div class="type-caption" style="margin-bottom:6px;">Predictability Index Trend</div>';
  wrap.appendChild(svg);
  return wrap;
}

export function renderHistoryScreen(opts: {
  runs: RunSummary[];
  onBack: () => void;
}): HTMLElement {
  const root = document.createElement('section');
  root.style.cssText =
    'max-width:780px;width:100%;margin:0 auto;padding:28px 20px;display:flex;flex-direction:column;gap:18px;';

  const panel = document.createElement('div');
  panel.className = 'mat-glassmorphism';
  panel.style.cssText = 'padding:24px;border-radius:20px;display:flex;flex-direction:column;gap:16px;';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
  head.innerHTML = '<div><div class="type-caption">Archive</div><h1 class="type-h1" style="margin:4px 0 0;">Run History</h1></div>';
  head.appendChild(createNeuButton('Back', opts.onBack));
  panel.appendChild(head);

  if (opts.runs.length >= 2) {
    panel.appendChild(renderSparkline(opts.runs));
  }

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

  for (const r of opts.runs) {
    const row = document.createElement('div');
    row.className = 'mat-neu-extrude';
    row.style.cssText =
      'padding:12px 16px;border-radius:14px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;';
    const dateTxt = new Date(r.date).toLocaleDateString();
    row.innerHTML = `
      <div>
        <strong>Round ${r.rounds}</strong>
        <span style="font-size:0.8rem;color:var(--umber-soft);margin-left:8px;">${dateTxt}</span>
      </div>
      <div style="display:flex;gap:14px;font-size:0.875rem;">
        <span class="type-stat">Score ${r.score}</span>
        <span class="type-stat">Pred ${r.predictabilityIndex}%</span>
        <span class="type-stat">Entropy ${r.meanEntropy}</span>
        <span class="type-stat">Breaks ${r.patternBreaks}</span>
      </div>
    `;
    list.appendChild(row);
  }

  panel.appendChild(list);
  root.appendChild(panel);
  return root;
}
