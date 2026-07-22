import { describe, it, expect } from 'vitest';
import type { Attempt, Chart, PerNoteGrade } from '@/core/types';
import {
  detectTransfer,
  initialSongMastery,
  normalizeSongMastery,
  songMasteryDelta,
  updateSongMastery,
} from '@/core/songMastery/songMastery';
import {
  derivedTransitions,
  sectionResults,
  sliceChartSection,
  transitionResults,
} from '@/core/songMastery/sections';

const DAY = 86_400_000;
const T0 = 1_753_000_000_000;

/** 4-bar chart, one quarter note per beat, two sections of 2 bars each. */
function chartFx(): Chart {
  const notes = Array.from({ length: 16 }, (_, i) => ({
    id: `n${i}`,
    pitches: [60 + (i % 5)],
    startBeat: i,
    durationBeats: 1,
    hand: 'right' as const,
  }));
  return {
    id: 'song-x--simplified',
    songId: 'song-x',
    arrangementLevel: 'simplified',
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    chordSymbols: [],
    notes,
    sections: [
      { id: 'A', label: 'First half', startBar: 0, endBar: 1 },
      { id: 'B', label: 'Second half', startBar: 2, endBar: 3 },
    ],
  };
}

/** Per-note grades: perfect except the listed note indices, which miss. */
function grades(missIdx: number[] = []): PerNoteGrade[] {
  return Array.from({ length: 16 }, (_, i) => ({
    noteEventId: `n${i}`,
    grade: missIdx.includes(i) ? ('miss' as const) : ('perfect' as const),
    deviationMs: missIdx.includes(i) ? null : 5,
    pitchCorrect: !missIdx.includes(i),
  }));
}

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: `a-${Math.abs(JSON.stringify(over).length)}-${over.timestamp ?? T0}`,
    refId: 'song-x--simplified',
    refKind: 'chart',
    timestamp: T0,
    perNoteGrades: grades(),
    timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
    wrongNotes: [],
    extraNotes: 0,
    notesCorrectPct: 1,
    goodOrBetterPct: 1,
    greatOrBetterPct: 1,
    stars: 3,
    masteryStar: true,
    atTempo: true,
    tempoBPM: 96,
    assistsUsed: [],
    xpAwarded: 0,
    riffsAwarded: 0,
    ...over,
  };
}

const evidence = (a: Attempt, day: number, extra: Partial<Extract<Parameters<typeof updateSongMastery>[1], { kind: 'chart-attempt' }>> = {}) =>
  ({
    kind: 'chart-attempt' as const,
    attempt: a,
    chart: chartFx(),
    todayISO: new Date(T0 + day * DAY).toISOString().slice(0, 10),
    ...extra,
  });

describe('section attribution', () => {
  it('scores sections from per-note grades and fails the weak one', () => {
    // Miss half of section B's notes (indices 8..15 are bars 2-3).
    const a = attempt({ perNoteGrades: grades([8, 9, 10, 11]) });
    const results = sectionResults(a, chartFx());
    expect(results.find((r) => r.sectionId === 'A')?.passed).toBe(true);
    expect(results.find((r) => r.sectionId === 'B')?.passed).toBe(false);
  });

  it('passes a transition only when both seam bars hold up', () => {
    const clean = transitionResults(attempt(), chartFx());
    expect(clean).toEqual([{ transitionId: 'A->B', passed: true }]);
    // Wreck bar 1 (end of A): indices 4..7.
    const seamMiss = transitionResults(attempt({ perNoteGrades: grades([4, 5, 6]) }), chartFx());
    expect(seamMiss[0].passed).toBe(false);
  });

  it('slices a playable, rebased section sub-chart', () => {
    const slice = sliceChartSection(chartFx(), 'B')!;
    expect(slice.id).toBe('song-x--simplified#B');
    expect(slice.notes).toHaveLength(8);
    expect(slice.notes[0].startBeat).toBe(0);
    expect(derivedTransitions(chartFx())).toEqual(['A->B']);
  });
});

