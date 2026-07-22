import { describe, it, expect } from 'vitest';
import type { NotePlayed } from '@/core/types';
import type { CurriculumLesson, TheoryConcept } from '@/core/curriculum/types';
import { generateExercise } from '@/core/exercise/generators';
import { ExerciseEngine } from '@/core/exercise/engine';
import type { ExerciseSpec } from '@/core/exercise/types';

/** Deterministic LCG so sampling is reproducible. */
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
  exerciseType: 'note-id',
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

// ─── Generators ──────────────────────────────────────────────────────────────

describe('generateExercise', () => {
  it('note-id covers the pool before repeating and respects count', () => {
    const spec = generateExercise(
      lesson({ generatorParams: { noteNames: ['C', 'D', 'E'], count: 5 } }),
      { tier: 1 },
      seededRand(),
    );
    expect(spec.prompts).toHaveLength(5);
    const firstThree = spec.prompts.slice(0, 3).map((p) => p.expected);
    const classes = firstThree.map((e) => (e.kind === 'pitch' ? e.pitchClass : -1)).sort();
    expect(classes).toEqual([0, 2, 4]); // C, D, E each exactly once first
  });

  it('build-chord expects the right pitch-class sets', () => {
    const spec = generateExercise(
      lesson({ exerciseType: 'build-chord', generatorParams: { chords: ['C', 'G7'], count: 2 } }),
      { tier: 4 },
      seededRand(),
    );
    const sets = spec.prompts.map((p) =>
      p.expected.kind === 'pitch-set' ? [...p.expected.pitchClasses].sort((a, b) => a - b) : [],
    );
    expect(sets).toContainEqual([0, 4, 7]); // C major
    expect(sets).toContainEqual([2, 5, 7, 11]); // G7 = G B D F
  });

  it('chord-ear prompts carry audio and a consistent answer', () => {
    const spec = generateExercise(
      lesson({
        exerciseType: 'chord-ear',
        generatorParams: { qualities: ['major', 'minor'], count: 4 },
      }),
      { tier: 4 },
      seededRand(),
    );
    for (const p of spec.prompts) {
      expect(p.audio?.[0]?.pitches.length).toBeGreaterThanOrEqual(3);
      expect(p.choices).toEqual(['Major', 'Minor']);
      expect(p.expected.kind).toBe('choice');
    }
  });

  it('theory-quiz samples from the concept pool deterministically', () => {
    const concept: TheoryConcept = {
      id: 'c1',
      name: 'C1',
      explanation: '',
      examples: [],
      linkedSkillIds: [],
      linkedSongIds: [],
      questions: Array.from({ length: 8 }, (_, i) => ({
        id: `q${i}`,
        promptText: `Q${i}`,
        choices: ['a', 'b'],
        answerIndex: 0,
        explanation: '',
      })),
    };
    const make = () =>
      generateExercise(
        lesson({ exerciseType: 'theory-quiz', theoryConceptId: 'c1', generatorParams: { count: 4 } }),
        { tier: 1, concept },
        seededRand(7),
      );
    const a = make();
    const b = make();
    expect(a.prompts).toHaveLength(4);
    expect(a.prompts.map((p) => p.id)).toEqual(b.prompts.map((p) => p.id));
  });

  it('throws on an exercise type with no generator', () => {
    expect(() =>
      generateExercise(lesson({ exerciseType: 'play-chart' }), { tier: 1 }, seededRand()),
    ).toThrow(/No generator/);
  });
});

// ─── Engine ──────────────────────────────────────────────────────────────────

const spec = (prompts: ExerciseSpec['prompts'], tier = 1): ExerciseSpec => ({
  lessonId: 'lesson-x',
  exerciseType: 'note-id',
  tier,
  prompts,
});

