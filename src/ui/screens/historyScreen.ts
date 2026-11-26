import { GHOST_CONFIG } from '../../data/tuning';
import type { RunSummary } from '../../game/core/types';
import { formatTimeMMSS } from '../../report/phrases';
import { createNeuButton, createNeuChip } from '../components/buttons';
import { iconGhostShape } from '../components/icons';
import { createSessionChip } from '../components/sessionChip';

function renderSparkline(runs: RunSummary[]): HTMLElement {
  const ordered = [...runs].reverse();
  const w = 520;
  const h = 76;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.cssText = 'width:100%;height:auto;display:block;';

  for (const pct of [25, 50, 75]) {
    const gy = h - 10 - (pct / 100) * (h - 20);
    const guide = document.createElementNS(ns, 'line');
    guide.setAttribute('x1', '12');
    guide.setAttribute('x2', String(w - 12));
    guide.setAttribute('y1', gy.toFixed(1));
    guide.setAttribute('y2', gy.toFixed(1));
    guide.setAttribute('stroke', 'rgba(74,90,82,0.16)');
    guide.setAttribute('stroke-dasharray', '3 3');
    svg.appendChild(guide);
  }

  if (ordered.length >= 2) {
    const coords = ordered.map((r, i) => {
      const x = (i / (ordered.length - 1)) * (w - 28) + 14;
      const y = h - 10 - (Math.max(0, Math.min(100, r.predictabilityIndex)) / 100) * (h - 20);
      return { x, y };
    });
    const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#2F8F83');
    path.setAttribute('stroke-width', '2.5');
    svg.appendChild(path);

    for (const c of coords) {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', c.x.toFixed(1));
      dot.setAttribute('cy', c.y.toFixed(1));
      dot.setAttribute('r', '3.5');
      dot.setAttribute('fill', '#FBF7EE');
      dot.setAttribute('stroke', '#1F6359');
      dot.setAttribute('stroke-width', '2');
      svg.appendChild(dot);
    }
  }
  const wrap = document.createElement('div');
  wrap.className = 'mat-neu-inset';
  wrap.style.cssText = 'padding:14px 16px;border-radius:14px;';
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span class="type-caption">Predictability Index Trend</span>
      <span style="font-size:0.75rem;color:var(--umber-soft);">Lower = more elusive</span>
    </div>
  `;
  wrap.appendChild(svg);
  return wrap;
}

export function renderHistoryScreen(opts: {
  runs: RunSummary[];
  onBack: () => void;
}): HTMLElement {
  const root = document.createElement('section');
  root.className = 'history-screen';

  const topHeader = document.createElement('header');
  topHeader.className = 'page-shell-header mat-liquid-glass';
  topHeader.innerHTML = `
    <div>
      <div class="type-caption" style="color:var(--moss-deep);">Archive · Habit Log</div>
      <h1 class="type-h1" style="margin:4px 0 0;font-size:clamp(1.6rem,3vw,2.2rem);">Run History</h1>
    </div>
  `;
  const headActions = document.createElement('div');
  headActions.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
  headActions.append(
    createSessionChip(),
    createNeuChip(`${opts.runs.length} ${opts.runs.length === 1 ? 'Run' : 'Runs'}`),
    createNeuButton('Back', opts.onBack),
  );
  topHeader.appendChild(headActions);

  const panel = document.createElement('div');
  panel.className = 'mat-glassmorphism';
  panel.style.cssText = 'padding:22px 24px;border-radius:20px;display:flex;flex-direction:column;gap:16px;';

  if (opts.runs.length >= 2) {
    panel.appendChild(renderSparkline(opts.runs));
  }

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  if (opts.runs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'mat-neu-inset';
    empty.style.cssText = 'padding:22px;border-radius:14px;text-align:center;color:var(--umber-soft);';
    empty.textContent = 'No completed runs archived yet.';
    list.appendChild(empty);
  }

  for (const r of opts.runs) {
    const row = document.createElement('div');
    row.className = 'mat-neu-extrude';
    row.style.cssText =
      'padding:12px 16px;border-radius:14px;display:flex;flex-direction:column;gap:10px;';
    const dateTxt = new Date(r.date).toLocaleDateString();

    const topLine = document.createElement('div');
    topLine.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;';
    topLine.innerHTML = `
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
    row.appendChild(topLine);

    if (r.ghostProgress) {
      const ghostStrip = document.createElement('div');
      ghostStrip.style.cssText =
        'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;padding-top:4px;border-top:1px solid rgba(47,61,55,0.1);';
      for (const id of ['pinky', 'inky', 'blinky'] as const) {
        const cfg = GHOST_CONFIG[id];
        const gp = r.ghostProgress[id];
        const cell = document.createElement('div');
        cell.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:0.78rem;';
        const status = gp.knewByT !== undefined ? formatTimeMMSS(gp.knewByT) : `${gp.progressPct}%`;
        cell.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <span style="display:inline-flex;align-items:center;gap:5px;color:var(--umber-ink);font-weight:600;">
              ${iconGhostShape(id, cfg.colorHex, 14)} ${cfg.name}
            </span>
            <span class="type-stat" style="color:var(--umber-soft);">${gp.hitRate}% hits · ${status}</span>
          </div>
          <div class="mat-neu-inset" style="height:5px;border-radius:999px;overflow:hidden;border-width:1px;">
            <div style="height:100%;width:${gp.progressPct}%;background:${cfg.colorHex};border-radius:999px;"></div>
          </div>
        `;
        ghostStrip.appendChild(cell);
      }
      row.appendChild(ghostStrip);
    }

    list.appendChild(row);
  }

  panel.appendChild(list);
  root.append(topHeader, panel);
  return root;
}
