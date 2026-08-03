/**
 * Swing/shuffle model (doc 09). One pure module owns every swing computation:
 * grading targets, playback offsets, falling-note geometry, and the measured
 * ratio-band evidence. Charts stay notated straight (0.5-beat eighths); the
 * transform is applied here at use time, never authored into JSON.
 *
 * All tunables live in this file and are expected to move after the human
 * MIDI test window (doc 09 §9) — swung synchronization is barely studied, so
 * the numbers are convention plus the tempo-ratio studies (doc-08 2.10).
 */
import type { Attempt, Feel, NoteEvent, PerNoteGrade } from '@/core/types';

/** Triplet feel: the offbeat eighth lands at 2/3 of the beat. */
export const SWING_TARGET_RATIO = 2;
/** Fewer playable long-short pairs than this → no swing evidence at all. */
export const SWING_MIN_PAIRS = 4;

const BAND_MIN = 1.7;
const BAND_MAX_SLOW = 2.5;
const BAND_MAX_FAST = 2.2;
const BAND_KNEE_LOW_BPM = 90;
const BAND_KNEE_HIGH_BPM = 140;

/** Pairs with a measured long share beyond these bounds are unmeasurable
 * (a "short" of ~0 explodes the ratio) and are dropped, not graded. */
const PAIR_LONG_SHARE_MAX = 0.95;
const PAIR_LONG_SHARE_MIN = 0.05;

const EPS = 1e-6;

export const isSwungFeel = (feel: Feel | undefined): boolean =>
  feel === 'shuffle' || feel === 'swing';

/**
 * The acceptable measured-ratio band (doc-08 2.10: ~2:1 on average, shrinking
 * as tempo rises, growing when slow). Constant floor; ceiling eases from 2.5
 * at slow-medium tempos toward 2.2 at fast ones.
 */
export function swingBandForTempo(bpm: number): { min: number; max: number } {
  if (bpm <= BAND_KNEE_LOW_BPM) return { min: BAND_MIN, max: BAND_MAX_SLOW };
  if (bpm >= BAND_KNEE_HIGH_BPM) return { min: BAND_MIN, max: BAND_MAX_FAST };
  const t = (bpm - BAND_KNEE_LOW_BPM) / (BAND_KNEE_HIGH_BPM - BAND_KNEE_LOW_BPM);
  return { min: BAND_MIN, max: BAND_MAX_SLOW + t * (BAND_MAX_FAST - BAND_MAX_SLOW) };
}

/** An offbeat eighth position: fractional beat exactly .5 (straight grid). */
export const isOffbeatEighth = (beat: number): boolean =>
  Math.abs(beat - Math.floor(beat) - 0.5) < EPS;

const isOnbeat = (beat: number): boolean => Math.abs(beat - Math.round(beat)) < EPS;

/** Where a straight-grid beat lands when swung: only .5 offbeats move. */
export function swungBeat(beat: number, ratio: number = SWING_TARGET_RATIO): number {
  if (!isOffbeatEighth(beat)) return beat;
  return Math.floor(beat) + ratio / (ratio + 1);
}

/**
 * Swung duration for an eighth-note pair: the onbeat eighth lengthens to the
 * split, the offbeat eighth shrinks to the remainder — so playback sounds and
 * falling notes look long-short. Anything that isn't a paired eighth passes
 * through unchanged.
 */
export function swungDuration(
  startBeat: number,
  durationBeats: number,
  ratio: number = SWING_TARGET_RATIO,
): number {
  if (Math.abs(durationBeats - 0.5) >= EPS) return durationBeats;
  const split = ratio / (ratio + 1);
  if (isOffbeatEighth(startBeat)) return 1 - split;
  if (isOnbeat(startBeat)) return split;
  return durationBeats;
}

/** Feel-gated transforms — identity for straight/waltz, so every call site
 * can apply them unconditionally. */
export const applySwing = (
  feel: Feel | undefined,
  beat: number,
  ratio: number = SWING_TARGET_RATIO,
): number => (isSwungFeel(feel) ? swungBeat(beat, ratio) : beat);

