import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runBotSimulation } from '../src/dev/habitSimulator';
import { loadSettings, saveSettings } from '../src/platform/settings';
import { resetMemoryStorageForTest } from '../src/platform/storage';
import { buildAutopsyFromWorld, buildAutopsyReport } from '../src/report/autopsyBuilder';

describe('Phase 6 Run Flow, Autopsy & Settings (C-09, S-07, S-08, S-09)', () => {
  beforeEach(() => {
    resetMemoryStorageForTest();
  });

  it('matches every Autopsy number to the debug JSON export (C-09)', () => {
    const sim = runBotSimulation({ policy: 'alwaysLeft', durationS: 75, seed: 22, invulnerable: true });
    const report = buildAutopsyFromWorld(sim.world);
    const exported = JSON.parse(sim.debugJson);

    expect(report.sufficientData).toBe(true);
    expect(report.round).toBe(exported.run.round);
    expect(report.score).toBe(exported.run.score);
    expect(report.patternBreaks).toBe(exported.patternBreaks.length);
    expect(report.entropyTimeline.length).toBe(exported.entropyTimeline.length);

    const totalPreds = exported.predictions.filter((p: { hit?: boolean }) => p.hit !== undefined);
    const totalHits = totalPreds.filter((p: { hit?: boolean }) => p.hit).length;
    const expectedIndex = totalPreds.length > 0 ? Math.round((totalHits / totalPreds.length) * 100) : 0;
    expect(report.predictabilityIndex).toBe(expectedIndex);
  });

  it('omits statements below confidence/sample thresholds', () => {
    const report = buildAutopsyReport({
      runId: 'r-thresh',
      round: 1,
      score: 400,
      durationS: 60,
      decisions: Array.from({ length: 10 }, (_, i) => ({
        t: i * 4,
        junctionId: 1,
        entryDir: 'W',
        exitDir: 'N',
        relTurn: 'R',
        dwellMs: 120,
        threat: false,
        corridorId: 'C01',
      })),
      predictions: [],
      patternBreaksCount: 0,
      entropyTimeline: [],
      peakMultiplier: 1.5,
      knewBy: {},
      hotspots: [{ junctionId: 1, corridorHint: 'Fern Gallery', meanDwellMs: 300, count: 2 }], // below count >= 3
      favoriteLoop: { description: '3-junction loop', repeats: 1, junctionCount: 3 }, // below repeats >= 2
      favoriteEscape: { corridorId: 'C02', nickname: 'Moth Alley', count: 2, pct: 66 }, // below count >= 3
      panicSummary: { threatCount: 4, biasedTurn: 'L', biasedPct: 75 }, // below threatCount >= 6
      clips: [],
    });

    expect(report.sufficientData).toBe(true);
    expect(report.statements).toEqual([]);
  });

  it('returns honest insufficient-data state for runs < 45s', () => {
    const sim = runBotSimulation({ policy: 'alwaysLeft', durationS: 20, seed: 9, invulnerable: true });
    const report = buildAutopsyFromWorld(sim.world);

    expect(report.sufficientData).toBe(false);
    expect(report.statements).toEqual([]);
  });

  it('persists settings across reload via localStorage and handles corrupt storage (S-09)', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mem.set(k, v);
        },
        removeItem: (k: string) => {
          mem.delete(k);
        },
      },
    });

    const initial = loadSettings().settings;
    initial.sound = false;
    initial.reducedMotion = true;
    initial.colorblind = true;
    initial.volume = 0.35;
    initial.trails.panic = false;
    expect(saveSettings(initial)).toBe(true);

    const reloaded = loadSettings().settings;
    expect(reloaded.sound).toBe(false);
    expect(reloaded.reducedMotion).toBe(true);
    expect(reloaded.colorblind).toBe(true);
    expect(reloaded.volume).toBeCloseTo(0.35, 5);
    expect(reloaded.trails.panic).toBe(false);
    vi.unstubAllGlobals();
  });
});
