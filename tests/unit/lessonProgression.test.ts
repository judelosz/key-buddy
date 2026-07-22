import { describe, it, expect } from 'vitest';
import type { SkillProgress } from '@/core/types';
import {
  EXERCISE_HANDS_CAP,
  HANDS_THRESHOLD,
  applyExerciseAttempt,
  applyHeadAttempt,
  computePlayingTier,
  exerciseHandsContribution,
  headContribution,
  isHandsMastered,
  trackForExerciseType,
} from '@/core/progression/progressionService';
import { newCard, scoreToRating } from '@/core/srs/fsrs';
import { Rating } from 'ts-fsrs';
import {
  DUE_REVIEW_XP,
  awardHeadXp,
  repeatFactor,
  xpForLessonResult,
} from '@/core/rewards/lessonXp';
import type { CurriculumLesson } from '@/core/curriculum/types';
import { initialPlayerState } from '@/data/repository';
import { initialSongMastery, updateSongMastery } from '@/core/songMastery/songMastery';
import type { Attempt } from '@/core/types';

const NOW = 1_753_000_000_000;

const progress = (over: Partial<SkillProgress> = {}): SkillProgress => ({
  skillId: 'skill-a',
  headLock: 0,
  handsLock: 0,
  freshness: newCard(NOW),
  ...over,
});

const lesson = (over: Partial<CurriculumLesson> = {}): CurriculumLesson => ({
  id: 'l1',
  moduleId: 'm1',
  order: 0,
  title: 'L1',
  mode: 'supported',
  exerciseType: 'note-id',
  skillIds: ['skill-a'],
  prompt: '',
  successRule: '',
  passCriteria: {},
  assistOptions: [],
  ...over,
});

describe('track routing', () => {
  it('keyboard exercises are Hands; ear/theory/listen are Head', () => {
    expect(trackForExerciseType('play-chart')).toBe('hands');
    expect(trackForExerciseType('fragment')).toBe('hands');
    expect(trackForExerciseType('note-id')).toBe('hands');
    expect(trackForExerciseType('build-chord')).toBe('hands');
    expect(trackForExerciseType('rhythm-tap')).toBe('hands');
    expect(trackForExerciseType('chord-ear')).toBe('head');
    expect(trackForExerciseType('theory-quiz')).toBe('head');
    expect(trackForExerciseType('listen')).toBe('head');
    expect(trackForExerciseType('interval-ear')).toBe('head');
  });
});

describe('applyHeadAttempt', () => {
  it('touches only the Head lock and never regresses', () => {
    const p1 = applyHeadAttempt(progress(), 0.9, NOW);
    expect(p1.headLock).toBeCloseTo(0.85);
    expect(p1.handsLock).toBe(0);
    const p2 = applyHeadAttempt(p1, 0.4, NOW);
    expect(p2.headLock).toBeCloseTo(0.85); // max-merge
  });

  it('perfect head work masters the Head lock but never the Hands lock', () => {
    const p = applyHeadAttempt(progress(), 1, NOW);
    expect(p.headLock).toBe(1);
    expect(isHandsMastered(p)).toBe(false);
    expect(p.masteredAt).toBeUndefined(); // gold needs both locks
  });

  it('head contribution is monotone in score', () => {
    const scores = [0.2, 0.5, 0.7, 0.85, 0.95];
    const contributions = scores.map(headContribution);
    for (let i = 1; i < contributions.length; i++) {
      expect(contributions[i]).toBeGreaterThan(contributions[i - 1]);
    }
  });
});

describe('applyExerciseAttempt — the exercise cap guardrail', () => {
  it('a perfect independent exercise stays below HANDS_THRESHOLD', () => {
    const p = applyExerciseAttempt(progress(), 1, 'independent', NOW);
    expect(p.handsLock).toBe(EXERCISE_HANDS_CAP);
    expect(p.handsLock).toBeLessThan(HANDS_THRESHOLD);
    expect(isHandsMastered(p)).toBe(false);
  });

  it('guided and supported exercises contribute even less', () => {
    expect(exerciseHandsContribution(1, 'guided')).toBeCloseTo(0.4);
    expect(exerciseHandsContribution(1, 'supported')).toBeCloseTo(0.6);
  });

  it('scouting and woodshed exercises contribute nothing to Hands', () => {
    expect(exerciseHandsContribution(1, 'scouting')).toBe(0);
    expect(exerciseHandsContribution(1, 'woodshed')).toBe(0);
  });

  it('no amount of exercise grinding can raise the playing tier', () => {
    const skills = [
      { id: 'skill-a', name: '', family: 'geography-mechanics' as const, tier: 5, genre: 'foundation' as const, prerequisites: [], description: '' },
    ];
    let p = progress();
    for (let i = 0; i < 100; i++) p = applyExerciseAttempt(p, 1, 'independent', NOW);
    expect(computePlayingTier(skills, new Map([['skill-a', p]]))).toBe(1);
  });
});

