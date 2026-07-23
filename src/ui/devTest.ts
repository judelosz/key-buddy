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
      /** Complete a lesson through the real reducer with a canned result. */
      async recordCannedLesson(lessonId: string, scorePct = 1) {
        const content = getContent();
        const lesson = content.getLesson(lessonId);
        const module = lesson ? content.getModule(lesson.moduleId) : undefined;
        if (!lesson || !module) throw new Error(`unknown lesson ${lessonId}`);
        await useGameStore.getState().init();
        if (lesson.exerciseType === 'play-chart' || lesson.exerciseType === 'fragment') {
          const chart = lesson.chartId
            ? content.getChart(lesson.chartId)
            : (() => {
                const fragment = content.getFragment(lesson.fragmentId ?? '');
                return fragment
                  ? {
                      id: fragment.id,
                      songId: fragment.sourceSongId,
                      arrangementLevel: 'simplified' as const,
                      ...fragment.chart,
                    }
                  : undefined;
              })();
          const song = chart ? content.getSong(chart.songId) : undefined;
          if (!song || !chart) throw new Error(`lesson ${lessonId} has no resolvable chart/song`);
          return useGameStore
            .getState()
            .recordLesson(lesson, module, { song, chart, attempt: cannedMasteryAttempt(chart.id) });
        }
        return useGameStore.getState().recordLesson(lesson, module, {
          result: {
            lessonId: lesson.id,
            exerciseType: lesson.exerciseType,
            promptCount: 5,
            correctCount: Math.round(5 * scorePct),
            scorePct,
            details: [],
          },
        });
      },
      async reset() {
        await repository.clearAll();
      },
      /** Skip the first-run onboarding gate (persists onboardedAt). */
      async completeOnboarding() {
        await useGameStore.getState().init();
        await useGameStore.getState().completeOnboarding();
        const { useAppStore } = await import('@/ui/store/appStore');
        useAppStore.getState().setShowOnboarding(false);
      },
    },
  });
}
