import { springAnimate } from '../motion';

export function createEntropyTube(): {
  element: HTMLElement;
  update: (entropy: number, reducedMotion: boolean) => void;
  burstBubbles: (reducedMotion: boolean) => void;
} {
  const wrap = document.createElement('div');
  wrap.className = 'entropy-tube-panel mat-glassmorphism';
  wrap.style.cssText =
    'display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;';

  // Skeuomorphic brass-capped glass tube
  const vessel = document.createElement('div');
  vessel.className = 'entropy-tube-vessel mat-liquid-glass';
  vessel.style.cssText =
    'position:relative;width:44px;height:176px;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;flex-shrink:0;';

  const topCap = document.createElement('div');
  topCap.style.cssText =
    'position:absolute;top:0;left:0;right:0;height:10px;background:linear-gradient(180deg,#E9C277 0%,#C28A2E 60%,#9A6A1E 100%);border-bottom:1.5px solid #8C5F18;z-index:3;';

  const bottomCap = document.createElement('div');
  bottomCap.style.cssText =
    'position:absolute;bottom:0;left:0;right:0;height:10px;background:linear-gradient(180deg,#E9C277 0%,#C28A2E 60%,#9A6A1E 100%);border-top:1.5px solid #8C5F18;z-index:3;';

  const liquid = document.createElement('div');
  liquid.style.cssText =
    'width:100%;height:50%;position:relative;transition:height 260ms cubic-bezier(0.22,1,0.36,1),background 300ms ease;background:#E3A73B;margin-bottom:10px;';

  const meniscus = document.createElement('div');
  meniscus.style.cssText =
    'position:absolute;top:-3px;left:0;right:0;height:6px;border-radius:50%;background:rgba(251,247,238,0.65);';
  liquid.appendChild(meniscus);

  const bubblesWrap = document.createElement('div');
  bubblesWrap.style.cssText = 'position:absolute;inset:10px 0;pointer-events:none;z-index:2;';

  // Tick marks every 10 from 10 to 90
  const ticks = document.createElement('div');
  ticks.style.cssText =
    'position:absolute;inset:12px 4px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;z-index:2;';
  for (let i = 0; i < 9; i += 1) {
    const tick = document.createElement('span');
    tick.style.cssText = `display:block;height:1px;width:${i % 2 === 0 ? 12 : 7}px;background:rgba(42,38,34,0.35);`;
    ticks.appendChild(tick);
  }

  vessel.append(topCap, ticks, bubblesWrap, liquid, bottomCap);

  // Numeric & label readout
  const meta = document.createElement('div');
  meta.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

  const label = document.createElement('div');
  label.className = 'type-caption';
  label.textContent = 'Entropy';

  const valueEl = document.createElement('div');
  valueEl.className = 'type-stat';
  valueEl.style.fontSize = '2rem';
  valueEl.textContent = '50';

  const bandEl = document.createElement('div');
  bandEl.style.cssText = 'font-size:0.8125rem;color:var(--umber-soft);';
  bandEl.textContent = 'Unpredictability';

  meta.append(label, valueEl, bandEl);
  wrap.append(vessel, meta);

  let lastRounded = 50;

  const update = (entropy: number, reducedMotion: boolean) => {
    const clamped = Math.max(0, Math.min(100, entropy));
    const rounded = Math.round(clamped);
    valueEl.textContent = String(rounded);

    const usableHeightPct = (clamped / 100) * 86; // leave room for brass caps
    liquid.style.height = `${usableHeightPct.toFixed(1)}%`;

    if (clamped < 35) {
      liquid.style.background = 'linear-gradient(180deg,#E3A73B 0%,#D2553F 100%)';
      bandEl.textContent = 'Predictable — ghosts locking on';
    } else if (clamped < 65) {
      liquid.style.background = 'linear-gradient(180deg,#E9C277 0%,#E3A73B 100%)';
      bandEl.textContent = 'Mixed patterns';
    } else {
      liquid.style.background = 'linear-gradient(180deg,#5CC2B3 0%,#2F8F83 100%)';
      bandEl.textContent = 'Elusive — bonus active';
    }

    if (!reducedMotion && Math.abs(rounded - lastRounded) >= 5) {
      lastRounded = rounded;
      springAnimate(liquid, { scaleY: [0.96, 1.04, 1] }, 'gooey', false);
    }
  };

  const burstBubbles = (reducedMotion: boolean) => {
    if (reducedMotion) return;
    for (let i = 0; i < 6; i += 1) {
      const b = document.createElement('span');
      b.style.cssText = `position:absolute;bottom:${10 + (i % 3) * 14}px;left:${8 + (i * 5) % 26}px;width:5px;height:5px;border-radius:50%;background:rgba(251,247,238,0.85);`;
      bubblesWrap.appendChild(b);
      springAnimate(b, { y: [0, -70], opacity: [0.95, 0] }, 'gooey', false);
      setTimeout(() => b.remove(), 650);
    }
  };

  return { element: wrap, update, burstBubbles };
}