describe('SongMastery levels', () => {
  it('a single perfect day reaches Connected (3) — never further', () => {
    let m = initialSongMastery('song-x');
    for (let i = 0; i < 6; i++) {
      m = updateSongMastery(m, evidence(attempt({ id: `a${i}` }), 0));
    }
    // Sections + transitions all passed, but only ONE qualifying day exists.
    expect(m.qualifyingPerformances).toHaveLength(1);
    expect(m.level).toBe(3);
  });

  it('two at-tempo qualifying days reach Performance-ready (4)', () => {
    let m = initialSongMastery('song-x');
    m = updateSongMastery(m, evidence(attempt(), 0));
    m = updateSongMastery(m, evidence(attempt({ timestamp: T0 + DAY }), 1));
    expect(m.level).toBe(4);
  });

  it('Durable mastery (5) needs 5 days + delayed retrieval + transfer', () => {
    let m = initialSongMastery('song-x');
    for (let day = 0; day < 4; day++) {
      m = updateSongMastery(m, evidence(attempt({ timestamp: T0 + day * DAY }), day));
    }
    expect(m.level).toBe(4); // 4 qualifying days, no delayed/transfer yet

    // 5th qualifying day arrives after a 5-day gap (delayed) on a different
    // arrangement (transfer).
    const late = attempt({ timestamp: T0 + 9 * DAY, refId: 'song-x--full' });
    m = updateSongMastery(m, {
      ...evidence(late, 9),
      delayedContext: true,
      transfer: 'arrangement',
    });
    expect(m.qualifyingPerformances).toHaveLength(5);
    expect(m.delayedRetrievalAt).toBeDefined();
    expect(m.transferEvidence.map((t) => t.kind)).toContain('arrangement');
    expect(m.level).toBe(5);
  });

  it('assisted or sub-3★ takes never qualify', () => {
    let m = initialSongMastery('song-x');
    m = updateSongMastery(m, evidence(attempt({ assistsUsed: ['falling-notes'] }), 0));
    m = updateSongMastery(m, evidence(attempt({ stars: 2, masteryStar: false }), 0));
    expect(m.qualifyingPerformances).toEqual([]);
  });

  it('section drills move section evidence only — never qualifying or transitions', () => {
    let m = initialSongMastery('song-x');
    m = updateSongMastery(m, evidence(attempt({ sectionId: 'A' }), 0));
    m = updateSongMastery(m, evidence(attempt({ sectionId: 'B', id: 'a-b' }), 0));
    expect(m.sectionProgress['A']?.passes).toBe(1);
    expect(m.sectionProgress['B']?.passes).toBe(1);
    expect(m.qualifyingPerformances).toEqual([]);
    expect(Object.keys(m.transitionProgress)).toEqual([]);
    expect(m.level).toBe(2); // sections learned via drills, not connected
  });

  it('a failing section becomes weak and blocks level 5 until fixed', () => {
    let m = initialSongMastery('song-x');
    m = updateSongMastery(m, evidence(attempt({ perNoteGrades: grades([8, 9, 10, 11]), stars: 2, masteryStar: false }), 0));
    expect(m.weakSectionIds).toEqual(['B']);
  });
});

describe('delta + transfer detection + normalization', () => {
  it('songMasteryDelta reports level-ups, qualifying days, delayed retrieval, transfer', () => {
    const m0 = initialSongMastery('song-x');
    const m1 = updateSongMastery(m0, evidence(attempt(), 0));
    const d = songMasteryDelta(m0, m1);
    expect(d.newQualifyingDay).toBe(true);
    expect(d.leveledTo).toBe(3);
  });

  it('detects arrangement transfer only on a different chart after qualifying history', () => {
    let m = initialSongMastery('song-x');
    m = updateSongMastery(m, evidence(attempt(), 0));
    expect(detectTransfer(m, attempt({ refId: 'song-x--full', timestamp: T0 + DAY }))).toBe('arrangement');
    expect(detectTransfer(m, attempt({ timestamp: T0 + DAY }))).toBeUndefined(); // same chart
  });

  it('detects reduced-guidance on the first top-quality take after non-qualifying history', () => {
    let m = initialSongMastery('song-x');
    m = updateSongMastery(m, evidence(attempt({ assistsUsed: ['falling-notes'], masteryStar: false }), 0));
    expect(detectTransfer(m, attempt({ timestamp: T0 + DAY }))).toBe('reduced-guidance');
  });

  it('normalizeSongMastery migrates pre-v3 qualifying dates as at-tempo', () => {
    const legacy = {
      ...initialSongMastery('song-x'),
      qualifyingSessionDates: ['2026-07-20', '2026-07-21'],
    };
    // Simulate a pre-v3 row (no qualifyingPerformances field at runtime).
    delete (legacy as Partial<typeof legacy>).qualifyingPerformances;
    const norm = normalizeSongMastery(legacy);
    expect(norm.qualifyingPerformances).toHaveLength(2);
    expect(norm.qualifyingPerformances.every((q) => q.atTempo)).toBe(true);
  });
});
