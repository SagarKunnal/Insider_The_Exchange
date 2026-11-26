import { createBrassButton, createNeuButton } from '../components/buttons';
import { iconArchive, iconBook, iconGear } from '../components/icons';
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

  const topBar = document.createElement('div');
  topBar.className = 'title-top-bar';
  topBar.appendChild(createSessionChip());

  const card = document.createElement('div');
  card.className = 'title-card mat-liquid-glass';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'type-caption';
  eyebrow.textContent = 'The Glasshouse';

  const heading = document.createElement('h1');
  heading.className = 'type-display-xl title-glass-letters';
  heading.style.margin = '12px 0 0';
  heading.textContent = 'Haunted by Yourself';

  const subtitle = document.createElement('p');
  subtitle.className = 'title-subtitle';
  subtitle.textContent = 'The ghosts are built from you.';

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

  card.append(eyebrow, heading, subtitle, actionsWrap);
  root.append(topBar, card);

  const unbindSheen = bindLiquidSheen(card);
  springAnimate(card, { opacity: [0, 1], y: [24, 0] }, 'soft', actions.reducedMotion);

  return {
    element: root,
    cleanup: () => {
      unbindSheen();
    },
  };
}
