import type { Settings } from '../../game/core/types';
import { isStorageHealthy } from '../../platform/storage';
import { createNeuButton } from './buttons';
import { createDrawer } from './drawer';
import { createNeuSlider, createNeuToggle } from './neuToggle';

export function createSettingsDrawer(opts: {
  initial: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
}): {
  element: HTMLElement;
  cleanup: () => void;
} {
  const current: Settings = {
    ...opts.initial,
    trails: { ...opts.initial.trails },
  };

  const { backdrop, drawer, cleanup } = createDrawer({
    ariaLabel: 'Settings',
    reducedMotion: current.reducedMotion,
    onClose: opts.onClose,
  });

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
  const title = document.createElement('h2');
  title.className = 'type-h2';
  title.style.margin = '0';
  title.textContent = 'Settings';
  const closeBtn = createNeuButton('Done', opts.onClose);
  header.append(title, closeBtn);
  drawer.appendChild(header);

  const emitChange = () => {
    opts.onChange({
      ...current,
      trails: { ...current.trails },
    });
  };

  // Audio section
  const audioSection = document.createElement('div');
  audioSection.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  const audioCap = document.createElement('div');
  audioCap.className = 'type-caption';
  audioCap.textContent = 'Audio';
  audioSection.appendChild(audioCap);

  audioSection.appendChild(
    createNeuToggle({
      label: 'Audio Cues',
      checked: current.sound,
      onChange: (v) => {
        current.sound = v;
        emitChange();
      },
    }).element,
  );

  audioSection.appendChild(
    createNeuSlider({
      label: 'Volume',
      min: 0,
      max: 100,
      value: Math.round(current.volume * 100),
      formatValue: (v) => `${Math.round(v)}%`,
      onChange: (v) => {
        current.volume = v / 100;
        emitChange();
      },
    }).element,
  );

  // Default trail layers
  const trailSection = document.createElement('div');
  trailSection.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
  const trailCap = document.createElement('div');
  trailCap.className = 'type-caption';
  trailCap.textContent = 'Default Memory Trails';
  trailSection.appendChild(trailCap);

  trailSection.appendChild(
    createNeuToggle({
      label: 'Route Ink (Pinky)',
      checked: current.trails.route,
      onChange: (v) => {
        current.trails.route = v;
        emitChange();
      },
    }).element,
  );
  trailSection.appendChild(
    createNeuToggle({
      label: 'Timing Rings (Inky)',
      checked: current.trails.timing,
      onChange: (v) => {
        current.trails.timing = v;
        emitChange();
      },
    }).element,
  );
  trailSection.appendChild(
    createNeuToggle({
      label: 'Panic Chevrons (Blinky)',
      checked: current.trails.panic,
      onChange: (v) => {
        current.trails.panic = v;
        emitChange();
      },
    }).element,
  );

  // Accessibility section
  const a11ySection = document.createElement('div');
  a11ySection.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
  const a11yCap = document.createElement('div');
  a11yCap.className = 'type-caption';
  a11yCap.textContent = 'Comfort & Accessibility';
  a11ySection.appendChild(a11yCap);

  a11ySection.appendChild(
    createNeuToggle({
      label: 'Reduced Motion',
      checked: current.reducedMotion,
      onChange: (v) => {
        current.reducedMotion = v;
        emitChange();
      },
    }).element,
  );

  a11ySection.appendChild(
    createNeuToggle({
      label: 'Colorblind Patterns',
      checked: current.colorblind,
      onChange: (v) => {
        current.colorblind = v;
        emitChange();
      },
    }).element,
  );

  drawer.append(audioSection, trailSection, a11ySection);

  if (!isStorageHealthy()) {
    const note = document.createElement('p');
    note.style.cssText =
      'margin:0;padding:10px 12px;border-radius:10px;background:rgba(181,122,18,0.14);color:var(--saffron-deep);font-size:0.8125rem;';
    note.textContent = 'Browser storage is unavailable; settings will last for this session only.';
    drawer.appendChild(note);
  }

  return {
    element: backdrop,
    cleanup,
  };
}
