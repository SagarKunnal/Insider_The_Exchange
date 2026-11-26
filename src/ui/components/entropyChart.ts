import type { EntropySample } from '../../game/core/types';

export function createEntropyChart(samples: EntropySample[], reducedMotion: boolean): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'entropy-chart-panel mat-neu-inset';
  panel.style.cssText = 'padding:16px 18px;border-radius:16px;display:flex;flex-direction:column;gap:8px;';

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;';
  titleRow.innerHTML =
    '<span class="type-caption">Entropy Over Time</span><span style="font-size:0.75rem;color:var(--umber-soft);">Verdigris = elusive · Cinnabar zone = predictable · Marks = Recalibrate / Break</span>';
  panel.appendChild(titleRow);

  const w = 680;
  const h = 156;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.cssText = 'width:100%;height:auto;display:block;overflow:visible;';

  const zoneY = h - (35 / 100) * (h - 20) - 10;
  const zone = document.createElementNS(ns, 'rect');
  zone.setAttribute('x', '0');
  zone.setAttribute('y', String(zoneY));
  zone.setAttribute('width', String(w));
  zone.setAttribute('height', String(h - zoneY));
  zone.setAttribute('fill', 'rgba(210, 85, 63, 0.14)');
  svg.appendChild(zone);

  if (samples.length >= 2) {
    const maxT = Math.max(1, samples[samples.length - 1].t);
    const pts = samples.map((s) => {
      const x = (s.t / maxT) * (w - 16) + 8;
      const y = h - 10 - (Math.max(0, Math.min(100, s.entropy)) / 100) * (h - 20);
      return { x, y, sample: s };
    });

    const lineD = pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const areaD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${h - 10} L ${pts[0].x.toFixed(1)} ${h - 10} Z`;

    const area = document.createElementNS(ns, 'path');
    area.setAttribute('d', areaD);
    area.setAttribute('fill', 'rgba(47, 143, 131, 0.18)');
    svg.appendChild(area);

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', lineD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#2F8F83');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');
    if (!reducedMotion) {
      path.setAttribute('stroke-dasharray', '1400');
      path.setAttribute('stroke-dashoffset', '1400');
      path.style.transition = 'stroke-dashoffset 1200ms cubic-bezier(0.22, 1, 0.36, 1)';
      requestAnimationFrame(() => {
        path.setAttribute('stroke-dashoffset', '0');
      });
    }
    svg.appendChild(path);

    for (const p of pts) {
      if (!p.sample.eventMarker) continue;
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', p.x.toFixed(1));
      dot.setAttribute('cy', p.y.toFixed(1));
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', p.sample.eventMarker === 'pattern-break' ? '#C28A2E' : '#E3A73B');
      dot.setAttribute('stroke', '#FBF7EE');
      dot.setAttribute('stroke-width', '1.6');
      svg.appendChild(dot);
    }
  } else {
    const emptyText = document.createElementNS(ns, 'text');
    emptyText.setAttribute('x', String(w / 2));
    emptyText.setAttribute('y', String(h / 2));
    emptyText.setAttribute('text-anchor', 'middle');
    emptyText.setAttribute('fill', '#5B544B');
    emptyText.setAttribute('font-size', '13');
    emptyText.textContent = 'Run too brief for an entropy curve.';
    svg.appendChild(emptyText);
  }

  panel.appendChild(svg);
  return panel;
}
