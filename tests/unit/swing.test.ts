import { describe, it, expect } from 'vitest';
import {
  SWING_MIN_PAIRS,
  SWING_TARGET_RATIO,
  applySwing,
  applySwingDuration,
  isOffbeatEighth,
  isSwungFeel,
  swingBandForTempo,
  swingReport,
  swungBeat,
  swungDuration,
} from '@/core/scoring/swing';
import { scoreAttempt, type ScoreParams } from '@/core/scoring/scoringEngine';
import type { Chart, NoteEvent, NotePlayed } from '@/core/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function eighth(id: string, pitch: number, startBeat: number): NoteEvent {
  return { id, pitches: [pitch], startBeat, durationBeats: 0.5, hand: 'left' };
}

function chartOf(notes: NoteEvent[]): Chart {
  return {
    id: 'swing-chart',
    songId: 'swing-song',
    arrangementLevel: 'full',
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    chordSymbols: [],
    notes,
  };
}

function play(pitch: number, timestampMs: number): NotePlayed {
  return { pitch, velocity: 80, timestampMs, source: 'virtual' };
}

/** Two bars of shuffle eighths on one pitch: onbeat+offbeat per beat, 8 pairs. */
const SHUFFLE_BARS = chartOf(
  Array.from({ length: 8 }, (_, beat) => [
    eighth(`on${beat}`, 48, beat),
    eighth(`off${beat}`, 48, beat + 0.5),
  ]).flat(),
);

const base = (over: Partial<ScoreParams>): ScoreParams => ({
  chart: SHUFFLE_BARS,
  played: [],
  tempoBPM: 60, // 1 beat = 1000 ms — easy arithmetic
  targetTempoBPM: 60,
  tier: 8,
  startTimeMs: 0,
  attemptId: 'fixed',
  feel: 'shuffle',
  ...over,
});

/** A player with a constant long/short ratio (and optional constant bias). */
function playedAtRatio(ratio: number, biasMs = 0, beats = 8, beatMs = 1000): NotePlayed[] {
  const split = ratio / (ratio + 1);
  const notes: NotePlayed[] = [];
  for (let b = 0; b < beats; b++) {
    notes.push(play(48, b * beatMs + biasMs));
    notes.push(play(48, (b + split) * beatMs + biasMs));
  }
  return notes;
}

// ─── the transform ──────────────────────────────────────────────────────────

describe('swungBeat / durations', () => {
  it('shifts only exact-half offbeats to the ratio split', () => {
    expect(swungBeat(0.5, 2)).toBeCloseTo(2 / 3);
    expect(swungBeat(3.5, 2)).toBeCloseTo(3 + 2 / 3);
    expect(swungBeat(0, 2)).toBe(0);
    expect(swungBeat(2, 2)).toBe(2);
    expect(swungBeat(1.25, 2)).toBe(1.25); // sixteenth stays put
  });

  it('reshapes eighth pairs long-short and leaves other durations alone', () => {
    expect(swungDuration(0, 0.5)).toBeCloseTo(2 / 3); // onbeat eighth lengthens
    expect(swungDuration(0.5, 0.5)).toBeCloseTo(1 / 3); // offbeat eighth shrinks
    expect(swungDuration(0, 1)).toBe(1); // quarter untouched
    expect(swungDuration(0.5, 2)).toBe(2);
  });

  it('applySwing is identity for straight and waltz feels', () => {
    for (const feel of ['straight', 'waltz', undefined] as const) {
      expect(applySwing(feel, 1.5)).toBe(1.5);
      expect(applySwingDuration(feel, 0, 0.5)).toBe(0.5);
    }
    expect(isSwungFeel('shuffle')).toBe(true);
    expect(isSwungFeel('swing')).toBe(true);
    expect(isSwungFeel('waltz')).toBe(false);
  });

  it('detects offbeat eighths robustly', () => {
    expect(isOffbeatEighth(4.5)).toBe(true);
    expect(isOffbeatEighth(4.5 + 1e-9)).toBe(true);
    expect(isOffbeatEighth(4.25)).toBe(false);
  });
});

// ─── the band ───────────────────────────────────────────────────────────────

describe('swingBandForTempo', () => {
  it('is 1.7–2.5 at slow-medium tempos and tightens the ceiling when fast', () => {
    expect(swingBandForTempo(84)).toEqual({ min: 1.7, max: 2.5 });
    expect(swingBandForTempo(140).max).toBeCloseTo(2.2);
    expect(swingBandForTempo(180).max).toBeCloseTo(2.2);
    const mid = swingBandForTempo(115).max;
    expect(mid).toBeLessThan(2.5);
    expect(mid).toBeGreaterThan(2.2);
    expect(swingBandForTempo(115).min).toBe(1.7);
  });
});

// ─── the measurement ────────────────────────────────────────────────────────

