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
