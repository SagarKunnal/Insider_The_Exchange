export function createBrassButton(
  label: string,
  onClick: () => void,
  opts?: { iconSvg?: string; disabled?: boolean },
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'brass-btn';
  btn.disabled = Boolean(opts?.disabled);
  if (opts?.iconSvg) {
    btn.innerHTML = `<span class="btn-icon">${opts.iconSvg}</span><span>${label}</span>`;
  } else {
    btn.textContent = label;
  }
  btn.addEventListener('click', onClick);
  return btn;
}

export function createNeuButton(
  label: string,
  onClick: () => void,
  opts?: { iconSvg?: string; disabled?: boolean },
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'neu-btn';
  btn.disabled = Boolean(opts?.disabled);
  if (opts?.iconSvg) {
    btn.innerHTML = `<span class="btn-icon">${opts.iconSvg}</span><span>${label}</span>`;
  } else {
    btn.textContent = label;
  }
  btn.addEventListener('click', onClick);
  return btn;
}

export function createNeuChip(
  label: string,
  opts?: { onClick?: () => void; pressed?: boolean; accentColor?: string },
): HTMLElement {
  const onClick = opts?.onClick;
  const el = onClick ? document.createElement('button') : document.createElement('span');
  el.className = 'neu-chip';
  if (el instanceof HTMLButtonElement && onClick) {
    el.type = 'button';
    el.style.cursor = 'pointer';
    if (opts?.pressed) el.classList.add('is-pressed');
    el.addEventListener('click', onClick);
  }
  if (opts?.accentColor) {
    el.style.color = opts.accentColor;
  }
  el.textContent = label;
  return el;
}