describe('scoreToRating', () => {
  it('maps score bands to FSRS grades', () => {
    expect(scoreToRating(1)).toBe(Rating.Easy);
    expect(scoreToRating(0.85)).toBe(Rating.Good);
    expect(scoreToRating(0.7)).toBe(Rating.Hard);
    expect(scoreToRating(0.3)).toBe(Rating.Again);
  });
});

describe('lesson XP', () => {
  const ctx = {
    passed: true,
    scorePct: 1,
    firstCompletion: true,
    attemptsTodayBefore: 0,
    wasDue: false,
    freshness: [],
    tier: 1,
    nowMs: NOW,
  };

  it('pays nothing for a failed lesson', () => {
    expect(xpForLessonResult(lesson(), { ...ctx, passed: false }).xp).toBe(0);
  });

  it('guided lessons pay only on first completion', () => {
    const guided = lesson({ mode: 'guided' });
    expect(xpForLessonResult(guided, ctx).xp).toBeGreaterThan(0);
    expect(xpForLessonResult(guided, { ...ctx, firstCompletion: false }).xp).toBe(0);
  });

  it('same-day repeats decay to zero', () => {
    expect(repeatFactor(0)).toBe(1);
    expect(repeatFactor(1)).toBeCloseTo(0.3);
    expect(repeatFactor(2)).toBeCloseTo(0.1);
    expect(repeatFactor(3)).toBe(0);
    expect(xpForLessonResult(lesson(), { ...ctx, attemptsTodayBefore: 5 }).xp).toBe(0);
  });

  it('checkpoint modes pay more than guided; due review boosts small bases', () => {
    const guided = xpForLessonResult(lesson({ mode: 'guided' }), ctx).xp;
    const independent = xpForLessonResult(lesson({ mode: 'independent' }), ctx).xp;
    const performance = xpForLessonResult(lesson({ mode: 'performance' }), ctx).xp;
    expect(independent).toBeGreaterThan(guided);
    expect(performance).toBeGreaterThan(independent);

    const dueGuided = xpForLessonResult(lesson({ mode: 'guided' }), { ...ctx, wasDue: true }).xp;
    expect(dueGuided).toBeGreaterThanOrEqual(DUE_REVIEW_XP * 0.75); // performance-scaled
  });

  it('routes XP by exercise type, and head XP never touches the hands track', () => {
    const ear = xpForLessonResult(lesson({ exerciseType: 'chord-ear' }), ctx);
    expect(ear.track).toBe('head');
    const state = initialPlayerState();
    const after = awardHeadXp(state, ear.xp);
    expect(after.headTrackXP).toBe(ear.xp);
    expect(after.totalXP).toBe(0);
    expect(after.tierHandsXP).toBe(0);
    expect(after.playerLevel).toBe(1);
    expect(after.learningTier).toBe(1);
  });
});

describe('song mastery foundation', () => {
  const attempt = (over: Partial<Attempt> = {}): Attempt => ({
    id: 'a1',
    refId: 'chart-1',
    refKind: 'chart',
    timestamp: NOW,
    perNoteGrades: [],
    timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
    wrongNotes: [],
    extraNotes: 0,
    notesCorrectPct: 1,
    goodOrBetterPct: 1,
    greatOrBetterPct: 1,
    stars: 3,
    masteryStar: false,
    atTempo: true,
    tempoBPM: 96,
    assistsUsed: [],
    xpAwarded: 0,
    riffsAwarded: 0,
    ...over,
  });

  it('starts at Discovered and moves to Started on the first attempt', () => {
    const m0 = initialSongMastery('song-1');
    expect(m0.level).toBe(0);
    const m1 = updateSongMastery(m0, {
      kind: 'chart-attempt',
      attempt: attempt(),
      todayISO: '2026-07-22',
    });
    expect(m1.level).toBe(1);
    expect(m1.lastAttemptId).toBe('a1');
  });

  it('accumulates qualifying dates only for mastery-star takes, one per day', () => {
    let m = initialSongMastery('song-1');
    m = updateSongMastery(m, { kind: 'chart-attempt', attempt: attempt(), todayISO: '2026-07-22' });
    expect(m.qualifyingSessionDates).toEqual([]);
    m = updateSongMastery(m, {
      kind: 'chart-attempt',
      attempt: attempt({ id: 'a2', masteryStar: true }),
      todayISO: '2026-07-22',
    });
    m = updateSongMastery(m, {
      kind: 'chart-attempt',
      attempt: attempt({ id: 'a3', masteryStar: true }),
      todayISO: '2026-07-22',
    });
    expect(m.qualifyingSessionDates).toEqual(['2026-07-22']);
    m = updateSongMastery(m, {
      kind: 'chart-attempt',
      attempt: attempt({ id: 'a4', masteryStar: true }),
      todayISO: '2026-07-23',
    });
    expect(m.qualifyingSessionDates).toEqual(['2026-07-22', '2026-07-23']);
    // Level never advances past Started in Phase 4 (sections arrive Phase 5).
    expect(m.level).toBe(1);
  });
});
