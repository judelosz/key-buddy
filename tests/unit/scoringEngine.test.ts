import { describe, it, expect } from 'vitest';
import { scoreAttempt, type ScoreParams } from '@/core/scoring/scoringEngine';
import { windowsForTier, matchWindowMs } from '@/core/scoring/timingWindows';
import type { Chart, NoteEvent, NotePlayed } from '@/core/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function note(id: string, pitches: number[], startBeat: number): NoteEvent {
  return { id, pitches, startBeat, durationBeats: 1, hand: 'right' };
}

function chartOf(notes: NoteEvent[]): Chart {
  return {
    id: 'test-chart',
    songId: 'test-song',
    arrangementLevel: 'simplified',
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    chordSymbols: [],
    notes,
  };
}

function play(pitch: number, timestampMs: number): NotePlayed {
  return { pitch, velocity: 80, timestampMs, source: 'virtual' };
}

// A 4-note C-major fragment on beats 0..3. At 60 BPM, 1 beat = 1000 ms.
const FOUR_NOTES = chartOf([
  note('n0', [60], 0),
  note('n1', [62], 1),
  note('n2', [64], 2),
  note('n3', [65], 3),
]);

const base = (over: Partial<ScoreParams>): ScoreParams => ({
  chart: FOUR_NOTES,
  played: [],
  tempoBPM: 60,
  targetTempoBPM: 60,
  tier: 1,
  startTimeMs: 0,
  attemptId: 'fixed',
  ...over,
});

// ─── timing windows ─────────────────────────────────────────────────────────

describe('windowsForTier', () => {
  it('uses beginner windows at tier 1 and advanced at tier 30', () => {
    expect(windowsForTier(1)).toEqual({ perfect: 60, great: 110, good: 180 });
    expect(windowsForTier(30)).toEqual({ perfect: 25, great: 55, good: 100 });
  });

  it('tightens monotonically as tier rises', () => {
    expect(windowsForTier(15).perfect).toBeLessThan(windowsForTier(1).perfect);
    expect(windowsForTier(15).perfect).toBeGreaterThan(windowsForTier(30).perfect);
  });

  it('clamps out-of-range tiers', () => {
    expect(windowsForTier(0)).toEqual(windowsForTier(1));
    expect(windowsForTier(99)).toEqual(windowsForTier(30));
  });

  it('caps the match window near one beat', () => {
    expect(matchWindowMs({ perfect: 60, great: 110, good: 180 }, 1000)).toBe(540);
    expect(matchWindowMs({ perfect: 60, great: 110, good: 180 }, 300)).toBe(300);
  });
});

// ─── exact hits ─────────────────────────────────────────────────────────────

describe('exact hits', () => {
  const played = [play(60, 0), play(62, 1000), play(64, 2000), play(65, 3000)];
  const attempt = scoreAttempt(base({ played }));

  it('grades every note perfect', () => {
    expect(attempt.perNoteGrades.every((g) => g.grade === 'perfect')).toBe(true);
  });

  it('is 100% correct with zero-deviation histogram', () => {
    expect(attempt.notesCorrectPct).toBe(1);
    expect(attempt.timingHistogram.meanMs).toBe(0);
  });

  it('awards 3 stars and the mastery star at target tempo, un-assisted', () => {
    expect(attempt.stars).toBe(3);
    expect(attempt.atTempo).toBe(true);
    expect(attempt.masteryStar).toBe(true);
  });

  it('leaves XP/Riffs to the RewardService', () => {
    expect(attempt.xpAwarded).toBe(0);
    expect(attempt.riffsAwarded).toBe(0);
  });
});

// ─── grade boundaries ───────────────────────────────────────────────────────

describe('timing grade boundaries (tier 1: P±60 G±110 Good±180)', () => {
  const gradeOf = (devMs: number) => {
    const played = [play(60, 0 + devMs), play(62, 1000), play(64, 2000), play(65, 3000)];
    return scoreAttempt(base({ played })).perNoteGrades[0].grade;
  };

  it('perfect within ±60ms', () => expect(gradeOf(55)).toBe('perfect'));
  it('great between 60 and 110ms', () => expect(gradeOf(100)).toBe('great'));
  it('good between 110 and 180ms', () => expect(gradeOf(150)).toBe('good'));
  it('late beyond good window on the late side', () => expect(gradeOf(300)).toBe('late'));
  it('early beyond good window on the early side', () => expect(gradeOf(-300)).toBe('early'));
  it('miss beyond the match window', () => expect(gradeOf(700)).toBe('miss'));
});

