import { describe, it, expect } from 'vitest';
import { recitalGrade, letterFor } from '@/core/scoring/recitalGrade';
import { STAR_FLOORS } from '@/core/scoring/scoringEngine';

/** A recital-grade input: the star-matrix dimensions plus the stars they earn. */
const take = (
  stars: 0 | 1 | 2 | 3,
  notes: number,
  good: number,
  great: number,
) => ({ stars, notesCorrectPct: notes, goodOrBetterPct: good, greatOrBetterPct: great });

describe('recitalGrade — anchors (difficulty unchanged by construction)', () => {
  it('a take exactly at the 3★ floor scores 90 = A-', () => {
    const f = STAR_FLOORS.three;
    expect(recitalGrade(take(3, f.notes, f.good, f.great))).toEqual({ score: 90, letter: 'A-' });
  });

  it('a perfect take scores 100 = A+', () => {
    expect(recitalGrade(take(3, 1, 1, 1))).toEqual({ score: 100, letter: 'A+' });
  });

  it('a take exactly at the 2★ floor scores 75 = C', () => {
    const f = STAR_FLOORS.two;
    expect(recitalGrade(take(2, f.notes, f.good, 0))).toEqual({ score: 75, letter: 'C' });
  });

  it('an all-Good-no-Great 2★ take never reaches the A range', () => {
    // Perfect accuracy, strong Good timing, zero Greats — the regression case
    // that must cap at 2★ (and therefore below 90) per the star-matrix ADR.
    const g = recitalGrade(take(2, 1, 1, 0.2));
    expect(g.score).toBeLessThanOrEqual(89);
    expect(g.letter).toBe('B+');
  });

  it('a take exactly at the 1★ floor scores 60 = D-', () => {
    expect(recitalGrade(take(1, STAR_FLOORS.one.notes, 0, 0))).toEqual({ score: 60, letter: 'D-' });
  });

  it('a silent take scores 0 = E, and 0★ tops out in the E range', () => {
    expect(recitalGrade(take(0, 0, 0, 0))).toEqual({ score: 0, letter: 'E' });
    expect(recitalGrade(take(0, 0.59, 1, 1)).score).toBeLessThanOrEqual(59);
    expect(recitalGrade(take(0, 0.59, 1, 1)).letter).toBe('E');
  });
});

describe('recitalGrade — band consistency', () => {
  it('is monotone with stars: every band sits strictly above the one below', () => {
    const best0 = recitalGrade(take(0, 0.59, 1, 1)).score;
    const worst1 = recitalGrade(take(1, STAR_FLOORS.one.notes, 0, 0)).score;
    const best1 = recitalGrade(take(1, 0.99, 0.99, 0.99)).score;
    const worst2 = recitalGrade(take(2, STAR_FLOORS.two.notes, STAR_FLOORS.two.good, 0)).score;
    const best2 = recitalGrade(take(2, 1, 1, 0.4)).score;
    const worst3 = recitalGrade(
      take(3, STAR_FLOORS.three.notes, STAR_FLOORS.three.good, STAR_FLOORS.three.great),
    ).score;
    expect(best0).toBeLessThan(worst1);
    expect(best1).toBeLessThan(worst2);
    expect(best2).toBeLessThan(worst3);
  });

  it('band edges align with the letter scale: 3★ ⇔ A range, 0★ ⇔ E', () => {
    expect(recitalGrade(take(3, 0.95, 0.85, 0.5)).letter.startsWith('A')).toBe(true);
    expect(recitalGrade(take(0, 0.5, 0.5, 0.1)).letter).toBe('E');
  });
});

describe('letterFor — the school scale', () => {
  it('maps the boundary scores', () => {
    const cases: [number, string][] = [
      [100, 'A+'], [97, 'A+'], [96, 'A'], [93, 'A'], [92, 'A-'], [90, 'A-'],
      [89, 'B+'], [87, 'B+'], [86, 'B'], [83, 'B'], [82, 'B-'], [80, 'B-'],
      [79, 'C+'], [77, 'C+'], [76, 'C'], [73, 'C'], [72, 'C-'], [70, 'C-'],
      [69, 'D+'], [67, 'D+'], [66, 'D'], [63, 'D'], [62, 'D-'], [60, 'D-'],
      [59, 'E'], [0, 'E'],
    ];
    for (const [score, letter] of cases) expect(letterFor(score)).toBe(letter);
  });
});
