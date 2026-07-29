/**
 * Recital grade — a school-style 0–100 score + letter (A+ … E) for recital
 * surfaces (Free Play reports, performance missions). PURE DISPLAY LAYER:
 * pass/fail everywhere stays the star matrix / passCriteria; this maps a
 * take onto a familiar scale without moving the bar. Calibration is by
 * construction (user decision 2026-07-29): a take that exactly meets the 3★
 * floor scores 90 (A-), a perfect take 100 (A+) — so "A- or better, at
 * tempo, no assists" is today's mastery bar restated, not a new one.
 *
 * Bands interpolate within the star bands using the SAME dimensions the star
 * matrix reads (STAR_FLOORS is shared with ratePerformance, so the scale can
 * never drift from the pass bar): 3★ → 90–100, 2★ → 75–89, 1★ → 60–74,
 * 0★ → 0–59. Monotone with stars by construction. Continuity/stops stay out
 * of the number for now — they're coached via generateTip.
 */
import type { Attempt } from '@/core/types';
import { STAR_FLOORS } from './scoringEngine';

export type GradeLetter =
  | 'A+' | 'A' | 'A-'
  | 'B+' | 'B' | 'B-'
  | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-'
  | 'E';

export interface RecitalGrade {
  /** 0–100 integer. */
  score: number;
  letter: GradeLetter;
}

const LETTER_FLOORS: readonly [number, GradeLetter][] = [
  [97, 'A+'], [93, 'A'], [90, 'A-'],
  [87, 'B+'], [83, 'B'], [80, 'B-'],
  [77, 'C+'], [73, 'C'], [70, 'C-'],
  [67, 'D+'], [63, 'D'], [60, 'D-'],
];

export function letterFor(score: number): GradeLetter {
  for (const [floor, letter] of LETTER_FLOORS) {
    if (score >= floor) return letter;
  }
  return 'E';
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Mean progress of each dimension from its band floor toward its ceiling. */
function bandProgress(dims: [value: number, floor: number, ceil: number][]): number {
  const fracs = dims.map(([v, lo, hi]) => clamp01((v - lo) / (hi - lo)));
  return fracs.reduce((s, f) => s + f, 0) / fracs.length;
}

export function recitalGrade(
  attempt: Pick<Attempt, 'stars' | 'notesCorrectPct' | 'goodOrBetterPct' | 'greatOrBetterPct'>,
): RecitalGrade {
  const { stars, notesCorrectPct: notes, goodOrBetterPct: good, greatOrBetterPct: great } = attempt;
  const f = STAR_FLOORS;
  let score: number;
  if (stars === 3) {
    const q = bandProgress([
      [notes, f.three.notes, 1],
      [good, f.three.good, 1],
      [great, f.three.great, 1],
    ]);
    score = 90 + 10 * q;
  } else if (stars === 2) {
    const q = bandProgress([
      [notes, f.two.notes, f.three.notes],
      [good, f.two.good, f.three.good],
    ]);
    score = Math.min(89, 75 + 15 * q);
  } else if (stars === 1) {
    const q = bandProgress([
      [notes, f.one.notes, f.two.notes],
      [good, 0, f.two.good],
    ]);
    score = Math.min(74, 60 + 14 * q);
  } else {
    score = Math.min(59, (59 * clamp01(notes)) / f.one.notes);
  }
  const rounded = Math.round(score);
  return { score: rounded, letter: letterFor(rounded) };
}