// ─── directional early/late ─────────────────────────────────────────────────

describe('rush vs drag summary', () => {
  it('reports negative mean when consistently early (rushing)', () => {
    const played = [play(60, -40), play(62, 960), play(64, 1960), play(65, 2960)];
    const a = scoreAttempt(base({ played }));
    expect(a.timingHistogram.meanMs).toBeLessThan(0);
  });

  it('reports positive mean when consistently late (dragging)', () => {
    const played = [play(60, 40), play(62, 1040), play(64, 2040), play(65, 3040)];
    const a = scoreAttempt(base({ played }));
    expect(a.timingHistogram.meanMs).toBeGreaterThan(0);
  });
});

// ─── wrong notes & misses ───────────────────────────────────────────────────

describe('wrong note', () => {
  it('marks a wrong pitch as a miss AND counts it as an extra note', () => {
    // Plays 99 instead of 60: the 60 event misses, and 99 is a wrong note.
    const played = [play(99, 0), play(62, 1000), play(64, 2000), play(65, 3000)];
    const a = scoreAttempt(base({ played }));
    expect(a.perNoteGrades[0].grade).toBe('miss');
    expect(a.perNoteGrades[0].pitchCorrect).toBe(false);
    expect(a.extraNotes).toBe(1);
    // 3 correct ÷ (4 expected + 1 wrong) = 0.6 — lower than the old 0.75.
    expect(a.notesCorrectPct).toBeCloseTo(0.6, 5);
  });

  it('marks not-played notes as misses', () => {
    const a = scoreAttempt(base({ played: [] }));
    expect(a.perNoteGrades.every((g) => g.grade === 'miss')).toBe(true);
    expect(a.stars).toBe(0);
    expect(a.masteryStar).toBe(false);
  });
});

// ─── chords: completeness & extras ──────────────────────────────────────────

describe('chords', () => {
  const cChord = chartOf([note('c', [60, 64, 67], 0)]);

  it('credits a chord when all tones are present', () => {
    const played = [play(60, 0), play(64, 5), play(67, -5)];
    const a = scoreAttempt(base({ chart: cChord, played }));
    expect(a.perNoteGrades[0].pitchCorrect).toBe(true);
    expect(a.perNoteGrades[0].grade).toBe('perfect');
  });

  it('marks a missing chord-tone as not correct (miss)', () => {
    const played = [play(60, 0), play(64, 0)]; // missing G (67)
    const a = scoreAttempt(base({ chart: cChord, played }));
    expect(a.perNoteGrades[0].pitchCorrect).toBe(false);
    expect(a.perNoteGrades[0].grade).toBe('miss');
  });

  it('credits the chord but still counts the extra note against accuracy', () => {
    const played = [play(60, 0), play(64, 0), play(67, 0), play(61, 0)];
    const a = scoreAttempt(base({ chart: cChord, played }));
    expect(a.perNoteGrades[0].pitchCorrect).toBe(true); // chord complete
    expect(a.extraNotes).toBe(1); // the stray C# is a wrong note
    expect(a.notesCorrectPct).toBeCloseTo(0.5, 5); // 1 ÷ (1 + 1)
  });
});

// ─── wrong/extra notes penalize the score ───────────────────────────────────

describe('extra notes count against the score', () => {
  const played = (extras: number[]) => [
    play(60, 0),
    play(62, 1000),
    play(64, 2000),
    play(65, 3000),
    ...extras.map((p, i) => play(p, 500 + i)), // stray notes near the start
  ];

  it('a clean take with no extras scores full accuracy', () => {
    const a = scoreAttempt(base({ played: played([]) }));
    expect(a.extraNotes).toBe(0);
    expect(a.notesCorrectPct).toBe(1);
    expect(a.stars).toBe(3);
  });

  it('mashing extra wrong notes drops accuracy and stars', () => {
    // 4 correct + 4 wrong pitches (not in the chart) → 4 ÷ 8 = 0.5.
    const a = scoreAttempt(base({ played: played([73, 75, 78, 80]) }));
    expect(a.extraNotes).toBe(4);
    expect(a.notesCorrectPct).toBeCloseTo(0.5, 5);
    expect(a.stars).toBeLessThan(3);
  });

  it('does not double-penalize a merely mistimed correct-pitch note', () => {
    // Play E (64) so late its event misses (beyond the match window), but E IS
    // a chart pitch nearby, so it is not also counted as a wrong/extra note.
    const late = [play(60, 0), play(62, 1000), play(64, 2700), play(65, 3000)];
    const a = scoreAttempt(base({ played: late }));
    expect(a.perNoteGrades[2].grade).toBe('miss'); // the 64 event missed
    expect(a.extraNotes).toBe(0); // but no double penalty as a wrong note
  });
});

