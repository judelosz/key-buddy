import { describe, it, expect } from 'vitest';
import type { Attempt, Skill, Song } from '@/core/types';
import type {
  Assessment,
  CurriculumLesson,
  Module,
  TierGate,
} from '@/core/curriculum/types';
import type { ExerciseResult } from '@/core/exercise/types';
import { recordLessonAttempt, type RecordLessonInput } from '@/core/session/recordLesson';
import { initialPlayerState } from '@/data/repository';
import { HANDS_THRESHOLD } from '@/core/progression/progressionService';

const NOW = 1_753_000_000_000;

const skill = (id: string, tier = 1): Skill => ({
  id, name: id, family: 'geography-mechanics', tier, genre: 'foundation',
  prerequisites: [], description: '',
});

const song = (id: string, over: Partial<Song> = {}): Song => ({
  id, title: id, source: 't', publicDomain: true, genre: 'foundation', tier: 1,
  key: 'C', tempoTargetBPM: 96, timeSignature: { beatsPerBar: 4, beatUnit: 4 }, feel: 'straight',
  requiredSkills: [], taughtSkills: ['skill-a'], arrangementLevels: ['simplified'],
  chartIds: ['boss--simplified'], fragmentIds: [], ...over,
});

const lesson = (over: Partial<CurriculumLesson> = {}): CurriculumLesson => ({
  id: 'l-ear', moduleId: 'm1', order: 0, title: 'Ear', mode: 'supported',
  exerciseType: 'chord-ear', skillIds: ['skill-a'], prompt: '', successRule: '',
  passCriteria: {}, assistOptions: [], ...over,
});

const moduleFx = (over: Partial<Module> = {}): Module => ({
  id: 'm1', arc: 'foundation', tier: 1, title: 'M1', promise: '',
  prerequisiteModuleIds: [], lessonIds: ['l-ear'], coreSkillIds: ['skill-a'],
  revisits: [], prepares: [], ...over,
});

const chartFx = {
  id: 'boss--simplified', songId: 'boss', arrangementLevel: 'simplified' as const,
  timeSignature: { beatsPerBar: 4, beatUnit: 4 }, chordSymbols: [],
  notes: [{ id: 'n1', pitches: [60], startBeat: 0, durationBeats: 1, hand: 'right' as const }],
};

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  id: 'a1', refId: 'boss--simplified', refKind: 'chart', timestamp: NOW,
  perNoteGrades: [], timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
  wrongNotes: [], extraNotes: 0, notesCorrectPct: 1, goodOrBetterPct: 1, greatOrBetterPct: 1,
  stars: 3, masteryStar: true, atTempo: true, tempoBPM: 96, assistsUsed: [],
  xpAwarded: 0, riffsAwarded: 0, ...over,
});

const result = (scorePct: number, over: Partial<ExerciseResult> = {}): ExerciseResult => ({
  lessonId: 'l-ear', exerciseType: 'chord-ear', promptCount: 5,
  correctCount: Math.round(scorePct * 5), scorePct, details: [], ...over,
});

const emptyGate = {
  tierGates: [] as TierGate[],
  assessments: [] as Assessment[],
  lessonProgressById: new Map(),
  chartMasteryById: new Map(),
};

function baseInput(over: Partial<RecordLessonInput> = {}): RecordLessonInput {
  return {
    lesson: lesson(),
    module: moduleFx(),
    result: result(1),
    playerState: initialPlayerState(),
    skillProgressById: new Map(),
    lessonProgressById: new Map(),
    gate: emptyGate,
    allSkills: [skill('skill-a')],
    allSongs: [song('boss')],
    nowMs: NOW,
    todayISO: '2026-07-22',
    rand: 1,
    ...over,
  };
}

