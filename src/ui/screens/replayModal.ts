import type { MazeDef, ReplayClip } from '../../game/core/types';
import { ClipPlayer, type ReplaySpeed } from '../../report/clipPlayer';
import { createNeuButton, createNeuChip } from '../components/buttons';
import { iconPause, iconPlay } from '../components/icons';
import { createModal } from '../components/modal';
import { createNeuSlider } from '../components/neuToggle';

export function createReplayModal(opts: {
  clip: ReplayClip;
  maze: MazeDef;
  reducedMotion: boolean;
  onClose: () => void;
}): { element: HTMLElement; cleanup: () => void } {
  const modal = createModal({
    ariaLabel: 'Prediction Replay Viewer',
    maxWidthPx: 560,
    reducedMotion: opts.reducedMotion,
    onClose: opts.onClose,
  });
  modal.open();

  const top = document.createElement('div');
  top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';
  const title = document.createElement('h2');
  title.className = 'type-h2';
  title.style.margin = '0';
  title.textContent = 'Predicted Moment';
  const closeBtn = createNeuButton('Close', opts.onClose);
  top.append(title, closeBtn);

  const caption = document.createElement('p');
  caption.style.cssText = 'margin:0;color:var(--umber-ink);font-weight:500;';
  caption.textContent = opts.clip.caption;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:auto;border-radius:12px;background:var(--moss-deep);';

  const player = new ClipPlayer(canvas, opts.clip, opts.maze);
  player.renderCurrent();

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

  const playToggle = createNeuButton('Pause', () => {
    const next = !player.isPlaying();
    player.setPlaying(next);
    playToggle.innerHTML = `<span class="btn-icon">${next ? iconPause() : iconPlay()}</span><span>${next ? 'Pause' : 'Play'}</span>`;
  }, { iconSvg: iconPause() });

  const scrubber = createNeuSlider({
    label: 'Moment Scrubber',
    min: 0,
    max: 100,
    value: 0,
    formatValue: (v) => `${Math.round(v)}%`,
    onChange: (v) => {
      player.setPlaying(false);
      playToggle.innerHTML = `<span class="btn-icon">${iconPlay()}</span><span>Play</span>`;
      player.seekProgress(v / 100);
    },
  });

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;';

  const speedGroup = document.createElement('div');
  speedGroup.style.cssText = 'display:flex;gap:6px;';
  const speeds: ReplaySpeed[] = [0.25, 0.5, 1];
  const speedBtns: HTMLElement[] = [];

  for (const s of speeds) {
    const chip = createNeuChip(`${s}×`, {
      pressed: player.getSpeed() === s,
      onClick: () => {
        player.setSpeed(s);
        speedBtns.forEach((b, idx) => {
          b.classList.toggle('is-pressed', speeds[idx] === s);
        });
      },
    });
    speedBtns.push(chip);
    speedGroup.appendChild(chip);
  }

  btnRow.append(playToggle, speedGroup);
  controls.append(scrubber.element, btnRow);

  const legend = document.createElement('div');
  legend.style.cssText = 'font-size:0.8rem;color:var(--umber-soft);display:flex;gap:16px;';
  legend.innerHTML =
    '<span><svg width="18" height="8" aria-hidden="true"><line x1="0" y1="4" x2="18" y2="4" stroke="#FBF7EE" stroke-width="2.5"/></svg> Pearl: actual path</span>' +
    '<span><svg width="18" height="8" aria-hidden="true"><line x1="0" y1="4" x2="18" y2="4" stroke="#2F8F83" stroke-width="2" stroke-dasharray="4 3"/></svg> Dashed: ghost prediction</span>';

  modal.panel.append(top, caption, canvas, legend, controls);

  let rafId = 0;
  let lastT = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    player.step(dt);
    if (player.isPlaying()) {
      scrubber.setValue(Math.round(player.getProgress() * 100));
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return {
    element: modal.backdrop,
    cleanup: () => {
      cancelAnimationFrame(rafId);
      modal.cleanup();
    },
  };
}
