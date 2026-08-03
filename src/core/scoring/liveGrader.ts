/**
 * LiveGrader — real-time, per-note feedback during a take (doc 03 §3.3
 * "in-the-moment"). As each note arrives it lights up the nearest matching
 * chart note in its grade colour. This is intentionally simpler than the
 * offline ScoringEngine (a chord lights on its first matched tone); the
 * end-of-take Attempt from ScoringEngine remains authoritative for stars/XP.
 */
import type { Chart, Feel, NoteGrade, NotePlayed, Tier } from '@/core/types';
import { matchWindowMs, windowsForTier, type TimingWindows } from './timingWindows';
import { gradeTiming } from './grade';
import { applySwing } from './swing';

export interface LiveGrade {
  noteEventId: string;
  grade: NoteGrade;
}

export class LiveGrader {
  private readonly beatMs: number;
  private readonly windows: TimingWindows;
  private readonly matchMs: number;
  private readonly consumed = new Set<string>();

  constructor(
    private readonly chart: Chart,
    tempoBPM: number,
    tier: Tier,
    private readonly chartStartPerfMs: number,
    /** The take's feel — swung feels grade against the swung grid (doc 09). */
    private readonly feel?: Feel,
  ) {
    this.beatMs = 60000 / tempoBPM;
    this.windows = windowsForTier(tier);
    this.matchMs = matchWindowMs(this.windows, this.beatMs);
  }

  /** Feed a played note; returns the event it lit up (if any). */
  feed(note: NotePlayed): LiveGrade | null {
    let bestId: string | null = null;
    let bestAbs = Infinity;
    let bestDev = 0;

    for (const event of this.chart.notes) {
      if (this.consumed.has(event.id)) continue;
      if (!event.pitches.includes(note.pitch)) continue;
      const expected = this.chartStartPerfMs + applySwing(this.feel, event.startBeat) * this.beatMs;
      const dev = note.timestampMs - expected;
      const abs = Math.abs(dev);
      if (abs <= this.matchMs && abs < bestAbs) {
        bestAbs = abs;
        bestId = event.id;
        bestDev = dev;
      }
    }

    if (bestId === null) return null;
    this.consumed.add(bestId);
    return { noteEventId: bestId, grade: gradeTiming(bestDev, this.windows, this.matchMs) };
  }
}