describe('recordLessonAttempt — exercise lessons', () => {
  it('routes ear-lesson XP to the Head track and opens only the Head lock', () => {
    const out = recordLessonAttempt(baseInput());
    expect(out.reward.track).toBe('head');
    expect(out.reward.passed).toBe(true);
    expect(out.reward.xp).toBeGreaterThan(0);
    expect(out.playerState.headTrackXP).toBe(out.reward.xp);
    expect(out.playerState.totalXP).toBe(0);
    expect(out.playerState.tierHandsXP).toBe(0);
    const changed = out.changedSkills[0];
    expect(changed.headLock).toBeGreaterThan(0);
    expect(changed.handsLock).toBe(0);
    expect(out.reward.newlyUnlockedSongIds).toEqual([]);
  });

  it('routes keyboard-exercise XP to Hands and caps the lock below mastery', () => {
    const out = recordLessonAttempt(
      baseInput({
        lesson: lesson({ id: 'l-keys', exerciseType: 'note-id', mode: 'independent' }),
        module: moduleFx({ lessonIds: ['l-keys'] }),
        result: result(1, { lessonId: 'l-keys', exerciseType: 'note-id' }),
      }),
    );
    expect(out.reward.track).toBe('hands');
    expect(out.playerState.totalXP).toBe(out.reward.xp);
    expect(out.playerState.tierHandsXP).toBe(out.reward.xp);
    expect(out.playerState.headTrackXP).toBe(0);
    expect(out.changedSkills[0].handsLock).toBeLessThan(HANDS_THRESHOLD);
  });

  it('a failed exercise pays nothing and does not complete the lesson', () => {
    const out = recordLessonAttempt(baseInput({ result: result(0.4) }));
    expect(out.reward.passed).toBe(false);
    expect(out.reward.xp).toBe(0);
    expect(out.lessonProgress.completedAt).toBeUndefined();
    expect(out.lessonProgress.attempts).toBe(1);
  });

  it('scouting lessons record a result but touch no locks or review cards', () => {
    const out = recordLessonAttempt(
      baseInput({
        lesson: lesson({ id: 'l-boss', mode: 'scouting', stretchBoss: true, passCriteria: { minScorePct: 0 } }),
        module: moduleFx({ lessonIds: ['l-boss'] }),
        result: result(0.5, { lessonId: 'l-boss' }),
      }),
    );
    expect(out.changedSkills).toEqual([]);
    expect(out.reward.passed).toBe(true); // exploration never "fails"
  });

  it('completing the last lesson reports moduleCompleted', () => {
    const out = recordLessonAttempt(baseInput());
    expect(out.reward.moduleCompleted).toBe(true); // single-lesson module
  });
});

describe('recordLessonAttempt — chart lessons & checkpoint honesty', () => {
  const chartLesson = lesson({
    id: 'l-perf',
    exerciseType: 'play-chart',
    mode: 'performance',
    chartId: 'boss--simplified',
    passCriteria: { requiresMasteryStar: true },
  });
  const chartModule = moduleFx({ lessonIds: ['l-perf'], bossLessonId: 'l-perf' });

  it('a clean mastery take passes and flows through the chart reducer', () => {
    const out = recordLessonAttempt(
      baseInput({
        lesson: chartLesson,
        module: chartModule,
        result: undefined,
        chartOutcome: { song: song('boss'), chart: chartFx, attempt: attempt(), prevBestStars: 0 },
      }),
    );
    expect(out.reward.passed).toBe(true);
    expect(out.chart?.chartMasteryStar).toBe(true);
    expect(out.reward.chartReward?.xp).toBeGreaterThan(0);
    expect(out.songMastery?.level).toBe(1);
    expect(out.lessonResult.attemptId).toBe('a1');
  });

  it('an assisted 3★ take FAILS a performance checkpoint (no silent stripping)', () => {
    const out = recordLessonAttempt(
      baseInput({
        lesson: chartLesson,
        module: chartModule,
        result: undefined,
        chartOutcome: {
          song: song('boss'),
          chart: chartFx,
          attempt: attempt({ masteryStar: false, assistsUsed: ['falling-notes'] }),
          prevBestStars: 0,
        },
      }),
    );
    expect(out.reward.passed).toBe(false);
    expect(out.lessonProgress.completedAt).toBeUndefined();
    // The attempt itself still recorded normally.
    expect(out.chart?.attempt.stars).toBe(3);
    expect(out.chart?.chartMasteryStar).toBe(false);
  });

  it('a slowed take fails a performance checkpoint even un-assisted', () => {
    const out = recordLessonAttempt(
      baseInput({
        lesson: chartLesson,
        module: chartModule,
        result: undefined,
        chartOutcome: {
          song: song('boss'),
          chart: chartFx,
          attempt: attempt({ masteryStar: false, atTempo: false, tempoBPM: 72 }),
          prevBestStars: 0,
        },
      }),
    );
    expect(out.reward.passed).toBe(false);
  });
});

