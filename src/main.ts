import '@fontsource-variable/fraunces';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/ibm-plex-mono/500.css';
import './ui/tokens.css';

import { createFullAutopsyFixture, createMidRunInspectFixture } from './dev/previewFixtures';
import { EventBus } from './game/core/eventBus';
import { FixedStepLoop } from './game/core/loop';
import {
  buildHudSnapshot,
  createWorld,
  endWorldRun,
  queueWorldInput,
  stepWorld,
  type WorldState,
} from './game/core/world';
import { CanvasRenderer } from './game/render/canvasRenderer';
import { AudioEngine } from './platform/audio';
import { bindKeyboardInput, bindTouchSwipeInput } from './platform/input';
import { loadRunHistory, saveRunSummary } from './platform/runHistory';
import {
  applySettingsToDocument,
  hasSeenBriefing,
  loadSettings,
  markBriefingSeen,
  saveSettings,
} from './platform/settings';
import { buildAutopsyFromWorld } from './report/autopsyBuilder';
import { createSettingsDrawer } from './ui/components/settingsDrawer';
import { transitionScreen } from './ui/motion';
import { renderAutopsyScreen } from './ui/screens/autopsyScreen';
import { renderBriefingScreen } from './ui/screens/briefingScreen';
import { createGameScreen } from './ui/screens/gameScreen';
import { renderHistoryScreen } from './ui/screens/historyScreen';
import { createReplayModal } from './ui/screens/replayModal';
import { renderTitleScreen } from './ui/screens/titleScreen';
import { UiStore } from './ui/store';

function mountSvgRefractionDefs(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
  svg.innerHTML = `
    <defs>
      <filter id="liquid-refract" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  `;
  return svg;
}

