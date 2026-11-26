import type { HudSnapshot } from '../../game/core/types';
import type { TrailVisibility } from '../../game/render/trailLayers';
import { createBrassButton, createNeuButton } from '../components/buttons';
import { iconGear } from '../components/icons';
import { createModal } from '../components/modal';
import { createCaptureCard } from '../hud/captureCard';
import { createEntropyTube } from '../hud/entropyTube';
import { createGhostMindCards } from '../hud/ghostMindCards';
import { createHudBar } from '../hud/hudBar';
import { createRecognitionToast } from '../hud/recognitionToast';
import { createTrailLegend } from '../hud/trailLegend';

export interface GameScreenActions {
  onPauseToggle: () => void;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onEndRun: () => void;
  onTrailsChange: (next: TrailVisibility) => void;
  initialTrails: TrailVisibility;
  reducedMotion: boolean;
}

export function createGameScreen(actions: GameScreenActions): {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  updateHud: (snapshot: HudSnapshot, reducedMotion: boolean) => void;
  showRecognition: (ghostId: 'pinky' | 'inky' | 'blinky', msg: string, reducedMotion: boolean) => void;
  showCapture: (causeLine: string) => void;
  triggerPatternBreakPulse: (reducedMotion: boolean) => void;
  triggerRoundWipe: (reducedMotion: boolean) => void;
  triggerWarmCaptureVignette: () => void;
  cleanup: () => void;
} {
  const root = document.createElement('section');
  root.className = 'game-screen';
  root.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px 20px;min-height:100vh;position:relative;';

  const hudBar = createHudBar(actions.onPauseToggle);

  const stage = document.createElement('div');
  stage.className = 'game-stage-layout';
  stage.style.cssText =
    'display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;gap:20px;width:100%;max-width:1040px;';

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'game-canvas-frame';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;border-radius:10px;max-width:100%;height:auto;touch-action:none;';

  const captureCard = createCaptureCard();
  const frostWipe = document.createElement('div');
  frostWipe.className = 'frost-wipe';
  const warmVignette = document.createElement('div');
  warmVignette.className = 'capture-warm-vignette';
  canvasWrap.append(canvas, frostWipe, captureCard.element);

  const rightRail = document.createElement('aside');
  rightRail.style.cssText =
    'display:flex;flex-direction:column;gap:12px;width:332px;max-width:100%;flex:1 1 280px;';

  const entropyTube = createEntropyTube();
  const mindCards = createGhostMindCards();
  const trailLegend = createTrailLegend(actions.initialTrails, actions.onTrailsChange);

  rightRail.append(entropyTube.element, mindCards.element, trailLegend.element);
  stage.append(canvasWrap, rightRail);

  const toast = createRecognitionToast();

  // Glassmorphic Pause Modal via shared Modal component
  const pauseModal = createModal({
    ariaLabel: 'Game Paused',
    maxWidthPx: 320,
    reducedMotion: actions.reducedMotion,
    onClose: actions.onResume,
  });
  pauseModal.panel.style.textAlign = 'center';

  const modalTitle = document.createElement('h2');
  modalTitle.className = 'type-h2';
  modalTitle.style.margin = '0 0 8px';
  modalTitle.textContent = 'Paused';

  const resumeBtn = createBrassButton('Resume', actions.onResume);
  const restartBtn = createNeuButton('Restart', actions.onRestart);
  const settingsBtn = createNeuButton('Settings', actions.onSettings, { iconSvg: iconGear() });
  const endBtn = createNeuButton('End Run', actions.onEndRun);
  pauseModal.panel.append(modalTitle, resumeBtn, restartBtn, settingsBtn, endBtn);

  root.append(hudBar.element, toast.element, stage, pauseModal.backdrop, warmVignette);

  let lastPaused = false;

  const updateHud = (snap: HudSnapshot, reducedMotion: boolean) => {
    hudBar.update(snap, reducedMotion);
    entropyTube.update(snap.entropy, reducedMotion);
    mindCards.update(snap.ghosts);

    if (snap.paused !== lastPaused) {
      lastPaused = snap.paused;
      if (snap.paused) pauseModal.open();
      else pauseModal.close();
    }
  };

  return {
    element: root,
    canvas,
    updateHud,
    showRecognition: (ghostId, msg, reducedMotion) => toast.show(ghostId, msg, reducedMotion),
    showCapture: (line) => captureCard.show(line),
    triggerPatternBreakPulse: (reducedMotion) => entropyTube.burstBubbles(reducedMotion),
    triggerRoundWipe: (reducedMotion) => {
      if (reducedMotion) return;
      frostWipe.classList.remove('active');
      void frostWipe.offsetWidth;
      frostWipe.classList.add('active');
      setTimeout(() => frostWipe.classList.remove('active'), 750);
    },
    triggerWarmCaptureVignette: () => {
      warmVignette.classList.add('active');
      setTimeout(() => warmVignette.classList.remove('active'), 480);
    },
    cleanup: () => {
      hudBar.cleanup();
      pauseModal.cleanup();
      toast.clear();
      captureCard.clear();
    },
  };
}
