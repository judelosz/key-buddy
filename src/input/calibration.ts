/**
 * Input calibration (build-spec §3 latency note, doc 03 §3.5).
 *
 * The browser/OS audio stack adds output latency, so an honest player registers
 * "late". We run a one-time routine: the metronome clicks at known times, the
 * user taps along, and we measure the systematic offset (tap − click). That
 * offset is then subtracted from every note timestamp by InputService, so
 * scoring judges intent, not latency.
 *
 * This module holds the pure, unit-tested computation; AudioService/UI drive the
 * click playback and collect taps.
 */

export interface CalibrationResult {
  offsetMs: number; // subtract from note timestamps
  sampleCount: number;
  stdDevMs: number; // consistency of the taps (lower = more reliable)
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
};

/**
 * Pair each tap with its nearest click and take the median deviation as the
 * offset (median resists the odd double-tap or missed beat). Deviations beyond
 * `maxAbsMs` are treated as noise and discarded.
 */
export function computeCalibrationOffset(
  clickTimesMs: readonly number[],
  tapTimesMs: readonly number[],
  maxAbsMs = 400,
): CalibrationResult {
  const deviations: number[] = [];
  for (const tap of tapTimesMs) {
    let best = Infinity;
    for (const click of clickTimesMs) {
      const dev = tap - click;
      if (Math.abs(dev) < Math.abs(best)) best = dev;
    }
    if (Number.isFinite(best) && Math.abs(best) <= maxAbsMs) deviations.push(best);
  }

  if (deviations.length === 0) {
    return { offsetMs: 0, sampleCount: 0, stdDevMs: 0 };
  }

  const offsetMs = median(deviations);
  const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const variance =
    deviations.reduce((a, b) => a + (b - mean) ** 2, 0) / deviations.length;

  return {
    offsetMs,
    sampleCount: deviations.length,
    stdDevMs: Math.sqrt(variance),
  };
}