describe('ExerciseEngine', () => {
  it('grades pitch prompts octave-agnostically and reports what was played', () => {
    const engine = new ExerciseEngine(
      spec([
        { id: 'p0', expected: { kind: 'pitch', pitchClass: 0 } },
        { id: 'p1', expected: { kind: 'pitch', pitchClass: 2 } },
      ]),
    );
    const r1 = engine.feed({ kind: 'note', note: note(72) }); // C5 counts as C
    expect(r1.promptResult?.correct).toBe(true);
    const r2 = engine.feed({ kind: 'note', note: note(64) }); // E4 is not D
    expect(r2.promptResult?.correct).toBe(false);
    expect(r2.promptResult?.detail).toContain('E4');
    expect(r2.done?.scorePct).toBe(0.5);
    expect(r2.done?.correctCount).toBe(1);
  });

  it('accepts a chord in any inversion and rejects a wrong tone', () => {
    const chordPrompt = {
      id: 'p0',
      expected: { kind: 'pitch-set' as const, pitchClasses: [0, 4, 7], collectWindowMs: 2000 },
    };
    // First inversion: E–G–C.
    const good = new ExerciseEngine(spec([chordPrompt]));
    good.feed({ kind: 'note', note: note(64) });
    good.feed({ kind: 'note', note: note(67) });
    const done = good.feed({ kind: 'note', note: note(72) });
    expect(done.promptResult?.correct).toBe(true);

    // C–E–G♯ is not C major.
    const bad = new ExerciseEngine(spec([chordPrompt]));
    bad.feed({ kind: 'note', note: note(60) });
    bad.feed({ kind: 'note', note: note(64) });
    const badDone = bad.feed({ kind: 'note', note: note(68) });
    expect(badDone.promptResult?.correct).toBe(false);
  });

  it('evaluates a partial chord on commit as incorrect', () => {
    const engine = new ExerciseEngine(
      spec([
        {
          id: 'p0',
          expected: { kind: 'pitch-set', pitchClasses: [0, 4, 7], collectWindowMs: 2000 },
        },
      ]),
    );
    engine.feed({ kind: 'note', note: note(60) });
    const done = engine.feed({ kind: 'commit', atMs: 3000 });
    expect(done.promptResult?.correct).toBe(false);
    expect(done.done).toBeDefined();
  });

  it('grades taps against tier windows with an anchored beat grid', () => {
    // Tier 1: perfect ±60, great ±110, good ±180. 60 BPM → beat = 1000 ms.
    const tapsPrompt = {
      id: 'p0',
      expected: {
        kind: 'taps' as const,
        beats: [0, 1, 2, 3],
        bpm: 60,
        countInBeats: 4,
        beatsPerBar: 4,
      },
    };
    const engine = new ExerciseEngine(spec([tapsPrompt], 1));
    engine.feed({ kind: 'prompt-shown', atMs: 10_000 });
    // Targets at 14000, 15000, 16000, 17000.
    engine.feed({ kind: 'note', note: note(60, 14_010) }); // perfect
    engine.feed({ kind: 'note', note: note(60, 15_100) }); // great
    engine.feed({ kind: 'note', note: note(60, 16_170) }); // good
    engine.feed({ kind: 'note', note: note(60, 17_400) }); // late (not good)
    const done = engine.feed({ kind: 'commit', atMs: 18_000 });
    expect(done.promptResult?.deviationsMs).toHaveLength(4);
    expect(done.promptResult?.scorePct).toBeCloseTo(3 / 4);
    expect(done.promptResult?.correct).toBe(true); // ≥70% good-or-better
    expect(done.done?.timingHistogram).toBeDefined();
    expect(done.done?.goodOrBetterPct).toBeCloseTo(3 / 4);
  });

  it('ignores taps before the count-in anchors the grid (launch/stray taps are free)', () => {
    const tapsPrompt = {
      id: 'p0',
      expected: {
        kind: 'taps' as const,
        beats: [0, 1],
        bpm: 60,
        countInBeats: 0,
        beatsPerBar: 4,
      },
    };
    const engine = new ExerciseEngine(spec([tapsPrompt], 1));
    // The launch tap (and any stray press) arrives before prompt-shown.
    engine.feed({ kind: 'note', note: note(60, 9_000) });
    engine.feed({ kind: 'prompt-shown', atMs: 10_000 });
    engine.feed({ kind: 'note', note: note(60, 10_010) });
    engine.feed({ kind: 'note', note: note(60, 11_020) });
    const done = engine.feed({ kind: 'commit', atMs: 12_000 });
    // 2 good ÷ 2 targets — the pre-anchor tap was not an extra.
    expect(done.promptResult?.scorePct).toBe(1);
    expect(done.promptResult?.correct).toBe(true);
  });

  it('counts missed targets and extra taps against the score', () => {
    const tapsPrompt = {
      id: 'p0',
      expected: {
        kind: 'taps' as const,
        beats: [0, 1],
        bpm: 60,
        countInBeats: 0,
        beatsPerBar: 4,
      },
    };
    const engine = new ExerciseEngine(spec([tapsPrompt], 1));
    engine.feed({ kind: 'prompt-shown', atMs: 0 });
    // One on-time tap, one wild extra (beat 1 never tapped).
    engine.feed({ kind: 'note', note: note(60, 20) });
    engine.feed({ kind: 'note', note: note(60, 2600) });
    const done = engine.feed({ kind: 'commit', atMs: 3000 });
    // 1 good ÷ (2 targets + 1 extra) = 1/3 → fail.
    expect(done.promptResult?.scorePct).toBeCloseTo(1 / 3);
    expect(done.promptResult?.correct).toBe(false);
  });

  it('choice and watch prompts complete the flow', () => {
    const engine = new ExerciseEngine(
      spec([
        { id: 'p0', choices: ['a', 'b'], expected: { kind: 'choice', answerIndex: 1 } },
        { id: 'p1', expected: { kind: 'watch' } },
      ]),
    );
    const r1 = engine.feed({ kind: 'choice', index: 1, atMs: 0 });
    expect(r1.promptResult?.correct).toBe(true);
    const r2 = engine.feed({ kind: 'watch-complete', atMs: 1 });
    expect(r2.done?.scorePct).toBe(1);
    expect(engine.currentPrompt).toBeNull();
  });

  it('ignores events that do not answer the current prompt kind', () => {
    const engine = new ExerciseEngine(
      spec([{ id: 'p0', choices: ['a'], expected: { kind: 'choice', answerIndex: 0 } }]),
    );
    expect(engine.feed({ kind: 'note', note: note(60) })).toEqual({});
    expect(engine.feed({ kind: 'watch-complete', atMs: 0 })).toEqual({});
    expect(engine.feed({ kind: 'choice', index: 0, atMs: 0 }).done).toBeDefined();
  });
});
