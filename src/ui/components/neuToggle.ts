export function createNeuToggle(opts: {
  label: string;
  checked: boolean;
  swatchHtml?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}): { element: HTMLElement; setChecked: (v: boolean) => void } {
  let current = opts.checked;

  const row = document.createElement('label');
  row.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;font-size:0.875rem;user-select:none;';

  const left = document.createElement('span');
  left.style.cssText = 'display:inline-flex;align-items:center;gap:8px;color:var(--umber-ink);font-weight:500;';
  if (opts.swatchHtml) {
    const sw = document.createElement('span');
    sw.innerHTML = opts.swatchHtml;
    sw.style.display = 'inline-flex';
    left.appendChild(sw);
  }
  const textSpan = document.createElement('span');
  textSpan.textContent = opts.label;
  left.appendChild(textSpan);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.disabled = Boolean(opts.disabled);
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', String(current));
  btn.setAttribute('aria-label', opts.label);
  btn.className = 'neu-toggle-track mat-neu-inset';

  const thumb = document.createElement('span');
  thumb.className = 'neu-toggle-thumb';
  btn.appendChild(thumb);

  const sync = () => {
    btn.setAttribute('aria-checked', String(current));
    btn.classList.toggle('is-on', current);
  };
  sync();

  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    current = !current;
    sync();
    opts.onChange(current);
  });

  row.append(left, btn);
  return {
    element: row,
    setChecked: (v: boolean) => {
      current = v;
      sync();
    },
  };
}

export function createNeuSlider(opts: {
  label: string;
  min: number;
  max: number;
  value: number;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
}): {
  element: HTMLElement;
  setValue: (val: number) => void;
} {
  let current = Math.max(opts.min, Math.min(opts.max, opts.value));

  const root = document.createElement('div');
  root.className = 'neu-slider-wrap';

  const top = document.createElement('div');
  top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';

  const labelEl = document.createElement('span');
  labelEl.style.cssText = 'font-size:0.875rem;font-weight:500;color:var(--umber-ink);';
  labelEl.textContent = opts.label;

  const valEl = document.createElement('span');
  valEl.className = 'type-stat';
  valEl.style.cssText = 'font-size:0.875rem;color:var(--umber-soft);';
  top.append(labelEl, valEl);

  const track = document.createElement('div');
  track.className = 'neu-slider-track mat-neu-inset';
  track.setAttribute('role', 'slider');
  track.setAttribute('tabindex', '0');
  track.setAttribute('aria-label', opts.label);
  track.setAttribute('aria-valuemin', String(opts.min));
  track.setAttribute('aria-valuemax', String(opts.max));

  const fill = document.createElement('div');
  fill.className = 'neu-slider-fill';

  const thumb = document.createElement('div');
  thumb.className = 'neu-slider-thumb';

  track.append(fill, thumb);
  root.append(top, track);

  const sync = (val: number) => {
    current = Math.max(opts.min, Math.min(opts.max, val));
    const span = Math.max(1e-6, opts.max - opts.min);
    const pct = ((current - opts.min) / span) * 100;
    fill.style.width = `${pct.toFixed(1)}%`;
    thumb.style.left = `${pct.toFixed(1)}%`;
    track.setAttribute('aria-valuenow', String(Math.round(current)));
    valEl.textContent = opts.formatValue ? opts.formatValue(current) : String(Math.round(current));
  };
  sync(current);

  const updateFromClientX = (clientX: number) => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const next = opts.min + ratio * (opts.max - opts.min);
    sync(next);
    opts.onChange(current);
  };

  let dragging = false;
  const onPointerMove = (ev: PointerEvent) => {
    if (!dragging) return;
    updateFromClientX(ev.clientX);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  track.addEventListener('pointerdown', (ev) => {
    dragging = true;
    thumb.classList.add('is-dragging');
    updateFromClientX(ev.clientX);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  track.addEventListener('keydown', (ev) => {
    const step = (opts.max - opts.min) / 20;
    if (ev.code === 'ArrowRight' || ev.code === 'ArrowUp') {
      ev.preventDefault();
      sync(current + step);
      opts.onChange(current);
    } else if (ev.code === 'ArrowLeft' || ev.code === 'ArrowDown') {
      ev.preventDefault();
      sync(current - step);
      opts.onChange(current);
    }
  });

  return {
    element: root,
    setValue: sync,
  };
}
