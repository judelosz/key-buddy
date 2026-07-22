/**
 * Section-level attribution (doc 06 §5.2): score each authored chart section
 * (and the transitions between them) from one Attempt's per-note grades. Pure;
 * built on the same bar mapping the report heat-map uses.
 */
import type { Attempt, Chart, ChartSection } from '@/core/types';
import { barAccuracies, barOfNoteEvents } from '@/core/scoring/feedback';

/** Blended pitch score a section needs to pass. Tunable (arrangements are
 * still awaiting their musical listen-through). */
export const SECTION_PASS = 0.85;
/** Good-or-better timing share a section needs. */
export const SECTION_TIMING_MIN = 0.7;
/** No single bar in a passing section may fall below this. */
export const SECTION_BAR_FLOOR = 0.6;
/** Both seam bars of a passing transition must reach this. */
export const TRANSITION_BAR_MIN = 0.75;

export interface SectionResult {
  sectionId: string;
  /** Blend of the section's worst and mean bar scores (0–1). */
  score: number;
  timingOk: boolean;
  passed: boolean;
}

interface BarStats {
  score: number; // pitch score incl. wrong-note penalty (1 when the bar is empty)
  goodOrBetter: number;
  graded: number;
}

function barStats(attempt: Attempt, chart: Chart): Map<number, BarStats> {
  const stats = new Map<number, BarStats>();
  for (const b of barAccuracies(attempt, chart)) {
    stats.set(b.bar, { score: b.score, goodOrBetter: 0, graded: 0 });
  }
  const barOfEvent = barOfNoteEvents(chart);
  for (const g of attempt.perNoteGrades) {
    const bar = barOfEvent.get(g.noteEventId);
    if (bar === undefined) continue;
    const s = stats.get(bar) ?? { score: 1, goodOrBetter: 0, graded: 0 };
    s.graded += 1;
    if (g.grade === 'perfect' || g.grade === 'great' || g.grade === 'good') s.goodOrBetter += 1;
    stats.set(bar, s);
  }
  return stats;
}

function statFor(stats: Map<number, BarStats>, bar: number): BarStats {
  // A bar with no chart events has nothing to get wrong.
  return stats.get(bar) ?? { score: 1, goodOrBetter: 0, graded: 0 };
}

/** Per-section results for a FULL-chart attempt. */
export function sectionResults(attempt: Attempt, chart: Chart): SectionResult[] {
  const sections = chart.sections ?? [];
  const stats = barStats(attempt, chart);

  return sections.map((section) => {
    const bars: BarStats[] = [];
    for (let bar = section.startBar; bar <= section.endBar; bar++) {
      bars.push(statFor(stats, bar));
    }
    const scores = bars.map((b) => b.score);
    const worst = Math.min(...scores);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const score = 0.5 * worst + 0.5 * mean;
    const graded = bars.reduce((a, b) => a + b.graded, 0);
    const goodOrBetter = bars.reduce((a, b) => a + b.goodOrBetter, 0);
    const timingOk = graded === 0 || goodOrBetter / graded >= SECTION_TIMING_MIN;
    return {
      sectionId: section.id,
      score,
      timingOk,
      passed: score >= SECTION_PASS && timingOk && worst >= SECTION_BAR_FLOOR,
    };
  });
}

export function transitionIdBetween(a: ChartSection, b: ChartSection): string {
  return `${a.id}->${b.id}`;
}

/** All derived transition ids of a chart, in order. */
export function derivedTransitions(chart: Chart): string[] {
  const sections = chart.sections ?? [];
  const out: string[] = [];
  for (let i = 1; i < sections.length; i++) {
    out.push(transitionIdBetween(sections[i - 1], sections[i]));
  }
  return out;
}

/** Transition results for a FULL-chart attempt: both seam bars must hold up. */
export function transitionResults(
  attempt: Attempt,
  chart: Chart,
): { transitionId: string; passed: boolean }[] {
  const sections = chart.sections ?? [];
  const stats = barStats(attempt, chart);
  const out: { transitionId: string; passed: boolean }[] = [];
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1];
    const b = sections[i];
    const seamA = statFor(stats, a.endBar).score;
    const seamB = statFor(stats, b.startBar).score;
    out.push({
      transitionId: transitionIdBetween(a, b),
      passed: seamA >= TRANSITION_BAR_MIN && seamB >= TRANSITION_BAR_MIN,
    });
  }
  return out;
}

/**
 * A playable sub-chart for one section (section drills). Note ids are kept so
 * grades still map to the parent's bars if ever needed; beats are rebased so
 * the drill starts at bar 0.
 */
export function sliceChartSection(chart: Chart, sectionId: string): Chart | null {
  const section = chart.sections?.find((s) => s.id === sectionId);
  if (!section) return null;
  const beatsPerBar = chart.timeSignature.beatsPerBar;
  const startBeat = section.startBar * beatsPerBar;
  const endBeatExclusive = (section.endBar + 1) * beatsPerBar;
  return {
    id: `${chart.id}#${sectionId}`,
    songId: chart.songId,
    arrangementLevel: chart.arrangementLevel,
    timeSignature: chart.timeSignature,
    chordSymbols: chart.chordSymbols
      .filter((c) => c.bar >= section.startBar && c.bar <= section.endBar)
      .map((c) => ({ ...c, bar: c.bar - section.startBar })),
    notes: chart.notes
      .filter((n) => n.startBeat >= startBeat && n.startBeat < endBeatExclusive)
      .map((n) => ({ ...n, startBeat: n.startBeat - startBeat })),
  };
}