// ─── star thresholds ────────────────────────────────────────────────────────

describe('star rating thresholds (doc 03 §3.4)', () => {
  // 10-note scale so percentages are easy to reason about.
  const tenNotes = chartOf(
    Array.from({ length: 10 }, (_, i) => note(`s${i}`, [60 + i], i)),
  );
  const playAll = (devFor: (i: number) => number | null): NotePlayed[] => {
    const out: NotePlayed[] = [];
    for (let i = 0; i < 10; i++) {
      const dev = devFor(i);
      if (dev !== null) out.push(play(60 + i, i * 1000 + dev));
    }
    return out;
  };

  it('1 star: completed with ≥60% correct but sloppy timing', () => {
    // 7/10 correct, those hits all Good-ish (150ms) → not enough for 2★.
    const played = playAll((i) => (i < 7 ? 150 : null));
    const a = scoreAttempt(base({ chart: tenNotes, played }));
    expect(a.notesCorrectPct).toBeCloseTo(0.7, 5);
    expect(a.stars).toBe(1);
  });

  it('2 stars: ≥85% correct and ≥70% Good-or-better timing', () => {
    // 9/10 correct, all within Good (150ms) → good-or-better = 100%.
    const played = playAll((i) => (i < 9 ? 150 : null));
    const a = scoreAttempt(base({ chart: tenNotes, played }));
    expect(a.notesCorrectPct).toBeCloseTo(0.9, 5);
    expect(a.goodOrBetterPct).toBe(1);
    expect(a.stars).toBe(2);
  });

  it('3 stars: ≥95% correct and ≥85% Great-or-better timing', () => {
    const played = playAll(() => 20); // all perfect, all present
    const a = scoreAttempt(base({ chart: tenNotes, played }));
    expect(a.notesCorrectPct).toBe(1);
    expect(a.greatOrBetterPct).toBe(1);
    expect(a.stars).toBe(3);
  });
});

// ─── at-tempo vs slowed (mastery gate) ──────────────────────────────────────

describe('at-tempo vs slowed', () => {
  it('withholds the mastery star when slowed below target, even at 3 stars', () => {
    // Played perfectly at 40 BPM (beat = 1500 ms) but target is 60 BPM.
    const played = [play(60, 0), play(62, 1500), play(64, 3000), play(65, 4500)];
    const a = scoreAttempt(base({ played, tempoBPM: 40, targetTempoBPM: 60 }));
    expect(a.stars).toBe(3);
    expect(a.atTempo).toBe(false);
    expect(a.masteryStar).toBe(false);
  });

  it('withholds the mastery star when assists were used', () => {
    const played = [play(60, 0), play(62, 1000), play(64, 2000), play(65, 3000)];
    const a = scoreAttempt(base({ played, assistsUsed: ['note-names'] }));
    expect(a.stars).toBe(3);
    expect(a.atTempo).toBe(true);
    expect(a.masteryStar).toBe(false);
  });
});

// ─── stricter tiers ─────────────────────────────────────────────────────────

describe('scoring gets stricter with tier', () => {
  it('downgrades the same 50ms deviation as the tier rises', () => {
    const played = [play(60, 50), play(62, 1000), play(64, 2000), play(65, 3000)];
    const easy = scoreAttempt(base({ played, tier: 1 })).perNoteGrades[0].grade;
    const hard = scoreAttempt(base({ played, tier: 30 })).perNoteGrades[0].grade;
    expect(easy).toBe('perfect'); // 50 ≤ 60
    expect(hard).not.toBe('perfect'); // 50 > 25
  });
});

// ─── determinism ────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('produces identical grades for identical inputs', () => {
    const played = [play(60, 12), play(62, 1030), play(64, 1980), play(65, 3005)];
    const a = scoreAttempt(base({ played }));
    const b = scoreAttempt(base({ played }));
    expect(a.perNoteGrades).toEqual(b.perNoteGrades);
    expect(a.stars).toBe(b.stars);
  });
});
