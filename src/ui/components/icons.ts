import type { GhostId, GhostMode } from '../../game/core/types';

function svgWrap(viewBox: string, body: string, size = 16, stroke = 'currentColor'): string {
  return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function iconPause(): string {
  return svgWrap('0 0 16 16', '<line x1="5.5" y1="3" x2="5.5" y2="13"/><line x1="10.5" y1="3" x2="10.5" y2="13"/>');
}

export function iconGear(): string {
  return svgWrap(
    '0 0 16 16',
    '<circle cx="8" cy="8" r="2.5"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"/>',
  );
}

export function iconBook(): string {
  return svgWrap(
    '0 0 16 16',
    '<path d="M2.5 3.5c2-.8 4-.4 5.5.8 1.5-1.2 3.5-1.6 5.5-.8v9.2c-2-.7-4-.3-5.5.8-1.5-1.1-3.5-1.5-5.5-.8z"/><line x1="8" y1="4.3" x2="8" y2="13.5"/>',
  );
}

export function iconArchive(): string {
  return svgWrap(
    '0 0 16 16',
    '<rect x="2.2" y="3" width="11.6" height="2.6" rx="0.8"/><path d="M3.4 5.6v7.2a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1V5.6"/><line x1="6.4" y1="8.8" x2="9.6" y2="8.8"/>',
  );
}

export function iconReplay(): string {
  return svgWrap(
    '0 0 16 16',
    '<path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4L2.8 6.4"/><polyline points="2.6 3.2 2.8 6.4 6 6.2"/>',
  );
}

export function iconPlay(): string {
  return svgWrap('0 0 16 16', '<polygon points="4.5,3 13,8 4.5,13"/>');
}

export function iconMode(mode: GhostMode, stroke = 'currentColor'): string {
  switch (mode) {
    case 'chase':
      return svgWrap('0 0 16 16', '<line x1="2.5" y1="8" x2="12.5" y2="8"/><polyline points="9,4.5 12.5,8 9,11.5"/>', 14, stroke);
    case 'predict':
      return svgWrap('0 0 16 16', '<circle cx="8" cy="8" r="5.2"/><circle cx="8" cy="8" r="1.6"/>', 14, stroke);
    case 'ambush':
      return svgWrap('0 0 16 16', '<line x1="4" y1="2.5" x2="4" y2="13.5"/><path d="M4 3h8l-1.8 2.6L12 8.2H4"/>', 14, stroke);
    case 'recalibrate':
      return svgWrap('0 0 16 16', '<path d="M5.7 5.8a2.3 2.3 0 1 1 3.7 1.8c-.9.6-1.4 1.1-1.4 2.1"/><circle cx="8" cy="12.4" r="0.6" fill="currentColor"/>', 14, stroke);
    case 'stumble':
      return svgWrap('0 0 16 16', '<path d="M8 2.2v2.2M8 11.6v2.2M2.2 8h2.2M11.6 8h2.2M4 4l1.5 1.5M10.5 10.5L12 12M12 4l-1.5 1.5M5.5 10.5L4 12"/>', 14, stroke);
  }
}

export function iconGhostShape(ghostId: GhostId, colorHex: string, size = 20): string {
  if (ghostId === 'pinky') {
    // Rounded hem
    return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 15V9.5a6 6 0 0 1 12 0V15c-1.8 1.5-4.2 1.5-6 0-1.8 1.5-4.2 1.5-6 0Z" fill="${colorHex}" fill-opacity="0.82" stroke="#2A2622" stroke-width="1.2"/>
      <circle cx="8" cy="9" r="1.1" fill="#FBF7EE"/><circle cx="12" cy="9" r="1.1" fill="#FBF7EE"/>
    </svg>`;
  }
  if (ghostId === 'inky') {
    // Scalloped hem + clock tick
    return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 15V9.5a6 6 0 0 1 12 0V15q-1.5 1.6-3 0t-3 0-3 0-3 0Z" fill="${colorHex}" fill-opacity="0.82" stroke="#2A2622" stroke-width="1.2"/>
      <path d="M10 5.4v2h1.6" fill="none" stroke="#FBF7EE" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="8" cy="10" r="1" fill="#FBF7EE"/><circle cx="12" cy="10" r="1" fill="#FBF7EE"/>
    </svg>`;
  }
  // Jagged hem
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 15V9.5a6 6 0 0 1 12 0V15l-2 1.6-2-1.6-2 1.6-2-1.6-2 1.6Z" fill="${colorHex}" fill-opacity="0.82" stroke="#2A2622" stroke-width="1.2"/>
    <circle cx="8" cy="9" r="1.1" fill="#FBF7EE"/><circle cx="12" cy="9" r="1.1" fill="#FBF7EE"/>
  </svg>`;
}
