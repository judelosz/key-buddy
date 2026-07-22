import { describe, it, expect } from 'vitest';
import { computeCalibrationOffset } from '@/input/calibration';

describe('computeCalibrationOffset', () => {
  it('measures a consistent latency as the offset', () => {
    const clicks = [1000, 2000, 3000, 4000];
    const taps = [1050, 2048, 3052, 4051]; // ~50ms late
    const res = computeCalibrationOffset(clicks, taps);
    expect(res.offsetMs).toBeGreaterThan(45);
    expect(res.offsetMs).toBeLessThan(55);
    expect(res.sampleCount).toBe(4);
  });

  it('returns a zero offset for perfectly-aligned taps', () => {
    const clicks = [1000, 2000, 3000];
    const res = computeCalibrationOffset(clicks, [1000, 2000, 3000]);
    expect(res.offsetMs).toBe(0);
    expect(res.stdDevMs).toBe(0);
  });

  it('discards outliers beyond the max window', () => {
    const clicks = [1000, 2000, 3000, 4000];
    const taps = [1040, 2040, 3040, 9000]; // last is a missed/garbage tap
    const res = computeCalibrationOffset(clicks, taps);
    expect(res.sampleCount).toBe(3);
    expect(res.offsetMs).toBeCloseTo(40, 0);
  });

  it('returns a safe zero offset when there is no usable data', () => {
    expect(computeCalibrationOffset([1000], [])).toEqual({
      offsetMs: 0,
      sampleCount: 0,
      stdDevMs: 0,
    });
  });
});
