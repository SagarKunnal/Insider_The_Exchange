import { GHOST_CONFIG } from '../../data/tuning';
import { createBrassButton, createNeuButton } from '../components/buttons';
import { iconGhostShape } from '../components/icons';
import { springAnimate } from '../motion';

export function renderBriefingScreen(opts: {
  onContinue: () => void;
  onSkip: () => void;
  reducedMotion: boolean;
}): { element: HTMLElement; cleanup: () => void } {
  const root = document.createElement('section');
  root.className = 'title-screen';
  root.setAttribute('aria-label', 'How They Learn');

  const panel = document.createElement('div');
  panel.style.cssText = 'max-width:880px;width:100%;display:flex;flex-direction:column;gap:26px;align-items:center;';

  const header = document.createElement('div');
  header.innerHTML = `
    <div class="type-caption">Briefing</div>
    <h1 class="type-h1" style="margin:8px 0 6px;">Three Ghosts, Three Mirrors</h1>
    <p style="margin:0;color:var(--umber-soft);">Every turn you repeat condenses on the glass. Break your habits before they settle.</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'briefing-grid';

  const specs = [
    {
      id: 'pinky' as const,
      desc: 'Maps your favorite turns, intersections, and repeated loops onto solid Verdigris ink trails.',
      swatch:
        '<svg width="46" height="16" aria-hidden="true"><line x1="2" y1="8" x2="44" y2="8" stroke="#2F8F83" stroke-width="4" stroke-linecap="round"/></svg>',
      depth: 8,
      offsetY: 0,
    },
    {
      id: 'inky' as const,
      desc: 'Times your corridor pace and marks hesitation hotspots with pulsing Saffron rings.',
      swatch:
        '<svg width="46" height="22" aria-hidden="true"><circle cx="23" cy="11" r="8" fill="none" stroke="#B57A12" stroke-width="2"/><circle cx="23" cy="11" r="4" fill="none" stroke="#E3A73B" stroke-width="1.5"/></svg>',
      depth: 12,
      offsetY: 12,
    },
    {
      id: 'blinky' as const,
      desc: 'Learns how you flinch under threat and ambushes your favorite escape corridors.',
      swatch:
        '<svg width="46" height="16" aria-hidden="true"><polyline points="8,3 15,8 8,13" fill="none" stroke="#D2553F" stroke-width="2.5" stroke-linecap="round"/><polyline points="20,3 27,8 20,13" fill="none" stroke="#D2553F" stroke-width="2.5" stroke-linecap="round"/><polyline points="32,3 39,8 32,13" fill="none" stroke="#D2553F" stroke-width="2.5" stroke-linecap="round"/></svg>',
      depth: 6,
      offsetY: 4,
    },
  ];

  const cardEls: Array<{ el: HTMLElement; depth: number; baseOffsetY: number }> = [];
  specs.forEach((s, idx) => {
    const cfg = GHOST_CONFIG[s.id];
    const card = document.createElement('article');
    card.className = 'mat-glassmorphism';
    card.style.cssText = `padding:22px 18px;border-radius:18px;text-align:left;display:flex;flex-direction:column;gap:10px;transition:transform 200ms var(--ease-out);margin-top:${opts.reducedMotion ? 0 : s.offsetY}px;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="display:inline-flex;align-items:center;gap:8px;">
          ${iconGhostShape(s.id, cfg.colorHex, 24)}
          <strong style="font-family:var(--font-display);font-size:1.25rem;">${cfg.name}</strong>
        </span>
        ${s.swatch}
      </div>
      <div class="type-caption" style="color:${cfg.deepColorHex};">${cfg.epithet} · ${cfg.specialty}</div>
      <p style="margin:0;font-size:0.9375rem;color:var(--umber-ink);">${s.desc}</p>
    `;
    grid.appendChild(card);
    cardEls.push({ el: card, depth: s.depth, baseOffsetY: s.offsetY });
    if (!opts.reducedMotion) {
      setTimeout(() => {
        springAnimate(card, { opacity: [0, 1], y: [20, 0] }, 'soft', false);
      }, idx * 75);
    }
  });

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;justify-content:center;';
  actions.appendChild(createBrassButton('Begin Haunting', opts.onContinue));
  actions.appendChild(createNeuButton('Skip', opts.onSkip));

  panel.append(header, grid, actions);
  root.appendChild(panel);

  const onPointerMove = (ev: PointerEvent) => {
    if (opts.reducedMotion) return;
    const nx = (ev.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    const ny = (ev.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    for (const item of cardEls) {
      item.el.style.transform = `translate3d(${(nx * item.depth).toFixed(1)}px, ${(ny * item.depth * 0.6).toFixed(1)}px, 0)`;
    }
  };
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.code === 'Escape' || ev.code === 'Space' || ev.code === 'Enter') {
      ev.preventDefault();
      opts.onSkip();
    }
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('keydown', onKeyDown);

  return {
    element: root,
    cleanup: () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
