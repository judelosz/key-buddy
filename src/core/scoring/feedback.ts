/**
 * End-of-take feedback (doc 03 §3.3): a per-bar accuracy heat-map and one
 * specific, actionable tip. Pure and testable — the report UI just renders this.
 */
import type { Attempt, Chart } from '@/core/types';

export interface BarAccuracy {
  bar: number;
  correctPct: number; // 0–1, correct events ÷ events in the bar
  count: number; // chart events in the bar
  wrong: number; // wrong notes played in the bar
  /** 0–1 bar score folding in wrong notes: correct ÷ (events + wrong). */
  score: number;
}

/** noteEventId → 0-based bar, for any consumer that attributes results to bars. */
export function barOfNoteEvents(chart: Pick<Chart, 'notes' | 'timeSignature'>): Map<string, number> {
  const beatsPerBar = chart.timeSignature.beatsPerBar;
  const barOfEvent = new Map<string, number>();
  for (const note of chart.notes) {
    barOfEvent.set(note.id, Math.floor(note.startBeat / beatsPerBar));
  }
  return barOfEvent;
}

export function barAccuracies(attempt: Attempt, chart: Chart): BarAccuracy[] {
  const barOfEvent = barOfNoteEvents(chart);

  const totals = new Map<number, { correct: number; count: number; wrong: number }>();
  const bucket = (bar: number) => {
    let t = totals.get(bar);
    if (!t) {
      t = { correct: 0, count: 0, wrong: 0 };
      totals.set(bar, t);
    }
    return t;
  };

  for (const g of attempt.perNoteGrades) {
    const t = bucket(barOfEvent.get(g.noteEventId) ?? 0);
    t.count += 1;
    if (g.pitchCorrect) t.correct += 1;
  }
  for (const w of attempt.wrongNotes) bucket(w.bar).wrong += 1;

  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bar, t]) => ({
      bar,
      correctPct: t.count ? t.correct / t.count : 0,
      count: t.count,
      wrong: t.wrong,
      score: t.count + t.wrong ? t.correct / (t.count + t.wrong) : 1,
    }));
}

/** The single most useful next-step nudge, chosen by priority. */
export function generateTip(attempt: Attempt, chart: Chart): string {
  const mean = Math.round(attempt.timingHistogram.meanMs);

  if (attempt.extraNotes >= Math.max(2, Math.ceil(chart.notes.length * 0.2))) {
    return `You hit ${attempt.extraNotes} extra note${
      attempt.extraNotes === 1 ? '' : 's'
    } — play only the notes shown, and keep stray fingers off the keys.`;
  }

  if (attempt.notesCorrectPct < 0.6) {
    return 'Focus on the right notes first — slow the tempo and aim for accuracy before timing.';
  }

  // Stops outrank timing bias: keeping the pulse through a mistake is the
  // musicianship teachers actually grade (doc-08 §4.9), and a player who
  // pauses to fix a note deserves that feedback before any early/late nudge.
  if ((attempt.continuity?.stops ?? 0) > 0) {
    const s = attempt.continuity!.stops;
    return `The pulse stopped ${s === 1 ? 'once' : `${s} times`} mid-take. Playing through a miss beats stopping to fix it — the band wouldn't wait, and neither does the song.`;
  }

  // A LARGE but CONSISTENT lag is usually input/audio latency, not hands —
  // the honest fix is calibration, and the player deserves to be told so.
  if (mean >= 60 && attempt.timingHistogram.stdDevMs <= 60) {
    return `Every note lands about ${mean} ms late — that consistent, that's usually your device's latency, not your hands. Re-run calibration in Settings.`;
  }
  if (mean <= -25) {
    return `You're rushing (about ${Math.abs(mean)} ms early on average). Breathe and lay back into the click.`;
  }
  if (mean >= 25) {
    return `You're dragging (about ${mean} ms late on average). Lean forward and drive the beat.`;
  }

  const bars = barAccuracies(attempt, chart);
  const weakest = bars.reduce<BarAccuracy | null>(
    (min, b) => (min === null || b.score < min.score ? b : min),
    null,
  );
  if (weakest && weakest.score < 0.7) {
    const why = weakest.wrong > 0 ? 'wrong notes and misses' : 'misses';
    return `Bar ${weakest.bar + 1} is the weak spot (${why}) — drill it hands-slow, then bring it back up to tempo.`;
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
