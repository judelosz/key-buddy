import { describe, it, expect } from 'vitest';
import type { SkillProgress } from '@/core/types';
import type { Assessment, LessonProgress, TierGate } from '@/core/curriculum/types';
import { evaluateTierGate, gateRequirementsRemaining } from '@/core/curriculum/tierGate';
import { newCard } from '@/core/srs/fsrs';

const NOW = 1_753_000_000_000;

const gate: TierGate = {
  tier: 1,
  coreSkillIds: ['skill-a', 'skill-b'],
  bossSongId: 'boss',
  bossChartId: 'boss--simplified',
  checkpointAssessmentIds: ['assess-1'],
  requiresDelayedReview: true,
  handsXpBand: 100,
};

const assessments: Assessment[] = [
  {
    id: 'assess-1',
    scope: 'tier',
    tier: 1,
    lessonId: 'lesson-quiz',
    passScorePct: 0.8,
    remediationLessonIds: [],
  },
];

const progress = (over: Partial<SkillProgress>): SkillProgress => ({
  skillId: 'x',
  headLock: 0,
  handsLock: 0,
  freshness: newCard(NOW),
  ...over,
});

const mastered = (skillId: string, extra: Partial<SkillProgress> = {}) =>
  progress({ skillId, handsLock: 1, ...extra });

const quizProgress = (bestScorePct: number): Map<string, LessonProgress> =>
  new Map([
    [
      'lesson-quiz',
      { lessonId: 'lesson-quiz', bestScorePct, attempts: 1, attemptsOnLastDate: 1 },
    ],
  ]);

/** Everything satisfied — the baseline the anti-grind matrix mutates. */
function allMet() {
  return {
    skills: new Map([
      ['skill-a', mastered('skill-a', { delayedReviewPassedAt: NOW })],
      ['skill-b', mastered('skill-b')],
    ]),
    lessons: quizProgress(0.9),
    bossMastery: true,
    tierXp: 150,
  };
}

