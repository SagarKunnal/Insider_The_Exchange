import type { HudSnapshot } from '../../game/core/types';
import { formatTimeMMSS } from '../../report/phrases';
import { createNeuButton, createNeuChip } from '../components/buttons';
import { iconPause } from '../components/icons';
import { bindLiquidSheen, springAnimate } from '../motion';

export function createHudBar(onPauseToggle: () => void): {
  element: HTMLElement;
  update: (snap: HudSnapshot, reducedMotion: boolean) => void;
  cleanup: () => void;
} {
  const hudBar = document.createElement('header');
  hudBar.className = 'hud-bar mat-liquid-glass';
  const unbindSheen = bindLiquidSheen(hudBar);

  const metricsLeft = document.createElement('div');
  metricsLeft.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:16px;';

  const roundEl = document.createElement('div');
  roundEl.className = 'hud-metric';
  roundEl.innerHTML =
    '<span class="type-caption" style="font-size:11px;">Round</span><strong class="type-stat" style="font-size:1.25rem;color:var(--moss-deep);">1</strong>';

  const timeEl = document.createElement('div');
  timeEl.className = 'hud-metric';
  timeEl.innerHTML =
    '<span class="type-caption" style="font-size:11px;">Elapsed</span><strong class="type-stat" style="font-size:1.1rem;color:var(--umber-ink);">00:00</strong>';

  const livesEl = document.createElement('div');
  livesEl.className = 'hud-metric';
  livesEl.setAttribute('aria-live', 'polite');

  metricsLeft.append(roundEl, timeEl, livesEl);

  const scoreGroup = document.createElement('div');
  scoreGroup.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:10px;';
  scoreGroup.setAttribute('aria-live', 'polite');

  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
  scoreEl.innerHTML =
    '<span class="type-caption" style="font-size:11px;">Score</span><strong class="type-stat" style="font-size:1.35rem;color:var(--moss-deep);">0</strong>';

  const multChip = createNeuChip('1.0×', { accentColor: 'var(--verdigris-deep)' });
  multChip.classList.add('type-stat');
  multChip.style.fontSize = '0.95rem';

  const lanternChip = createNeuChip('', { accentColor: 'var(--saffron-deep)' });
  lanternChip.classList.add('type-stat');
  lanternChip.style.cssText += ';font-size:0.85rem;display:none;';

  scoreGroup.append(scoreEl, multChip, lanternChip);

  const pauseBtn = createNeuButton('Pause', onPauseToggle, { iconSvg: iconPause() });
  pauseBtn.setAttribute('aria-label', 'Pause game (Escape)');
  hudBar.append(metricsLeft, scoreGroup, pauseBtn);

  let lastMultText = '1.0×';
  let lastScoreAnnounceT = -5;

  const update = (snap: HudSnapshot, reducedMotion: boolean) => {
    const rStrong = roundEl.querySelector('strong');
    if (rStrong) rStrong.textContent = String(snap.round);

    const tStrong = timeEl.querySelector('strong');
    if (tStrong) tStrong.textContent = formatTimeMMSS(snap.elapsedS);

    if (snap.elapsedS - lastScoreAnnounceT >= 5 || snap.score === 0) {
      lastScoreAnnounceT = snap.elapsedS;
      scoreEl.setAttribute('aria-label', `Score ${snap.score}`);
    }
    const sStrong = scoreEl.querySelector('strong');
    if (sStrong) sStrong.textContent = String(snap.score);

    const nextMultText = `${snap.multiplier.toFixed(1)}×`;
    if (nextMultText !== lastMultText) {
      lastMultText = nextMultText;
      multChip.textContent = nextMultText;
      springAnimate(multChip, { scale: [1, 1.15, 1] }, 'snappy', reducedMotion);
    }

    const orbs = Array.from({ length: Math.max(0, snap.lives) })
      .map(
        () =>
          '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--pearl);border:1.5px solid var(--moss-slate);box-shadow:inset 1px 1px 0 rgba(251,247,238,0.9),0 0 6px rgba(251,247,238,0.8);margin-right:5px;"></span>',
      )
      .join('');
    livesEl.innerHTML = `<span class="type-caption" style="font-size:11px;">Lives</span><span style="display:inline-flex;align-items:center;min-height:18px;">${orbs || '<span style="color:var(--umber-soft);">0</span>'}</span>`;

    if (snap.lanternRemainingS > 0) {
      lanternChip.style.display = 'inline-flex';
      lanternChip.textContent = `Lantern ${snap.lanternRemainingS.toFixed(1)}s`;
    } else {
      lanternChip.style.display = 'none';
    }
  };

  return {
    element: hudBar,
    update,
    cleanup: unbindSheen,
  };
}
