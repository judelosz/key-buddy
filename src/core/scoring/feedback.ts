/**
 * End-of-take feedback (doc 03 §3.3): a per-bar accuracy heat-map and one
 * specific, actionable tip. Pure and testable — the report UI just renders this.
 */
import type { Attempt, Chart } from '@/core/types';

export interface BarAccuracy {
  bar: number;
  correctPct: number; // 0–1
  count: number;
}

export function barAccuracies(attempt: Attempt, chart: Chart): BarAccuracy[] {
  const beatsPerBar = chart.timeSignature.beatsPerBar;
  const barOfEvent = new Map<string, number>();
  for (const note of chart.notes) {
    barOfEvent.set(note.id, Math.floor(note.startBeat / beatsPerBar));
  }

  const totals = new Map<number, { correct: number; count: number }>();
  for (const g of attempt.perNoteGrades) {
    const bar = barOfEvent.get(g.noteEventId) ?? 0;
    const t = totals.get(bar) ?? { correct: 0, count: 0 };
    t.count += 1;
    if (g.pitchCorrect) t.correct += 1;
    totals.set(bar, t);
  }

  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bar, t]) => ({ bar, correctPct: t.count ? t.correct / t.count : 0, count: t.count }));
}

/** The single most useful next-step nudge, chosen by priority. */
export function generateTip(attempt: Attempt, chart: Chart): string {
  const mean = Math.round(attempt.timingHistogram.meanMs);

  if (attempt.notesCorrectPct < 0.6) {
    return 'Focus on the right notes first — slow the tempo and aim for accuracy before timing.';
  }

  if (mean <= -25) {
    return `You're rushing (about ${Math.abs(mean)} ms early on average). Breathe and lay back into the click.`;
  }
  if (mean >= 25) {
    return `You're dragging (about ${mean} ms late on average). Lean forward and drive the beat.`;
  }

  const bars = barAccuracies(attempt, chart);
  const weakest = bars.reduce<BarAccuracy | null>(
    (min, b) => (min === null || b.correctPct < min.correctPct ? b : min),
    null,
  );
  if (weakest && weakest.correctPct < 0.7) {
    return `Bar ${weakest.bar + 1} is the weak spot — drill it hands-slow, then bring it back up to tempo.`;
  }

  if (attempt.stars === 3 && !attempt.atTempo) {
    return 'Clean at this tempo — nudge the speed toward target to earn the mastery star.';
  }
  if (attempt.stars === 3 && attempt.masteryStar) {
    return 'Mastered at tempo. Try the fuller arrangement or a new key.';
  }
  if (attempt.stars === 3) {
    return 'Locked in — turn off assists and hold target tempo for the mastery star.';
  }
  return 'Solid. Keep the pulse steady and turn more Goods into Perfects.';
}
