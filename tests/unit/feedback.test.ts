import { describe, it, expect } from 'vitest';
import { scoreAttempt } from '@/core/scoring/scoringEngine';
import { barAccuracies, generateTip } from '@/core/scoring/feedback';
import type { Chart, NoteEvent, NotePlayed } from '@/core/types';

function note(id: string, pitch: number, startBeat: number): NoteEvent {
  return { id, pitches: [pitch], startBeat, durationBeats: 1, hand: 'right' };
}
function play(pitch: number, ts: number): NotePlayed {
  return { pitch, velocity: 80, timestampMs: ts, source: 'virtual' };
}

// Two bars of 4 quarter notes at 60 BPM (1 beat = 1000ms).
const chart: Chart = {
  id: 'c',
  songId: 's',
  arrangementLevel: 'simplified',
  timeSignature: { beatsPerBar: 4, beatUnit: 4 },
  chordSymbols: [],
  notes: Array.from({ length: 8 }, (_, i) => note(`n${i}`, 60 + i, i)),
};

const score = (played: NotePlayed[], over = {}) =>
  scoreAttempt({
    chart,
    played,
    tempoBPM: 60,
    targetTempoBPM: 60,
    tier: 1,
    startTimeMs: 0,
    attemptId: 'x',
    ...over,
  });

describe('barAccuracies', () => {
  it('splits accuracy by bar', () => {
    // Bar 0 fully correct, bar 1 fully missed.
    const played = Array.from({ length: 4 }, (_, i) => play(60 + i, i * 1000));
    const bars = barAccuracies(score(played), chart);
    expect(bars[0]).toMatchObject({ bar: 0, correctPct: 1 });
    expect(bars[1]).toMatchObject({ bar: 1, correctPct: 0 });
  });

  it('attributes wrong notes to the bar they were played in and lowers its score', () => {
    // All 8 correct, plus two wrong notes (pitch 99) landing in bar 1 (beats 5 & 6).
    const played = [
      ...Array.from({ length: 8 }, (_, i) => play(60 + i, i * 1000)),
      play(99, 5000),
      play(99, 6000),
    ];
    const bars = barAccuracies(score(played), chart);
    expect(bars[0]).toMatchObject({ wrong: 0, score: 1 }); // clean bar
    expect(bars[1].wrong).toBe(2); // both wrong notes attributed here
    expect(bars[1].score).toBeCloseTo(4 / 6, 5); // 4 correct ÷ (4 events + 2 wrong)
  });
});

describe('generateTip', () => {
  it('prioritizes note accuracy when it is low', () => {
    const played = [play(60, 0), play(61, 1000)]; // mostly missing
    expect(generateTip(score(played), chart)).toMatch(/right notes/i);
  });

  it('calls out rushing', () => {
    const played = Array.from({ length: 8 }, (_, i) => play(60 + i, i * 1000 - 40));
    expect(generateTip(score(played), chart)).toMatch(/rushing/i);
  });

  it('calls out dragging', () => {
    const played = Array.from({ length: 8 }, (_, i) => play(60 + i, i * 1000 + 40));
    expect(generateTip(score(played), chart)).toMatch(/dragging/i);
  });

  it('nudges toward the mastery star when clean but slowed', () => {
    const played = Array.from({ length: 8 }, (_, i) => play(60 + i, i * 1500)); // perfect at 40bpm
    const tip = generateTip(score(played, { tempoBPM: 40 }), chart);
    expect(tip).toMatch(/mastery star/i);
  });
});
