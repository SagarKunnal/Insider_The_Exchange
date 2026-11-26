import { GHOST_CONFIG } from '../../data/tuning';
import { createBrassButton, createNeuButton } from '../components/buttons';
import { iconGhostShape } from '../components/icons';
import { createSessionChip } from '../components/sessionChip';
import { bindLiquidSheen, springAnimate } from '../motion';

export function renderBriefingScreen(opts: {
  onContinue: () => void;
  onSkip: () => void;
  reducedMotion: boolean;
}): { element: HTMLElement; cleanup: () => void } {
  const root = document.createElement('section');
  root.className = 'briefing-screen';
  root.setAttribute('aria-label', 'How They Learn');

  const topHeader = document.createElement('header');
  topHeader.className = 'page-shell-header mat-liquid-glass';
  const unbindHeaderSheen = bindLiquidSheen(topHeader);
  topHeader.innerHTML = `
    <div>
      <div class="type-caption" style="color:var(--moss-deep);">Briefing · Observation Protocol</div>
      <div style="font-size:0.8rem;color:var(--umber-soft);">Every ghost studies a different signature</div>
    </div>
  `;
  const headerRight = document.createElement('div');
  headerRight.style.cssText = 'display:flex;align-items:center;gap:10px;';
  headerRight.append(createSessionChip(), createNeuButton('Skip', opts.onSkip));
  topHeader.appendChild(headerRight);

  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:24px;align-items:center;text-align:center;';

  const header = document.createElement('div');
  header.innerHTML = `
    <h1 class="type-h1" style="margin:4px 0 8px;">Three Ghosts, Three Mirrors</h1>
    <p style="margin:0;color:var(--umber-soft);max-width:560px;">Every turn you repeat condenses on the glass. Break your habits before they settle.</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'briefing-grid';

  const specs = [
    {
      id: 'pinky' as const,
      desc: 'Maps your favorite turns, intersections, and repeated loops onto solid Verdigris ink trails.',
      breakHint: 'Take a fresh turn before your loop completes to trigger a Pattern Break.',
      swatch:
        '<svg width="54" height="16" aria-hidden="true"><line x1="3" y1="8" x2="51" y2="8" stroke="#2F8F83" stroke-width="4" stroke-linecap="round"/></svg>',
      depth: 8,
      offsetY: 0,
    },
    {
      id: 'inky' as const,
      desc: 'Times your corridor pace and marks hesitation hotspots with pulsing Saffron rings.',
      breakHint: 'Keep moving through crossings instead of stalling on the threshold.',
      swatch:
        '<svg width="54" height="22" aria-hidden="true"><circle cx="27" cy="11" r="8" fill="none" stroke="#B57A12" stroke-width="2"/><circle cx="27" cy="11" r="4" fill="none" stroke="#E3A73B" stroke-width="1.5"/></svg>',
      depth: 12,
      offsetY: 12,
    },
    {
      id: 'blinky' as const,
      desc: 'Learns how you flinch under threat and ambushes your favorite escape corridors.',
      breakHint: 'Vary your panic turns when chased so no corridor becomes predictable.',
      swatch:
        '<svg width="54" height="16" aria-hidden="true"><polyline points="10,3 17,8 10,13" fill="none" stroke="#D2553F" stroke-width="2.5" stroke-linecap="round"/><polyline points="22,3 29,8 22,13" fill="none" stroke="#D2553F" stroke-width="2.5" stroke-linecap="round"/><polyline points="34,3 41,8 34,13" fill="none" stroke="#D2553F" stroke-width="2.5" stroke-linecap="round"/></svg>',
      depth: 6,
      offsetY: 4,
    },
  ];

  const cardEls: Array<{ el: HTMLElement; depth: number; baseOffsetY: number }> = [];
  specs.forEach((s, idx) => {
    const cfg = GHOST_CONFIG[s.id];
    const card = document.createElement('article');
    card.className = 'briefing-card mat-glassmorphism';
    card.style.cssText = `border-top:3px solid ${cfg.colorHex};margin-top:${opts.reducedMotion ? 0 : s.offsetY}px;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span style="display:inline-flex;align-items:center;gap:8px;">
          ${iconGhostShape(s.id, cfg.colorHex, 24)}
          <strong style="font-family:var(--font-display);font-size:1.25rem;color:var(--moss-deep);">${cfg.name}</strong>
        </span>
        <span class="briefing-swatch-frame mat-neu-inset">${s.swatch}</span>
      </div>
      <div class="type-caption" style="color:${cfg.deepColorHex};">${cfg.epithet} · ${cfg.specialty}</div>
      <p style="margin:0;font-size:0.9375rem;color:var(--umber-ink);line-height:1.5;">${s.desc}</p>
      <div style="margin-top:auto;padding-top:10px;border-top:1px solid rgba(74,90,82,0.16);font-size:0.8125rem;color:var(--umber-soft);">
        ${s.breakHint}
      </div>
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

  panel.append(header, grid, actions);
  root.append(topHeader, panel);

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
      unbindHeaderSheen();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
