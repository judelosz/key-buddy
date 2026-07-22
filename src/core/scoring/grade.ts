/** Shared timing-grade classification, used by the offline ScoringEngine and
 * the live (real-time feedback) grader so both agree. */
import type { NoteGrade } from '@/core/types';
import type { TimingWindows } from './timingWindows';

/** Classify a signed onset deviation (− early, + late) once pitch is confirmed. */
export function gradeTiming(
  deviationMs: number,
  w: TimingWindows,
  matchMs: number,
): NoteGrade {
  const abs = Math.abs(deviationMs);
  if (abs <= w.perfect) return 'perfect';
  if (abs <= w.great) return 'great';
  if (abs <= w.good) return 'good';
  if (abs <= matchMs) return deviationMs < 0 ? 'early' : 'late';
  return 'miss';
}
