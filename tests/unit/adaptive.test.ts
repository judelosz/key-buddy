import { describe, it, expect } from 'vitest';
import type { CurriculumLesson } from '@/core/curriculum/types';
import {
  REMEDIATION_FAIL_STREAK,
  TEMPO_FLOOR,
  adaptAfterResult,
  generatorOverridesFor,
  initialAdaptation,
  policyOverrideFor,
  stepDownFor,
} from '@/core/adaptive/adaptive';

const NOW = 1_753_000_000_000;

const lesson = (over: Partial<CurriculumLesson> = {}): CurriculumLesson => ({
  id: 'l1', moduleId: 'm1', order: 0, title: 'L', mode: 'supported',
  exerciseType: 'play-chart', skillIds: [], prompt: '', successRule: '',
  passCriteria: {}, assistOptions: [], chartId: 'c1', ...over,
});

describe('adaptAfterResult — the §5.6 matrix', () => {
  const start = initialAdaptation('c1', lesson(), NOW); // supported: 0.75, assist 1

  it('below 70% steps tempo down first, one dimension at a time', () => {
    const { next, directive } = adaptAfterResult(start, { scorePct: 0.5, passed: false }, NOW);
    expect(next.tempoPct).toBeCloseTo(0.65);
    expect(next.assistLevel).toBe(1); // untouched — one dimension only
    expect(directive?.tempoPct).toBeCloseTo(0.65);
    expect(directive?.message).toBeTruthy();
  });

  it('at the tempo floor, the next step down is assists — then remediation only', () => {
    let s = { ...start, tempoPct: TEMPO_FLOOR, assistLevel: 1 as const };
    const first = adaptAfterResult(s, { scorePct: 0.4, passed: false }, NOW);
    expect(first.next.assistLevel).toBe(2);
    expect(first.directive?.assists).toBe('on');

    const maxed = adaptAfterResult(
      { ...first.next, failStreak: 1 },
      { scorePct: 0.4, passed: false },
      NOW,
    );
    expect(maxed.directive).toBeUndefined(); // nothing left to lower
    expect(maxed.recommendRemediation).toBe(true);
  });

  it('70–85% repeats with one small variation', () => {
    const { next, directive } = adaptAfterResult(start, { scorePct: 0.78, passed: true }, NOW);
    expect(next.variationIdx).toBe(1);
    expect(next.tempoPct).toBe(start.tempoPct);
    expect(directive?.variationIdx).toBe(1);
  });

  it('steps up only after TWO ≥85% results, tempo before assists', () => {
    const one = adaptAfterResult(start, { scorePct: 0.9, passed: true }, NOW);
    expect(one.directive).toBeUndefined(); // first success: hold
    const two = adaptAfterResult(one.next, { scorePct: 0.92, passed: true }, NOW);
    expect(two.next.tempoPct).toBeCloseTo(0.8);
    expect(two.directive?.tempoPct).toBeCloseTo(0.8);

    // At full tempo, the step-up removes an assist instead.
    const atTempo = { ...start, tempoPct: 1, successesAtSetting: 1 };
    const assistOff = adaptAfterResult(atTempo, { scorePct: 0.95, passed: true }, NOW);
    expect(assistOff.next.assistLevel).toBe(0);
    expect(assistOff.directive?.assists).toBe('off');
  });

  it('a fail streak of 2 recommends remediation, and a 3★-at-tempo offers the checkpoint', () => {
    const fail1 = adaptAfterResult(start, { scorePct: 0.3, passed: false }, NOW);
    const fail2 = adaptAfterResult(fail1.next, { scorePct: 0.3, passed: false }, NOW);
    expect(fail2.next.failStreak).toBe(REMEDIATION_FAIL_STREAK);
    expect(fail2.recommendRemediation).toBe(true);

    const clean = adaptAfterResult(start, { scorePct: 1, passed: true, stars: 3, atTempo: true }, NOW);
    expect(clean.offerCheckpoint).toBe(true);
  });
});

describe('checkpoints are untouchable', () => {
  it('policy/generator overrides return undefined for independent and performance', () => {
    const adapt = { ...initialAdaptation('c1', null, NOW), tempoPct: 0.6, assistLevel: 2 as const };
    expect(policyOverrideFor(lesson({ mode: 'independent' }), adapt)).toBeUndefined();
    expect(policyOverrideFor(lesson({ mode: 'performance' }), adapt)).toBeUndefined();
    expect(
      generatorOverridesFor(
        lesson({ mode: 'performance', exerciseType: 'rhythm-tap', generatorParams: { bpm: 80 } }),
        adapt,
      ),
    ).toBeUndefined();
  });

  it('a checkpoint step-down offer is labeled as a practice run', () => {
    const adapt = initialAdaptation('c1', lesson({ mode: 'performance' }), NOW);
    const offer = stepDownFor(
      lesson({ mode: 'performance' }),
      adapt,
      { scorePct: 0.5, passed: false },
      NOW,
    );
    expect(offer?.practiceOnly).toBe(true);
    expect(offer?.label).toContain('practice run');
  });
});

describe('override mapping', () => {
  it('maps adaptation onto chart-player knobs for supported lessons', () => {
    const adapt = { ...initialAdaptation('c1', lesson(), NOW), tempoPct: 0.65, assistLevel: 1 as const };
    expect(policyOverrideFor(lesson(), adapt)).toEqual({ tempoPct: 0.65, fallingNotes: 'on' });
  });

  it('scales rhythm-tap bpm by the working tempo', () => {
    const adapt = { ...initialAdaptation('l1', null, NOW), tempoPct: 0.75 };
    const overrides = generatorOverridesFor(
      lesson({ exerciseType: 'rhythm-tap', generatorParams: { bpm: 80, beats: [0, 1] } }),
      adapt,
    );
    expect(overrides).toEqual({ bpm: 60 });
  });

  it('no offer when the lesson passed', () => {
    const adapt = initialAdaptation('c1', lesson(), NOW);
    expect(stepDownFor(lesson(), adapt, { scorePct: 0.9, passed: true }, NOW)).toBeNull();
  });
});