function mountBackgroundScene(): {
  root: HTMLElement;
  setParallax: (nx: number, ny: number, reducedMotion: boolean) => void;
} {
  const scene = document.createElement('div');
  scene.className = 'bg-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `
    <div class="bg-hedge-layer"></div>
    <div class="bg-fog-layer"></div>
    <div class="bg-droplets-layer"></div>
    <div class="bg-grain"></div>
    <div class="bg-vignette-layer"></div>
  `;

  const hedge = scene.querySelector('.bg-hedge-layer') as HTMLElement;
  const fog = scene.querySelector('.bg-fog-layer') as HTMLElement;
  const droplets = scene.querySelector('.bg-droplets-layer') as HTMLElement;
  const vignette = scene.querySelector('.bg-vignette-layer') as HTMLElement;

  const setParallax = (nx: number, ny: number, reducedMotion: boolean) => {
    if (reducedMotion) {
      hedge.style.transform = '';
      fog.style.transform = '';
      droplets.style.transform = '';
      vignette.style.transform = '';
      return;
    }
    hedge.style.transform = `translate3d(${(nx * 20 * 0.02).toFixed(1)}px, ${(ny * 20 * 0.02).toFixed(1)}px, 0)`;
    fog.style.transform = `translate3d(${(nx * 24 * 0.05).toFixed(1)}px, ${(ny * 24 * 0.05).toFixed(1)}px, 0)`;
    droplets.style.transform = `translate3d(${(nx * 28 * 0.09).toFixed(1)}px, ${(ny * 28 * 0.09).toFixed(1)}px, 0)`;
    vignette.style.transform = `translate3d(${(nx * 30 * 0.14).toFixed(1)}px, ${(ny * 30 * 0.14).toFixed(1)}px, 0)`;
  };

  return { root: scene, setParallax };
}

function bootstrap(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.appendChild(mountSvgRefractionDefs());
  const bg = mountBackgroundScene();
  app.appendChild(bg.root);
  const screenHost = document.createElement('main');
  screenHost.className = 'screen-host';
  app.appendChild(screenHost);

  let settings = loadSettings().settings;
  applySettingsToDocument(settings);

  const store = new UiStore();
  const bus = new EventBus();
  const audio = new AudioEngine();
  audio.applySettings(settings);
  audio.bindToBus(bus);

  const unlockAudio = () => audio.unlockFromGesture();
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  let world: WorldState | null = null;
  let renderer: CanvasRenderer | null = null;
  let trailVisibility = { ...settings.trails };
  let cleanupCurrent: (() => void) | null = null;
  let settingsOverlay: { element: HTMLElement; cleanup: () => void } | null = null;
  let replayOverlay: { element: HTMLElement; cleanup: () => void } | null = null;
  const savedRunIds = new Set<string>();
  let inspectAutopsyFixture: ReturnType<typeof createFullAutopsyFixture> | null = null;

  // Title idle drift (<= 6px) & pointer parallax
  let driftPhase = 0;
  window.addEventListener('pointermove', (ev) => {
    if (store.getState().screen === 'title') {
      const nx = (ev.clientX / Math.max(1, window.innerWidth) - 0.5) * 20;
      const ny = (ev.clientY / Math.max(1, window.innerHeight) - 0.5) * 20;
      bg.setParallax(nx, ny, settings.reducedMotion);
    }
  });
  setInterval(() => {
    if (store.getState().screen === 'title' && !settings.reducedMotion) {
      driftPhase += 0.04;
      bg.setParallax(Math.sin(driftPhase) * 3, Math.cos(driftPhase * 0.7) * 2, false);
    }
  }, 80);

  const loop = new FixedStepLoop({
    step: (dtS) => {
      if (world && !world.paused && !world.ended) {
        stepWorld(world, dtS, bus, (snap) => store.setState({ ...snap, trails: trailVisibility }));
      }
    },
    render: (alpha, fps) => {
      if (world && renderer) {
        renderer.render(world, {
          alpha,
          fps,
          trails: trailVisibility,
          colorblind: settings.colorblind,
          reducedMotion: settings.reducedMotion,
        });
        if (!settings.reducedMotion) {
          const ox = -((world.player.pos.x / world.maze.cols - 0.5) * 8);
          const oy = -((world.player.pos.y / world.maze.rows - 0.5) * 8);
          bg.setParallax(ox, oy, false);
        }
      }
    },
  });

  const openSettings = () => {
    if (settingsOverlay) return;
    settingsOverlay = createSettingsDrawer({
      initial: settings,
      onChange: (next) => {
        settings = next;
        trailVisibility = { ...next.trails };
        saveSettings(next);
        applySettingsToDocument(next);
        audio.applySettings(next);
        store.patch({ trails: trailVisibility });
      },
      onClose: () => {
        settingsOverlay?.cleanup();
        settingsOverlay?.element.remove();
        settingsOverlay = null;
      },
    });
    app.appendChild(settingsOverlay.element);
  };

  const startNewRun = () => {
    inspectAutopsyFixture = null;
    world = createWorld(Date.now() & 0x7fffffff);
    trailVisibility = { ...settings.trails };
    loop.setPaused(false);
    // Reset store immediately with fresh run state (lives=3, score=0, paused=false) before mounting
    store.setState({ ...buildHudSnapshot(world), trails: trailVisibility });
    loop.start();
  };

  const handleBeginClick = () => {
    if (!hasSeenBriefing()) {
      store.setScreen('briefing');
    } else {
      startNewRun();
    }
  };

  const togglePause = (forcePause?: boolean) => {
    if (!world || world.ended) return;
    const nextPaused = forcePause !== undefined ? forcePause : !world.paused;
    world.paused = nextPaused;
    loop.setPaused(nextPaused);
    store.patch({ paused: nextPaused, screen: nextPaused ? 'paused' : 'playing' });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world && !world.paused && !world.ended) {
      togglePause(true);
    }
  });

  const mountWithTransition = (el: HTMLElement) => {
    transitionScreen(screenHost, el, settings.reducedMotion);
  };

  const renderScreen = (screenName: string) => {
    cleanupCurrent?.();

    if (screenName === 'title') {
      loop.stop();
      renderer = null;
      const history = loadRunHistory();
      const rendered = renderTitleScreen({
        onBeginHaunting: handleBeginClick,
        onHowTheyLearn: () => store.setScreen('briefing'),
        onSettings: openSettings,
        onRunHistory: () => store.setScreen('history'),
        hasRunHistory: history.length > 0,
        reducedMotion: settings.reducedMotion,
      });
      cleanupCurrent = rendered.cleanup;
      mountWithTransition(rendered.element);
      return;
    }

    if (screenName === 'history') {
      loop.stop();
      const runs = loadRunHistory();
      const el = renderHistoryScreen({
        runs,
        onBack: () => store.setScreen('title'),
      });
      mountWithTransition(el);
      cleanupCurrent = null;
      return;
    }

    if (screenName === 'briefing') {
      loop.stop();
      const rendered = renderBriefingScreen({
        reducedMotion: settings.reducedMotion,
        onContinue: () => {
          markBriefingSeen();
          startNewRun();
        },
        onSkip: () => {
          markBriefingSeen();
          startNewRun();
        },
      });
      cleanupCurrent = rendered.cleanup;
      mountWithTransition(rendered.element);
      return;
    }

    if (screenName === 'playing' || screenName === 'paused') {
      if (!world) {
        world = createWorld();
      }
      const gameUi = createGameScreen({
        onPauseToggle: () => togglePause(),
        onResume: () => togglePause(false),
        onRestart: startNewRun,
        onSettings: openSettings,
        onEndRun: () => {
          if (world) {
            world.paused = false;
            loop.setPaused(false);
            endWorldRun(world, 'manual', bus);
            loop.stop();
          }
        },
        initialTrails: trailVisibility,
        onTrailsChange: (next) => {
          trailVisibility = next;
          store.patch({ trails: next });
        },
        reducedMotion: settings.reducedMotion,
      });
      renderer = new CanvasRenderer(gameUi.canvas);
      renderer.prepareMazeLayer(world);
      renderer.render(world, {
        alpha: 0,
        fps: 60,
        trails: trailVisibility,
        colorblind: settings.colorblind,
        reducedMotion: settings.reducedMotion,
      });
      gameUi.updateHud(store.getState(), settings.reducedMotion);

      const unsubHud = store.subscribe((snap) => {
        if (snap.screen === 'playing' || snap.screen === 'paused') {
          gameUi.updateHud(snap, settings.reducedMotion);
        }
      });
      const unsubCallout = bus.on('habit-locked', (e) => {
        gameUi.showRecognition(e.ghostId, e.message, settings.reducedMotion);
      });
      const unsubCapture = bus.on('capture', (e) => {
        gameUi.showCapture(e.causeLine);
        gameUi.triggerWarmCaptureVignette();
        if (world) renderer?.fx.triggerCaptureDissolve(world.player.pos);
      });
      const unsubPB = bus.on('pattern-break', () => {
        if (world) renderer?.fx.triggerPatternBreak(world.player.pos);
        gameUi.triggerPatternBreakPulse(settings.reducedMotion);
      });
      const unsubRound = bus.on('round-clear', () => {
        gameUi.triggerRoundWipe(settings.reducedMotion);
      });
      const unsubRunEnd = bus.on('run-end', () => {
        loop.stop();
        store.setScreen('autopsy');
      });
      const unbindKeys = bindKeyboardInput({
        onDirection: (dir) => {
          if (world) queueWorldInput(world, dir);
        },
        onPauseToggle: () => togglePause(),
      });
      const unbindTouch = bindTouchSwipeInput(gameUi.canvas, (dir) => {
        if (world) queueWorldInput(world, dir);
      });

      cleanupCurrent = () => {
        unsubHud();
        unsubCallout();
        unsubCapture();
        unsubPB();
        unsubRound();
        unsubRunEnd();
        unbindKeys();
        unbindTouch();
        gameUi.cleanup();
      };
      mountWithTransition(gameUi.element);
      return;
    }

    if (screenName === 'autopsy') {
      loop.stop();
      const activeWorld = world ?? createWorld();
      const report = inspectAutopsyFixture ? inspectAutopsyFixture.report : buildAutopsyFromWorld(activeWorld);
      const historyBefore = loadRunHistory().filter((r) => r.runId !== report.runId);
      const previousRun = inspectAutopsyFixture ? inspectAutopsyFixture.previousRun : historyBefore[0];

      if (!inspectAutopsyFixture && !savedRunIds.has(report.runId)) {
        savedRunIds.add(report.runId);
        saveRunSummary(
          {
            runId: report.runId,
            date: new Date().toISOString(),
            score: report.score,
            rounds: report.round,
            predictabilityIndex: report.predictabilityIndex,
            meanEntropy: report.meanEntropy,
            patternBreaks: report.patternBreaks,
          },
          report.clips,
        );
      }

      const debugJson = activeWorld.recorder.exportDebugJson({
        runId: activeWorld.runId,
        round: activeWorld.round,
        score: activeWorld.score,
        durationS: activeWorld.elapsedS,
      });
      const rendered = renderAutopsyScreen({
        report,
        previousRun,
        debugJson,
        reducedMotion: settings.reducedMotion,
        onHauntAgain: startNewRun,
        onTitle: () => store.setScreen('title'),
        onHistory: () => store.setScreen('history'),
        onWatchClip: (clip) => {
          if (replayOverlay) return;
          replayOverlay = createReplayModal({
            clip,
            maze: activeWorld.maze,
            reducedMotion: settings.reducedMotion,
            onClose: () => {
              replayOverlay?.cleanup();
              replayOverlay?.element.remove();
              replayOverlay = null;
            },
          });
          app.appendChild(replayOverlay.element);
        },
      });
      cleanupCurrent = () => {
        rendered.cleanup();
        if (replayOverlay) {
          replayOverlay.cleanup();
          replayOverlay.element.remove();
          replayOverlay = null;
        }
      };
      mountWithTransition(rendered.element);
      return;
    }
  };

  let lastMountedGroup = '';
  store.subscribe((next) => {
    const group = next.screen === 'playing' || next.screen === 'paused' ? 'game' : next.screen;
    if (group !== lastMountedGroup) {
      lastMountedGroup = group;
      renderScreen(next.screen);
    }
  });

  // Optional URL inspection parameter for verifying mid-run/recalibrating/autopsy/replay states
  const params = new URLSearchParams(window.location.search);
  const inspect = params.get('inspect');
  if (inspect === 'midrun') {
    const fx = createMidRunInspectFixture();
    world = fx.world;
    store.setState(fx.snapshot);
    return;
  }
  if (inspect === 'autopsy' || inspect === 'replay') {
    inspectAutopsyFixture = createFullAutopsyFixture();
    store.setScreen('autopsy');
    if (inspect === 'replay') {
      const activeWorld = createWorld();
      const modal = createReplayModal({
        clip: inspectAutopsyFixture.clip,
        maze: activeWorld.maze,
        reducedMotion: settings.reducedMotion,
        onClose: () => {
          modal.cleanup();
          modal.element.remove();
        },
      });
      app.appendChild(modal.element);
    }
    return;
  }
  if (inspect === 'briefing') {
    store.setScreen('briefing');
    return;
  }
  // Note: store.subscribe() above already mounted 'title' synchronously on initial subscription.
}

bootstrap();
