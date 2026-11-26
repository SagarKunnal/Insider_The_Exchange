import phrasesJson from '../../data/phrases.json';
import { GHOST_CONFIG } from '../../data/tuning';
import type { AutopsyReport, ReplayClip, RunSummary } from '../../game/core/types';
import { formatTimeMMSS } from '../../report/phrases';
import { createAutopsyCard } from '../components/autopsyCard';
import { createBrassButton, createNeuButton, createNeuChip } from '../components/buttons';
import { createEntropyChart } from '../components/entropyChart';
import { iconArchive, iconGhostShape, iconReplay } from '../components/icons';
import { createSessionChip } from '../components/sessionChip';
import { bindLiquidSheen, springAnimate } from '../motion';

export function renderAutopsyScreen(opts: {
  report: AutopsyReport;
  previousRun?: RunSummary;
  debugJson: string;
  reducedMotion: boolean;
  onHauntAgain: () => void;
  onTitle: () => void;
  onHistory?: () => void;
  onWatchClip: (clip: ReplayClip) => void;
}): { element: HTMLElement; cleanup: () => void } {
  const { report, previousRun, reducedMotion } = opts;
  const root = document.createElement('section');
  root.className = 'autopsy-screen';

  // Top Utility Page Header
  const pageTop = document.createElement('div');
  pageTop.className = 'page-shell-header mat-liquid-glass';
  const unbindTopSheen = bindLiquidSheen(pageTop);
  pageTop.innerHTML = `
    <div>
      <div class="type-caption" style="color:var(--moss-deep);">Post-Run Dossier</div>
      <div style="font-size:0.78rem;color:var(--umber-soft);">Run ${report.runId}</div>
    </div>
  `;
  const pageTopActions = document.createElement('div');
  pageTopActions.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
  pageTopActions.appendChild(createSessionChip());
  if (opts.onHistory) {
    pageTopActions.appendChild(createNeuButton('Run History', opts.onHistory, { iconSvg: iconArchive() }));
  }
  pageTopActions.appendChild(createNeuButton('Title', opts.onTitle));
  pageTop.appendChild(pageTopActions);
  root.appendChild(pageTop);

  // Liquid Glass Header with Skeuomorphic Brass Dossier Stamp + developing photograph reveal
  const header = document.createElement('header');
  header.className = 'autopsy-header mat-liquid-glass';
  const unbindSheen = bindLiquidSheen(header);

  const hLeft = document.createElement('div');
  hLeft.innerHTML = `
    <div class="type-caption">Dossier · ${formatTimeMMSS(report.durationS)}</div>
    <h1 class="type-h1" style="margin:6px 0 0;">Habit Autopsy</h1>
    <p style="margin:6px 0 0;font-size:0.9rem;color:var(--umber-soft);">What the three mirrors extracted from your movement</p>
  `;

  const stamp = document.createElement('div');
  stamp.className = 'brass-dossier-stamp';
  stamp.innerHTML = `
    <div><div class="type-caption" style="color:var(--umber-ink);font-size:11px;">Round</div><strong class="type-stat" style="font-size:1.35rem;">${report.round}</strong></div>
    <div style="width:1px;height:28px;background:rgba(42,38,34,0.25);"></div>
    <div><div class="type-caption" style="color:var(--umber-ink);font-size:11px;">Score</div><strong class="type-stat" style="font-size:1.35rem;">${report.score}</strong></div>
  `;
  header.append(hLeft, stamp);
  root.appendChild(header);

  if (!reducedMotion) {
    header.classList.add('developing-photo');
    requestAnimationFrame(() => header.classList.add('is-developed'));
    springAnimate(header, { y: [14, 0] }, 'soft', false);
  }

  // Comparison delta chips (ST-02)
  if (previousRun) {
    const compRow = document.createElement('div');
    compRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;';
    const predDelta = report.predictabilityIndex - previousRun.predictabilityIndex;
    const entDelta = report.meanEntropy - previousRun.meanEntropy;
    compRow.appendChild(
      createNeuChip(
        predDelta <= 0
          ? `${Math.abs(predDelta)}% less predictable than last run`
          : `${predDelta}% more predictable than last run`,
      ),
    );
    compRow.appendChild(createNeuChip(`Entropy ${entDelta >= 0 ? '+' : ''}${entDelta} vs last run`));
    root.appendChild(compRow);
  }

  // Statements (asymmetric focal layout: featured lead quote + staggered secondary column) or honest empty state
  const parallaxTargets: Array<{ el: HTMLElement; factor: number }> = [{ el: header, factor: 0.18 }];

  if (!report.sufficientData || report.statements.length === 0) {
    const emptyCard = document.createElement('article');
    emptyCard.className = 'mat-glassmorphism';
    emptyCard.style.cssText = 'padding:26px;border-radius:18px;';
    emptyCard.innerHTML = `
      <h2 class="type-h2" style="margin:0 0 8px;">${phrasesJson.autopsy.insufficient}</h2>
      <p style="margin:0;color:var(--umber-soft);">Play past 45 seconds and cross more junctions so the ghosts have enough evidence to model your reflexes.</p>
    `;
    root.appendChild(emptyCard);
  } else {
    const stmtGrid = document.createElement('div');
    stmtGrid.className = 'autopsy-statements-layout';
    report.statements.forEach((st, idx) => {
      const card = createAutopsyCard(st);
      if (idx === 0) card.classList.add('autopsy-card-lead');
      stmtGrid.appendChild(card);
      parallaxTargets.push({ el: card, factor: idx === 0 ? 0.04 : idx % 2 === 1 ? 0.08 : 0.02 });
      if (!reducedMotion) {
        setTimeout(() => {
          springAnimate(card, { y: [12, 0] }, 'soft', false);
        }, idx * 90);
      }
    });
    root.appendChild(stmtGrid);
  }

  // Per-ghost row with distinct hem shape icons & individual progress bars
  const ghostRow = document.createElement('div');
  ghostRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;';
  for (const id of ['pinky', 'inky', 'blinky'] as const) {
    const cfg = GHOST_CONFIG[id];
    const gp = report.ghostProgress?.[id];
    const knewT = gp?.knewByT ?? report.knewBy[id];
    const hitRate = gp?.hitRate ?? report.ghostHitRates[id];
    const progressPct = gp?.progressPct ?? (knewT !== undefined ? Math.max(60, hitRate) : hitRate);
    const hitCountText = gp && gp.total > 0 ? ` (${gp.hits}/${gp.total})` : '';
    const statusText =
      knewT !== undefined
        ? `Knew you by ${formatTimeMMSS(knewT)}`
        : progressPct > 0
          ? `Progress ${progressPct}%`
          : 'Still learning';
    const gCard = document.createElement('article');
    gCard.className = 'mat-glassmorphism';
    gCard.style.cssText = `padding:16px 16px;border-radius:14px;border-top:3px solid ${cfg.colorHex};display:flex;flex-direction:column;gap:8px;`;
    gCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        ${iconGhostShape(id, cfg.colorHex, 20)}
        <strong>${cfg.name}</strong>
        <span style="font-size:0.8rem;color:var(--umber-soft);">· ${cfg.specialty}</span>
      </div>
      <div class="mat-neu-inset" style="height:7px;border-radius:999px;overflow:hidden;border-width:1px;">
        <div style="height:100%;width:${progressPct}%;background:${cfg.colorHex};border-radius:999px;transition:width 240ms var(--ease-out);"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
        <span>${statusText}</span>
        <strong class="type-stat">${hitRate}% hits${hitCountText}</strong>
      </div>
    `;
    ghostRow.appendChild(gCard);
  }
  root.appendChild(ghostRow);

  // Neumorphic Stats Row
  const statsRow = document.createElement('div');
  statsRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;';
  const statItems = [
    { label: 'Predictability Index', val: `${report.predictabilityIndex}%` },
    { label: 'Pattern Breaks', val: String(report.patternBreaks) },
    { label: 'Peak Multiplier', val: `${report.peakMultiplier.toFixed(1)}×` },
    { label: 'Rounds', val: String(report.round) },
  ];
  for (const item of statItems) {
    const box = document.createElement('div');
    box.className = 'mat-neu-extrude';
    box.style.cssText = 'padding:14px 16px;border-radius:14px;display:flex;flex-direction:column;gap:6px;';
    box.innerHTML = `<span class="type-caption">${item.label}</span><strong class="type-stat" style="font-size:1.75rem;">${item.val}</strong>`;
    statsRow.appendChild(box);
  }
  root.appendChild(statsRow);

  // Entropy Over Time chart (slightly lagged parallax)
  const chart = createEntropyChart(report.entropyTimeline, reducedMotion);
  parallaxTargets.push({ el: chart, factor: -0.04 });
  root.appendChild(chart);

  // Captured Prediction Moments (S-02 / ST-01)
  if (report.clips.length > 0) {
    const clipsPanel = document.createElement('div');
    clipsPanel.className = 'mat-glassmorphism';
    clipsPanel.style.cssText = 'padding:16px 18px;border-radius:16px;display:flex;flex-direction:column;gap:10px;';
    const cHead = document.createElement('div');
    cHead.className = 'type-caption';
    cHead.textContent = 'Predicted Moments';
    clipsPanel.appendChild(cHead);

    for (const clip of report.clips) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';
      const cap = document.createElement('span');
      cap.style.fontSize = '0.9rem';
      cap.textContent = clip.caption;
      const btn = createNeuButton('Watch the moment', () => opts.onWatchClip(clip), {
        iconSvg: iconReplay(),
      });
      row.append(cap, btn);
      clipsPanel.appendChild(row);
    }
    root.appendChild(clipsPanel);
  }

  // Footer Actions
  const footer = document.createElement('footer');
  footer.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;padding-top:8px;';
  const leftBtns = document.createElement('div');
  leftBtns.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;';
  leftBtns.appendChild(createBrassButton('Haunt Again', opts.onHauntAgain));
  leftBtns.appendChild(createNeuButton('Title', opts.onTitle));
  if (opts.onHistory) {
    leftBtns.appendChild(createNeuButton('Run History', opts.onHistory));
  }

  const exportBtn = createNeuButton('Export Debug JSON', () => {
    const blob = new Blob([opts.debugJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.runId}-debug.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  footer.append(leftBtns, exportBtn);
  root.appendChild(footer);

  // Scroll parallax (Design.md §6: Autopsy scroll)
  const onScroll = () => {
    if (reducedMotion) return;
    const sy = Math.min(260, window.scrollY);
    for (const item of parallaxTargets) {
      item.el.style.transform = `translate3d(0, ${(sy * item.factor).toFixed(1)}px, 0)`;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  return {
    element: root,
    cleanup: () => {
      unbindTopSheen();
      unbindSheen();
      window.removeEventListener('scroll', onScroll);
    },
  };
}