export const applySwingDuration = (
  feel: Feel | undefined,
  startBeat: number,
  durationBeats: number,
  ratio: number = SWING_TARGET_RATIO,
): number => (isSwungFeel(feel) ? swungDuration(startBeat, durationBeats, ratio) : durationBeats);

/** The Attempt.swing shape (types.ts owns it — single source of truth). */
export type SwingEvidence = NonNullable<Attempt['swing']>;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
};

/**
 * Measure the take's swing from long-short pairs (doc 09 §3).
 *
 * Each offbeat event is paired with the onbeat event starting its beat
 * (same-hand preferred). Deviations arrive relative to the SWUNG expected
 * grid, so the played long interval reconstructs as
 *   long = split·beatMs + (devOffbeat − devOnbeat)
 * — differencing the pair cancels any constant player/device bias, which is
 * exactly the per-player correction doc-08 3.9 asks for.
 *
 * Returns undefined when fewer than SWING_MIN_PAIRS pairs are playable: too
 * little evidence to praise or gate (a declared swing bar treats that as a
 * fail — silence is not evidence).
 */
export function swingReport(params: {
  /** Chart events, any order. */
  events: readonly NoteEvent[];
  perNoteGrades: readonly PerNoteGrade[];
  beatMs: number;
  bpm: number;
  beatsPerBar: number;
  ratio?: number;
}): SwingEvidence | undefined {
  const { events, perNoteGrades, beatMs, bpm, beatsPerBar } = params;
  const ratio = params.ratio ?? SWING_TARGET_RATIO;
  const split = ratio / (ratio + 1);

  const devById = new Map<string, number | null>();
  for (const g of perNoteGrades) devById.set(g.noteEventId, g.deviationMs);

  // Index onbeat events by their integer beat for pairing.
  const onbeatsByBeat = new Map<number, NoteEvent[]>();
  for (const e of events) {
    if (!isOnbeat(e.startBeat)) continue;
    const key = Math.round(e.startBeat);
    const arr = onbeatsByBeat.get(key);
    if (arr) arr.push(e);
    else onbeatsByBeat.set(key, [e]);
  }

  const pairs: { bar: number; pairRatio: number }[] = [];
  for (const off of events) {
    if (!isOffbeatEighth(off.startBeat)) continue;
    const devOff = devById.get(off.id);
    if (devOff === null || devOff === undefined) continue;
    const candidates = onbeatsByBeat.get(Math.floor(off.startBeat)) ?? [];
    const on =
      candidates.find((c) => c.hand === off.hand && devById.get(c.id) != null) ??
      candidates.find((c) => devById.get(c.id) != null);
    if (!on) continue;
    const devOn = devById.get(on.id) as number;

    const longMs = split * beatMs + (devOff - devOn);
    const longShare = longMs / beatMs;
    if (longShare >= PAIR_LONG_SHARE_MAX || longShare <= PAIR_LONG_SHARE_MIN) continue;
    pairs.push({
      bar: Math.floor(off.startBeat / beatsPerBar),
      pairRatio: longMs / (beatMs - longMs),
    });
  }

  if (pairs.length < SWING_MIN_PAIRS) return undefined;

  const band = swingBandForTempo(bpm);
  const ratios = pairs.map((p) => p.pairRatio);
  const measuredRatio = median(ratios);
  const inBand = pairs.filter((p) => p.pairRatio >= band.min && p.pairRatio <= band.max);
  const inBandPct = inBand.length / pairs.length;

  // Flattening: started swinging, evened out (compare take halves by pair order).
  let flattening: SwingEvidence['flattening'];
  const mid = Math.floor(pairs.length / 2);
  if (mid >= 2) {
    const firstHalf = median(ratios.slice(0, mid));
    const secondHalf = median(ratios.slice(mid));
    if (firstHalf >= band.min && secondHalf < band.min) {
      const firstFlat = pairs.slice(mid).find((p) => p.pairRatio < band.min);
      if (firstFlat) flattening = { fromBar: firstFlat.bar };
    }
  }

  return {
    measuredRatio: Math.round(measuredRatio * 100) / 100,
    inBandPct,
    offbeatPairs: pairs.length,
    ...(flattening ? { flattening } : {}),
  };
}
