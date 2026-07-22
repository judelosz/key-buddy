/**
 * Dev-only test seam (never installed in production builds). Lets Playwright
 * drive the real progression/reward/persistence path deterministically without
 * a 25-second audio take. Exposed on window under `__pianoTest`.
 */
import type { Attempt } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { useGameStore } from '@/ui/store/gameStore';
import { repository } from '@/data/dexieRepository';

function cannedMasteryAttempt(chartId: string): Attempt {
  return {
    id: `canned-${chartId}-${Math.random().toString(36).slice(2)}`,
    refId: chartId,
    refKind: 'chart',
    timestamp: Date.now(),
    perNoteGrades: [],
    timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
    wrongNotes: [],
    extraNotes: 0,
    notesCorrectPct: 1,
    goodOrBetterPct: 1,
    greatOrBetterPct: 1,
    stars: 3,
    masteryStar: true,
    atTempo: true,
    tempoBPM: 96,
    assistsUsed: [],
    xpAwarded: 0,
    riffsAwarded: 0,
  };
}

export function installDevTest(): void {
  Object.assign(window, {
    __pianoTest: {
      async recordCanned(songId = 'ode-to-joy', chartId = 'ode-to-joy--simplified') {
        const content = getContent();
        const song = content.getSong(songId);
        const chart = content.getChart(chartId);
        if (!song || !chart) throw new Error('unknown song/chart');
        await useGameStore.getState().init();
        return useGameStore.getState().recordAttempt(song, chart, cannedMasteryAttempt(chart.id));
      },
      async reset() {
        await repository.clearAll();
      },
    },
  });
}
