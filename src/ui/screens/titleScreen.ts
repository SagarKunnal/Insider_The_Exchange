import { GHOST_CONFIG } from '../../data/tuning';
import { createBrassButton, createNeuButton, createNeuChip } from '../components/buttons';
import { iconArchive, iconBook, iconGear, iconGhostShape } from '../components/icons';
import { createSessionChip } from '../components/sessionChip';
import { bindLiquidSheen, springAnimate } from '../motion';

export interface TitleScreenActions {
  onBeginHaunting: () => void;
  onHowTheyLearn: () => void;
  onSettings: () => void;
  onRunHistory?: () => void;
  hasRunHistory?: boolean;
  reducedMotion?: boolean;
}

export function renderTitleScreen(actions: TitleScreenActions): {
  element: HTMLElement;
  cleanup: () => void;
} {
  const root = document.createElement('section');
  root.className = 'title-screen';
  root.setAttribute('aria-label', 'The Threshold');

  // Glasshouse Header Bar
  const topBar = document.createElement('header');
  topBar.className = 'title-top-bar mat-liquid-glass';
  const unbindTopSheen = bindLiquidSheen(topBar);

  const brandMark = document.createElement('div');
  brandMark.className = 'page-brand-mark';
  brandMark.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="#8C5F18" stroke-width="1.5"/>
      <path d="M12 4.5 L14.5 11.5 L12 19.5 L9.5 11.5 Z" fill="#C28A2E" opacity="0.85"/>
      <circle cx="12" cy="12" r="2" fill="#FBF7EE"/>
    </svg>
    <div style="text-align:left;">
      <div class="type-caption" style="font-size:11px;color:var(--moss-deep);letter-spacing:0.1em;">The Glasshouse</div>
      <div style="font-size:0.75rem;color:var(--umber-soft);">Adaptive Maze · Track II</div>
    </div>
  `;

  topBar.append(brandMark, createSessionChip());

  // Hero Centerpiece Card
  const card = document.createElement('div');
  card.className = 'title-card mat-liquid-glass';

  const specimenRow = document.createElement('div');
  specimenRow.className = 'title-specimen-row';
  specimenRow.innerHTML = (['pinky', 'inky', 'blinky'] as const)
    .map((id) => {
      const cfg = GHOST_CONFIG[id];
      return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:0.78rem;font-weight:600;color:var(--umber-ink);">${iconGhostShape(id, cfg.colorHex, 20)}<span>${cfg.name}</span></span>`;
    })
    .join('');

  const eyebrow = document.createElement('div');
  eyebrow.className = 'type-caption';
  eyebrow.textContent = 'Observational Pursuit';

  const heading = document.createElement('h1');
  heading.className = 'type-display-xl title-glass-letters';
  heading.style.margin = '10px 0 0';
  heading.textContent = 'Haunted by Yourself';

  const subtitle = document.createElement('p');
  subtitle.className = 'title-subtitle';
  subtitle.textContent = 'The ghosts are built from you.';

  const traitStrip = document.createElement('div');
  traitStrip.className = 'title-trait-strip';
  traitStrip.append(
    createNeuChip('Routes · Verdigris', { accentColor: 'var(--verdigris-deep)' }),
    createNeuChip('Cadence · Saffron', { accentColor: 'var(--saffron-deep)' }),
    createNeuChip('Reflexes · Cinnabar', { accentColor: 'var(--cinnabar-deep)' }),
  );

  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'title-actions';

  const beginBtn = createBrassButton('Begin Haunting', actions.onBeginHaunting);
  actionsWrap.appendChild(beginBtn);

  const secondary = document.createElement('div');
  secondary.className = 'title-secondary-actions';
  secondary.appendChild(createNeuButton('How They Learn', actions.onHowTheyLearn, { iconSvg: iconBook() }));
  secondary.appendChild(createNeuButton('Settings', actions.onSettings, { iconSvg: iconGear() }));
  if (actions.hasRunHistory && actions.onRunHistory) {
    secondary.appendChild(createNeuButton('Run History', actions.onRunHistory, { iconSvg: iconArchive() }));
  }
  actionsWrap.appendChild(secondary);

  card.append(specimenRow, eyebrow, heading, subtitle, traitStrip, actionsWrap);

  const footerHint = document.createElement('footer');
  footerHint.className = 'title-footer-hint';
  footerHint.innerHTML = `
    <span>Steer: <strong style="color:var(--umber-ink);">WASD / Arrows / Swipe</strong></span>
    <span>Pause: <strong style="color:var(--umber-ink);">Esc / Space</strong></span>
    <span>Goal: <strong style="color:var(--umber-ink);">Stay unpredictable</strong></span>
  `;

  root.append(topBar, card, footerHint);

  const unbindSheen = bindLiquidSheen(card);
  springAnimate(card, { opacity: [0, 1], y: [24, 0] }, 'soft', actions.reducedMotion);

  return {
    element: root,
    cleanup: () => {
      unbindTopSheen();
      unbindSheen();
    },
  };
}
