/**
 * Dev-only test seam (never installed in production builds). Lets Playwright
 * drive the real progression/reward/persistence path deterministically without
 * a 25-second audio take. Exposed on window under `__pianoTest`.
 */
import type { Attempt } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { chartForLesson, fragmentAsChart } from '@/core/content/resolveChart';
import { xpPurposeFor } from '@/core/session/sessionTypes';
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
          const resolved = chartForLesson(content, lesson);
          if (!resolved) throw new Error(`lesson ${lessonId} has no resolvable chart/song`);
          const { song, chart } = resolved;
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
      /** Start a practice session through the real builder. */
      async startSession() {
        await useGameStore.getState().init();
        const plan = await useGameStore.getState().startSession();
        return { sessionId: plan.sessionId, queue: plan.queue.map((s) => s.purpose) };
      },
      /** Complete the current session segment with a canned result through the
       * real reducers, then advance the queue. */
      async completeCurrentSegment(scorePct = 1) {
        const store = useGameStore.getState();
        const active = store.activeSession;
        const segment = active?.plan.queue[0];
        if (!active || !segment) throw new Error('no active session segment');
        const content = getContent();
        const sessionId = active.plan.sessionId;
        let passed = scorePct >= 0.8;

        if (segment.activity.kind === 'lesson') {
          const lesson = content.getLesson(segment.activity.lessonId);
          const module = content.getModule(segment.activity.moduleId);
          if (!lesson || !module) throw new Error('unresolvable lesson segment');
          const sessionCtx = {
            sessionId,
            purpose: xpPurposeFor(segment.purpose),
            addressedRecordedWeakness: segment.purpose === 'remediation',
          };
          const isChart = lesson.exerciseType === 'play-chart' || lesson.exerciseType === 'fragment';
          const reward = isChart
            ? await (async () => {
                const resolved = chartForLesson(content, lesson);
                if (!resolved) throw new Error('unresolvable chart lesson');
                return store.recordLesson(
                  lesson,
                  module,
                  { ...resolved, attempt: cannedMasteryAttempt(resolved.chart.id) },
                  sessionCtx,
                );
              })()
            : await store.recordLesson(
                lesson,
                module,
                {
                  result: {
                    lessonId: lesson.id,
                    exerciseType: lesson.exerciseType,
                    promptCount: 5,
                    correctCount: Math.round(5 * scorePct),
                    scorePct,
                    details: [],
                  },
                },
                sessionCtx,
              );
          passed = reward.passed;
        } else {
          const song = content.getSong(segment.activity.songId);
          const chart =
            segment.activity.kind === 'fragment'
              ? (() => {
                  const fragment = content.getFragment(segment.activity.fragmentId);
                  return fragment ? fragmentAsChart(fragment) : undefined;
                })()
              : content.getChart(segment.activity.chartId);
          if (!song || !chart) throw new Error('unresolvable chart segment');
          const attempt = cannedMasteryAttempt(chart.id);
          if (segment.activity.kind === 'section-drill') {
            attempt.sectionId = segment.activity.sectionId;
          }
          if (segment.activity.kind === 'fragment') attempt.refKind = 'fragment';
          await store.recordAttempt(song, chart, attempt, {
            sessionId,
            skipSongMastery: segment.purpose === 'stretch-boss',
          });
          passed = true;
        }

        const res = await useGameStore
          .getState()
          .completeSegment({ segmentId: segment.id, passed, scorePct });
        return { passed, next: res.next?.purpose ?? null, injected: res.injected?.purpose ?? null };
      },
      /** Force every tracked skill's FSRS card due (review-heavy sessions). */
      async makeReviewsDue() {
        await useGameStore.getState().init();
        const { skillProgressById } = useGameStore.getState();
        const past = Date.now() - 3_600_000;
        const updated = [...skillProgressById.values()].map((p) => ({
          ...p,
          freshness: { ...p.freshness, due: past },
        }));
        await repository.saveSkillProgress(updated);
        useGameStore.setState({
          skillProgressById: new Map(updated.map((p) => [p.skillId, p])),
        });
        return updated.length;
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