describe('evaluateTierGate — anti-grind matrix', () => {
  it('opens only when every condition holds', () => {
    const s = allMet();
    const status = evaluateTierGate(gate, assessments, s.skills, s.lessons, s.bossMastery, s.tierXp);
    expect(status.passed).toBe(true);
    expect(gateRequirementsRemaining(status)).toEqual([]);
  });

  it('max XP + all lessons repeated but no boss mastery star → closed', () => {
    const s = allMet();
    const status = evaluateTierGate(gate, assessments, s.skills, s.lessons, false, 999_999);
    expect(status.passed).toBe(false);
    expect(gateRequirementsRemaining(status)).toContain(
      'Earn the mastery star on the tier boss song',
    );
  });

  it('checkpoint at 79% → closed; at 80% → open', () => {
    const s = allMet();
    const failing = evaluateTierGate(gate, assessments, s.skills, quizProgress(0.79), true, s.tierXp);
    expect(failing.passed).toBe(false);
    expect(failing.checkpoints[0].passed).toBe(false);
    const passing = evaluateTierGate(gate, assessments, s.skills, quizProgress(0.8), true, s.tierXp);
    expect(passing.passed).toBe(true);
  });

  it('everything but the delayed review → closed', () => {
    const s = allMet();
    const noDelayed = new Map([
      ['skill-a', mastered('skill-a')],
      ['skill-b', mastered('skill-b')],
    ]);
    const status = evaluateTierGate(gate, assessments, noDelayed, s.lessons, true, s.tierXp);
    expect(status.passed).toBe(false);
    expect(status.delayedReviewPassed).toBe(false);
  });

  it('a gate that does not require delayed review skips that condition', () => {
    const s = allMet();
    const noDelayed = new Map([
      ['skill-a', mastered('skill-a')],
      ['skill-b', mastered('skill-b')],
    ]);
    const relaxed = { ...gate, requiresDelayedReview: false };
    expect(
      evaluateTierGate(relaxed, assessments, noDelayed, s.lessons, true, s.tierXp).passed,
    ).toBe(true);
  });

  it('one unmastered core skill → closed, and the checklist names the count', () => {
    const s = allMet();
    const partial = new Map([
      ['skill-a', mastered('skill-a', { delayedReviewPassedAt: NOW })],
      ['skill-b', progress({ skillId: 'skill-b', handsLock: 0.8 })], // exercise-capped
    ]);
    const status = evaluateTierGate(gate, assessments, partial, s.lessons, true, s.tierXp);
    expect(status.passed).toBe(false);
    expect(gateRequirementsRemaining(status)).toContain('Master 1 core skill with your hands');
  });

  it('below the XP band → closed even with all mastery evidence', () => {
    const s = allMet();
    const status = evaluateTierGate(gate, assessments, s.skills, s.lessons, true, 99);
    expect(status.passed).toBe(false);
    expect(status.handsXp.reached).toBe(false);
  });

  it('a skill demanding repeatedSessions needs distinct evidence dates, not just the lock', () => {
    const s = allMet();
    const skillById = new Map([
      [
        'skill-a',
        {
          id: 'skill-a', name: '', family: 'geography-mechanics' as const, tier: 1,
          genre: 'foundation' as const, prerequisites: [], description: '',
          assessment: {
            minStars: 3 as const, minNotesCorrectPct: 0.9, minGoodOrBetterPct: 0.75,
            requiresAtTempo: true, requiresNoAssists: true, repeatedSessions: 2,
          },
        },
      ],
    ]);
    // Lock is maxed but only one evidence date exists → not mastered for the gate.
    const oneDay = new Map(s.skills);
    oneDay.set('skill-a', {
      ...mastered('skill-a', { delayedReviewPassedAt: NOW }),
      handsEvidenceDates: ['2026-07-22'],
    });
    const blocked = evaluateTierGate(gate, assessments, oneDay, s.lessons, true, s.tierXp, skillById);
    expect(blocked.coreSkills.find((c) => c.skillId === 'skill-a')?.mastered).toBe(false);

    const twoDays = new Map(oneDay);
    twoDays.set('skill-a', {
      ...mastered('skill-a', { delayedReviewPassedAt: NOW }),
      handsEvidenceDates: ['2026-07-21', '2026-07-22'],
    });
    const open = evaluateTierGate(gate, assessments, twoDays, s.lessons, true, s.tierXp, skillById);
    expect(open.coreSkills.find((c) => c.skillId === 'skill-a')?.mastered).toBe(true);
  });

  it('a momentum-schedule gate waives ALL spaced evidence (Tiers 1–3, 2026-07-28)', () => {
    // requiresDelayedReview:false governs both spaced requirements: the
    // delayed review AND repeatedSessions distinct-day enforcement — the
    // early game is completable in one sitting.
    const s = allMet();
    const skillById = new Map([
      [
        'skill-a',
        {
          id: 'skill-a', name: '', family: 'geography-mechanics' as const, tier: 1,
          genre: 'foundation' as const, prerequisites: [], description: '',
          assessment: {
            minStars: 3 as const, minNotesCorrectPct: 0.9, minGoodOrBetterPct: 0.75,
            requiresAtTempo: true, requiresNoAssists: true, repeatedSessions: 2,
          },
        },
      ],
    ]);
    const momentum = { ...gate, requiresDelayedReview: false };
    // One evidence day, NO delayed review anywhere — still opens.
    const oneDay = new Map(s.skills);
    oneDay.set('skill-a', { ...mastered('skill-a'), handsEvidenceDates: ['2026-07-28'] });
    const status = evaluateTierGate(
      momentum, assessments, oneDay, s.lessons, true, s.tierXp, skillById,
    );
    expect(status.delayedReviewRequired).toBe(false);
    expect(status.passed).toBe(true);
  });

  it('HEAD-ONLY evidence can never open a gate (guardrail #1 refinement)', () => {
    // Perfect theory/ear evidence everywhere, zero Hands mastery, no boss.
    const headOnly = new Map([
      ['skill-a', progress({ skillId: 'skill-a', headLock: 1 })],
      ['skill-b', progress({ skillId: 'skill-b', headLock: 1 })],
    ]);
    const status = evaluateTierGate(gate, assessments, headOnly, quizProgress(1), false, 0);
    expect(status.passed).toBe(false);
    expect(status.coreSkills.every((c) => !c.mastered)).toBe(true);
  });
});
