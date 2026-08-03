import { describe, it, expect } from 'vitest';
import type { NotePlayed } from '@/core/types';
import type { CurriculumLesson } from '@/core/curriculum/types';
import { generateExercise } from '@/core/exercise/generators';
import { ExerciseEngine } from '@/core/exercise/engine';
import type { ExercisePrompt, ExerciseSpec } from '@/core/exercise/types';

function seededRand(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

const lesson = (over: Partial<CurriculumLesson>): CurriculumLesson => ({
  id: 'lesson-x',
  moduleId: 'mod-x',
  order: 0,
  title: 'X',
  mode: 'guided',
  exerciseType: 'feel-id',
  skillIds: [],
  prompt: '',
  successRule: '',
  passCriteria: {},
  assistOptions: [],
  ...over,
});

const note = (pitch: number, timestampMs = 0): NotePlayed => ({
  pitch,
  velocity: 90,
  timestampMs,
  source: 'virtual',
});

const spec = (prompts: ExercisePrompt[], tier = 8): ExerciseSpec => ({
  lessonId: 'lesson-x',
  exerciseType: 'rhythm-tap',
  tier,
  prompts,
});

/** One bar of shuffle pairs at 60 BPM, count-in 4: on+off per beat. */
const SWUNG_TAPS: ExercisePrompt = {
  id: 'p0',
  expected: {
    kind: 'taps' as const,
    beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    bpm: 60,
    countInBeats: 4,
    beatsPerBar: 4,
    swingRatio: 2,
  },
};

/** Feed a whole take at a given long/short ratio (anchor 0, beat 1000 ms). */
function tapAtRatio(engine: ExerciseEngine, ratio: number, biasMs = 0) {
  engine.feed({ kind: 'prompt-shown', atMs: 0 });
  const split = ratio / (ratio + 1);
  for (let b = 0; b < 4; b++) {
    engine.feed({ kind: 'note', note: note(60, (4 + b) * 1000 + biasMs) });
    engine.feed({ kind: 'note', note: note(60, (4 + b + split) * 1000 + biasMs) });
  }
  return engine.feed({ kind: 'commit', atMs: 10_000 });
}

// ─── Swung tap grading ───────────────────────────────────────────────────────

describe('swung tap prompts', () => {
  it('a 2:1 tapper lands every target and measures in band', () => {
    const engine = new ExerciseEngine(spec([SWUNG_TAPS]));
    const done = tapAtRatio(engine, 2);
    expect(done.promptResult?.scorePct).toBe(1);
    expect(done.promptResult?.swing).toBeDefined();
    expect(done.promptResult!.swing!.measuredRatio).toBeCloseTo(2, 1);
    expect(done.promptResult!.swing!.inBandPct).toBe(1);
    expect(done.done?.swing?.inBandPct).toBe(1);
  });

  it('a never-swings tapper measures ~1.0, fully out of band', () => {
    // Straight offbeats are 167 ms early vs the swung target at 60 BPM —
    // inside the tap match window (they still count as taps) but the RATIO
    // metric sees straight play regardless of what the windows forgive.
    const engine = new ExerciseEngine(spec([SWUNG_TAPS]));
    const done = tapAtRatio(engine, 1);
    expect(done.promptResult?.swing).toBeDefined();
    expect(done.promptResult!.swing!.measuredRatio).toBeCloseTo(1, 1);
    expect(done.promptResult!.swing!.inBandPct).toBe(0);
  });

  it('constant device bias cancels out of the measured ratio', () => {
    const engine = new ExerciseEngine(spec([SWUNG_TAPS]));
    const done = tapAtRatio(engine, 2, 120);
    expect(done.promptResult!.swing!.measuredRatio).toBeCloseTo(2, 1);
    expect(done.promptResult!.swing!.inBandPct).toBe(1);
  });

  it('learns bias from ONBEAT taps only — flattened offbeats never earn forgiveness', () => {
    const two = new ExerciseEngine(
      spec([SWUNG_TAPS, { ...SWUNG_TAPS, id: 'p1' }]),
    );
    // Prompt 1: onbeats dead-on, offbeats played straight (167 ms early).
    tapAtRatio(two, 1);
    // Prompt 2: an exactly-on-target onbeat tap. If prompt 1's early offbeats
    // had polluted the bias (mean ≈ −83 ms), this would read ~+83 ms; the
    // onbeat-only estimate keeps it ~0.
    two.feed({ kind: 'prompt-shown', atMs: 100_000 });
    const fb = two.feed({ kind: 'note', note: note(60, 104_000) });
    expect(fb.tapFeedback?.kind).toBe('graded');
    expect(Math.abs(fb.tapFeedback?.deviationMs ?? 999)).toBeLessThan(20);
  });

  it('flags a straight-leaning offbeat tap as tooStraight', () => {
    const engine = new ExerciseEngine(spec([SWUNG_TAPS]));
    engine.feed({ kind: 'prompt-shown', atMs: 0 });
    engine.feed({ kind: 'note', note: note(60, 4_000) }); // onbeat, perfect
    // Offbeat target at 4666.7; a straight tap lands 4500 → 167 early.
    const fb = engine.feed({ kind: 'note', note: note(60, 4_500) });
    expect(fb.tapFeedback?.kind).toBe('graded');
    expect(fb.tapFeedback?.tooStraight).toBe(true);
    // A properly swung offbeat is NOT flagged.
    engine.feed({ kind: 'note', note: note(60, 5_000) });
    const good = engine.feed({ kind: 'note', note: note(60, 5_670) });
    expect(good.tapFeedback?.tooStraight).toBeUndefined();
  });

  it('straight prompts carry no swing evidence', () => {
    const straight: ExercisePrompt = {
      id: 'p0',
      expected: {
        kind: 'taps' as const,
        beats: [0, 1, 2, 3],
        bpm: 60,
        countInBeats: 4,
        beatsPerBar: 4,
      },
    };
    const engine = new ExerciseEngine(spec([straight]));
    engine.feed({ kind: 'prompt-shown', atMs: 0 });
    for (let b = 0; b < 4; b++) engine.feed({ kind: 'note', note: note(60, (4 + b) * 1000) });
    const done = engine.feed({ kind: 'commit', atMs: 10_000 });
    expect(done.promptResult?.swing).toBeUndefined();
    expect(done.done?.swing).toBeUndefined();
  });
});

// ─── Generators ──────────────────────────────────────────────────────────────

describe('rhythm-tap swingRatio param', () => {
  it('threads swingRatio into the expected answer', () => {
    const s = generateExercise(
      lesson({
        exerciseType: 'rhythm-tap',
        generatorParams: { beats: [0, 0.5, 1, 1.5], bpm: 84, swingRatio: 2 },
      }),
      { tier: 8 },
      seededRand(),
    );
    const exp = s.prompts[0].expected;
    expect(exp.kind).toBe('taps');
    if (exp.kind === 'taps') expect(exp.swingRatio).toBe(2);
  });
});

describe('feel-id generator', () => {
  it('ab variant: choice prompts with rhythm-cell audio and aligned explanations', () => {
    const s = generateExercise(
      lesson({ generatorParams: { variant: 'ab', count: 6 } }),
      { tier: 8 },
      seededRand(),
    );
    expect(s.prompts).toHaveLength(6);
    for (const p of s.prompts) {
      expect(p.expected.kind).toBe('choice');
      expect(p.choices).toHaveLength(2);
      expect(p.choiceExplanations).toHaveLength(2);
      expect(p.choiceExplanations!.every((e) => e.length > 0)).toBe(true);
      // Two cells of 8 notes each, gapless within a cell.
      expect(p.audio).toHaveLength(16);
      expect(p.audio![0].gapAfterSec).toBe(0);
      // The pause separating the two cells sits after note 8.
      expect(p.audio![7].gapAfterSec).toBeGreaterThan(0.5);
    }
    // The swung cell has lopsided eighths; the correct answer points at it.
    for (const p of s.prompts) {
      if (p.expected.kind !== 'choice') continue;
      const firstCell = p.audio!.slice(0, 8).map((c) => c.durationSec!);
      const firstIsSwung = Math.abs(firstCell[0] - firstCell[1]) > 0.01;
      expect(p.expected.answerIndex).toBe(firstIsSwung ? 0 : 1);
    }
  });

  it('dial variant: the harder-swinging cell is the answer', () => {
    const s = generateExercise(
      lesson({ generatorParams: { variant: 'dial', count: 6 } }),
      { tier: 8 },
      seededRand(7),
    );
    for (const p of s.prompts) {
      if (p.expected.kind !== 'choice') continue;
      const cellRatio = (cell: { durationSec?: number }[]) =>
        cell[0].durationSec! / cell[1].durationSec!;
      const first = cellRatio(p.audio!.slice(0, 8));
      const second = cellRatio(p.audio!.slice(8));
      expect(first).not.toBeCloseTo(second, 2);
      expect(p.expected.answerIndex).toBe(first > second ? 0 : 1);
    }
  });
});