describe('swingReport via scoreAttempt', () => {
  it('a 2:1 player measures ~2.0 and is fully in band', () => {
    const attempt = scoreAttempt(base({ played: playedAtRatio(2) }));
    expect(attempt.swing).toBeDefined();
    expect(attempt.swing!.measuredRatio).toBeCloseTo(2, 1);
    expect(attempt.swing!.inBandPct).toBe(1);
    expect(attempt.swing!.offbeatPairs).toBe(8);
    expect(attempt.swing!.flattening).toBeUndefined();
  });

  it('a straight player measures ~1.0 and is fully out of band', () => {
    const attempt = scoreAttempt(base({ played: playedAtRatio(1) }));
    expect(attempt.swing).toBeDefined();
    expect(attempt.swing!.measuredRatio).toBeCloseTo(1, 1);
    expect(attempt.swing!.inBandPct).toBe(0);
  });

  it('constant player/device bias cancels in the pair measurement', () => {
    const attempt = scoreAttempt(base({ played: playedAtRatio(2, 80) }));
    expect(attempt.swing!.measuredRatio).toBeCloseTo(2, 1);
    expect(attempt.swing!.inBandPct).toBe(1);
  });

  it('detects flattening: starts swung, evens out in the second half', () => {
    const beatMs = 1000;
    const played = [
      ...playedAtRatio(2, 0, 4, beatMs),
      // Beats 4–7 played straight (offbeat back at .5).
      ...playedAtRatio(1, 0, 4, beatMs).map((n) => play(n.pitch, n.timestampMs + 4 * beatMs)),
    ];
    const attempt = scoreAttempt(base({ played }));
    expect(attempt.swing!.flattening).toBeDefined();
    expect(attempt.swing!.flattening!.fromBar).toBe(1);
  });

  it('reports nothing with too few playable pairs', () => {
    const twoPairChart = chartOf([
      eighth('on0', 48, 0),
      eighth('off0', 48, 0.5),
      eighth('on1', 48, 1),
      eighth('off1', 48, 1.5),
    ]);
    const attempt = scoreAttempt(
      base({ chart: twoPairChart, played: playedAtRatio(2, 0, 2) }),
    );
    expect(SWING_MIN_PAIRS).toBeGreaterThan(2);
    expect(attempt.swing).toBeUndefined();
  });

  it('never reports swing on straight-feel takes', () => {
    const attempt = scoreAttempt(base({ feel: 'straight', played: playedAtRatio(2) }));
    expect(attempt.swing).toBeUndefined();
  });
});

// ─── grading interaction ────────────────────────────────────────────────────

describe('swung per-note grading', () => {
  it('grades a 2:1 player perfect on a shuffle chart (offbeats land on the swung grid)', () => {
    const attempt = scoreAttempt(base({ played: playedAtRatio(SWING_TARGET_RATIO) }));
    expect(attempt.perNoteGrades.every((g) => g.grade === 'perfect')).toBe(true);
    expect(attempt.stars).toBe(3);
  });

  it('a straight player on a swung chart is early on every offbeat at 60 BPM', () => {
    // Offbeat expected at 666.7 ms; straight play lands at 500 ms → 167 ms early,
    // outside tier-8 Good (~161 ms) — the never-swings player no longer passes.
    const attempt = scoreAttempt(base({ played: playedAtRatio(1) }));
    const offGrades = attempt.perNoteGrades.filter((g) => g.noteEventId.startsWith('off'));
    expect(offGrades.every((g) => g.grade === 'early')).toBe(true);
  });

  it('straight charts grade identically with and without the feel param', () => {
    const straightChart = chartOf([
      { id: 'q0', pitches: [60], startBeat: 0, durationBeats: 1, hand: 'right' },
      { id: 'q1', pitches: [62], startBeat: 1, durationBeats: 1, hand: 'right' },
    ]);
    const played = [play(60, 30), play(62, 1040)];
    const a = scoreAttempt(base({ chart: straightChart, played, feel: 'straight' }));
    const b = scoreAttempt(base({ chart: straightChart, played, feel: undefined }));
    expect(a.perNoteGrades).toEqual(b.perNoteGrades);
    expect(a.swing).toBeUndefined();
    expect(b.swing).toBeUndefined();
  });
});

// ─── direct swingReport edge ────────────────────────────────────────────────

describe('swingReport pairing', () => {
  it('prefers a same-hand onbeat partner', () => {
    const events: NoteEvent[] = [
      { id: 'rh-on', pitches: [72], startBeat: 0, durationBeats: 0.5, hand: 'right' },
      { id: 'lh-on', pitches: [48], startBeat: 0, durationBeats: 0.5, hand: 'left' },
      { id: 'lh-off', pitches: [48], startBeat: 0.5, durationBeats: 0.5, hand: 'left' },
    ];
    // RH onbeat dragged 100 ms; LH pair played exactly 2:1. Same-hand pairing
    // must measure 2.0 (pairing with the dragged RH note would skew it).
    const grades = [
      { noteEventId: 'rh-on', grade: 'good' as const, deviationMs: 100, pitchCorrect: true },
      { noteEventId: 'lh-on', grade: 'perfect' as const, deviationMs: 0, pitchCorrect: true },
      { noteEventId: 'lh-off', grade: 'perfect' as const, deviationMs: 0, pitchCorrect: true },
    ];
    const report = swingReport({
      events,
      perNoteGrades: grades,
      beatMs: 1000,
      bpm: 60,
      beatsPerBar: 4,
    });
    // Only one pair → below SWING_MIN_PAIRS → undefined; verify via 4 copies.
    expect(report).toBeUndefined();

    const manyEvents = Array.from({ length: 4 }, (_, b) =>
      events.map((e) => ({ ...e, id: `${e.id}-${b}`, startBeat: e.startBeat + b })),
    ).flat();
    const manyGrades = Array.from({ length: 4 }, (_, b) =>
      grades.map((g) => ({ ...g, noteEventId: `${g.noteEventId}-${b}` })),
    ).flat();
    const many = swingReport({
      events: manyEvents,
      perNoteGrades: manyGrades,
      beatMs: 1000,
      bpm: 60,
      beatsPerBar: 4,
    });
    expect(many!.offbeatPairs).toBe(4);
    expect(many!.measuredRatio).toBeCloseTo(2, 1);
  });
});