describe('recordLessonAttempt — tier gate advancement', () => {
  it('the gate opens through the reducer only when all evidence lands', () => {
    const gate: TierGate = {
      tier: 1,
      coreSkillIds: ['skill-a'],
      bossSongId: 'boss',
      bossChartId: 'boss--simplified',
      checkpointAssessmentIds: ['assess-1'],
      requiresDelayedReview: false,
      // Tiny band: the quiz already collapsed the boss take's freshness
      // multiplier, AND full-chart XP toward the band is capped at 50% of it
      // (per-song anti-grind) — both economies working as designed.
      handsXpBand: 1,
    };
    const assessments: Assessment[] = [
      { id: 'assess-1', scope: 'tier', tier: 1, lessonId: 'l-quiz', passScorePct: 0.8, remediationLessonIds: [] },
    ];
    const quizLesson = lesson({
      id: 'l-quiz', exerciseType: 'theory-quiz', mode: 'independent', theoryConceptId: 'c',
    });
    const perfLesson = lesson({
      id: 'l-perf', exerciseType: 'play-chart', mode: 'performance',
      chartId: 'boss--simplified', passCriteria: { requiresMasteryStar: true },
    });
    const bothModule = moduleFx({ lessonIds: ['l-quiz', 'l-perf'] });

    // 1) Pass the theory checkpoint — gate still closed (no boss, no skill).
    const afterQuiz = recordLessonAttempt(
      baseInput({
        lesson: quizLesson,
        module: bothModule,
        result: result(0.9, { lessonId: 'l-quiz', exerciseType: 'theory-quiz' }),
        gate: { ...emptyGate, tierGates: [gate], assessments },
      }),
    );
    expect(afterQuiz.reward.tierAdvanced).toBe(false);
    expect(afterQuiz.playerState.learningTier).toBe(1);

    // 2) Mastery take on the boss — Hands-masters skill-a, boss evidence,
    //    XP band filled, checkpoint already passed → the gate opens.
    const afterBoss = recordLessonAttempt(
      baseInput({
        lesson: perfLesson,
        module: bothModule,
        result: undefined,
        chartOutcome: { song: song('boss'), chart: chartFx, attempt: attempt(), prevBestStars: 0 },
        playerState: afterQuiz.playerState,
        skillProgressById: new Map(afterQuiz.changedSkills.map((s) => [s.skillId, s])),
        lessonProgressById: new Map([[quizLesson.id, afterQuiz.lessonProgress]]),
        gate: { ...emptyGate, tierGates: [gate], assessments },
      }),
    );
    expect(afterBoss.reward.tierAdvanced).toBe(true);
    expect(afterBoss.playerState.learningTier).toBe(2);
    expect(afterBoss.playerState.playerLevel).toBe(2);
    expect(afterBoss.playerState.tierHandsXP).toBe(0); // meter resets
    expect(afterBoss.playerState.tierGatePassedAt[1]).toBe(NOW);
  });
});
