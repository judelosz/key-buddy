import { describe, it, expect } from 'vitest';
import type { Attempt } from '@/core/types';
import type { CurriculumLesson } from '@/core/curriculum/types';
import { chartLessonPassed } from '@/core/session/recordLesson';
import { generateTip } from '@/core/scoring/feedback';
import type { Chart } from '@/core/types';

const attempt = (over: Partial<Attempt>): Attempt => ({
  id: 'a1',
  refId: 'c1',
  refKind: 'chart',
  timestamp: 0,
  perNoteGrades: [],
  timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
  wrongNotes: [],
  extraNotes: 0,
  notesCorrectPct: 1,
  goodOrBetterPct: 1,
  greatOrBetterPct: 1,
  stars: 3,
  masteryStar: true,
  atTempo: true,
  tempoBPM: 84,
  assistsUsed: [],
  xpAwarded: 0,
  riffsAwarded: 0,
  continuity: { stops: 0, maxGapBeats: 0 },
  ...over,
});

const lesson = (over: Partial<CurriculumLesson>): CurriculumLesson => ({
  id: 'l1',
  moduleId: 'm1',
  order: 0,
  title: 'L',
  mode: 'supported',
  exerciseType: 'play-chart',
  skillIds: [],
  prompt: '',
  successRule: '',
  passCriteria: {},
  assistOptions: [],
  ...over,
});

const CHART: Chart = {
  id: 'c1',
  songId: 's1',
  arrangementLevel: 'full',
  timeSignature: { beatsPerBar: 4, beatUnit: 4 },
  chordSymbols: [],
  notes: [{ id: 'n0', pitches: [60], startBeat: 0, durationBeats: 1, hand: 'right' }],
};

describe('declared swing bar (doc 09 §6)', () => {
  const bar = lesson({ passCriteria: { minSwingInBandPct: 0.7 } });

  it('passes when the take swings in band', () => {
    const a = attempt({ swing: { measuredRatio: 2.1, inBandPct: 0.8, offbeatPairs: 12 } });
    expect(chartLessonPassed(bar, a)).toBe(true);
  });

  it('fails a flat take even with a perfect star rating', () => {
    const a = attempt({ swing: { measuredRatio: 1.1, inBandPct: 0.2, offbeatPairs: 12 } });
    expect(chartLessonPassed(bar, a)).toBe(false);
  });

  it('fails when there is no measurable swing evidence — silence is not evidence', () => {
    expect(chartLessonPassed(bar, attempt({}))).toBe(false);
  });

  it('does not affect lessons that never declared it', () => {
    expect(chartLessonPassed(lesson({}), attempt({}))).toBe(true);
  });
});

describe('declared continuity bar (maxStops)', () => {
  const bar = lesson({ passCriteria: { maxStops: 0 } });

  it('passes a flowing take and fails a stopped one', () => {
    expect(chartLessonPassed(bar, attempt({}))).toBe(true);
    expect(
      chartLessonPassed(bar, attempt({ continuity: { stops: 1, maxGapBeats: 3 } })),
    ).toBe(false);
  });

  it('fails when continuity was never measured', () => {
    expect(chartLessonPassed(bar, attempt({ continuity: undefined }))).toBe(false);
  });
});

describe('swing coaching tips', () => {
  it('a flat swinger is coached to lean, never told to re-calibrate', () => {
    // Offbeats systematically early vs the swung grid look like a consistent
    // 60+ ms mean — the calibration branch would otherwise misfire.
    const a = attempt({
      swing: { measuredRatio: 1.2, inBandPct: 0.1, offbeatPairs: 12 },
      timingHistogram: { buckets: [], meanMs: 80, medianMs: 80, stdDevMs: 30 },
    });
    const tip = generateTip(a, CHART);
    expect(tip).toMatch(/straight|lean/i);
    expect(tip).not.toMatch(/calibration/i);
  });

  it('flattening drift names the bar it started', () => {
    const a = attempt({
      swing: {
        measuredRatio: 1.8,
        inBandPct: 0.6,
        offbeatPairs: 12,
        flattening: { fromBar: 7 },
      },
    });
    expect(generateTip(a, CHART)).toContain('bar 8');
  });

  it('over-swinging is coached back toward the triplet feel', () => {
    const a = attempt({ swing: { measuredRatio: 3.1, inBandPct: 0.3, offbeatPairs: 12 } });
    expect(generateTip(a, CHART)).toMatch(/over-swinging/i);
  });

  it('an in-band take falls through to the normal ladder', () => {
    const a = attempt({ swing: { measuredRatio: 2.0, inBandPct: 0.95, offbeatPairs: 12 } });
    expect(generateTip(a, CHART)).toContain('Mastered at tempo');
  });
});
