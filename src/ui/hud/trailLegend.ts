import type { TrailVisibility } from '../../game/render/trailLayers';
import { createNeuToggle } from '../components/neuToggle';

export { createNeuToggle };

export function createTrailLegend(
  initial: TrailVisibility,
  onChange: (next: TrailVisibility) => void,
): { element: HTMLElement; update: (next: TrailVisibility) => void } {
  let state: TrailVisibility = { ...initial };
  const panel = document.createElement('div');
  panel.className = 'mat-glassmorphism';
  panel.style.cssText =
    'padding:12px 14px;border-radius:14px;display:flex;flex-direction:column;gap:8px;';

  const heading = document.createElement('div');
  heading.className = 'type-caption';
  heading.textContent = 'Memory Trails';
  panel.appendChild(heading);

  const routeToggle = createNeuToggle({
    label: 'Routes (Pinky)',
    checked: state.route,
    swatchHtml:
      '<svg width="20" height="10" aria-hidden="true"><line x1="1" y1="5" x2="19" y2="5" stroke="#2F8F83" stroke-width="3" stroke-linecap="round"/></svg>',
    onChange: (v) => {
      state = { ...state, route: v };
      onChange(state);
    },
  });

  const timingToggle = createNeuToggle({
    label: 'Hesitation (Inky)',
    checked: state.timing,
    swatchHtml:
      '<svg width="20" height="12" aria-hidden="true"><circle cx="10" cy="6" r="4.5" fill="none" stroke="#B57A12" stroke-width="2"/></svg>',
    onChange: (v) => {
      state = { ...state, timing: v };
      onChange(state);
    },
  });

  const panicToggle = createNeuToggle({
    label: 'Panic (Blinky)',
    checked: state.panic,
    swatchHtml:
      '<svg width="20" height="12" aria-hidden="true"><polyline points="4,2 9,6 4,10" fill="none" stroke="#D2553F" stroke-width="2" stroke-linecap="round"/><polyline points="11,2 16,6 11,10" fill="none" stroke="#D2553F" stroke-width="2" stroke-linecap="round"/></svg>',
    onChange: (v) => {
      state = { ...state, panic: v };
      onChange(state);
    },
  });

  panel.append(routeToggle.element, timingToggle.element, panicToggle.element);

  return {
    element: panel,
    update: (next: TrailVisibility) => {
      state = { ...next };
      routeToggle.setChecked(next.route);
      timingToggle.setChecked(next.timing);
      panicToggle.setChecked(next.panic);
    },
  };
}
