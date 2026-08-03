/**
 * ScoringEngine — the foundation of the whole app (build-spec §6.2, doc 03 §3).
 *
 * Pure function: (Chart, NotePlayed[], tempo, tier) → Attempt. Judges pitch
 * (right notes, chord completeness, no extras) and timing (ms deviation from
 * the beat grid) using tier-dependent windows, and produces per-note grades,
 * a timing histogram, and a 1–3 star rating plus the at-tempo mastery star.
 *
 * Design rules honored here:
 *  - Deterministic given its inputs (no clocks, no randomness).
 *  - Never blocks the music on a miss — this is offline judgment of a full take.
 *  - Timing is half the score (doc 03 §3.6): you cannot 3-star by playing the
 *    right notes sloppily.
 *  - Mastery = at-tempo AND un-assisted (guardrail §4.4). XP/Riffs are left at 0
 *    here; RewardService fills them (separation of concerns).
 */
import type {
  Assist,
  Attempt,
  Chart,
  Feel,
  NoteEvent,
  NoteGrade,
  NotePlayed,
  PerNoteGrade,
  Tier,
  TimingHistogram,
} from '@/core/types';
import { matchWindowMs, windowsForTier, type TimingWindows } from './timingWindows';
import { gradeTiming } from './grade';
import { SWING_MASTERY_IN_BAND, applySwing, isSwungFeel, swingReport } from './swing';

export interface ScoreParams {
  chart: Chart;
  played: NotePlayed[];
  /** Tempo the take was actually played at (BPM). */
  tempoBPM: number;
  /** The song's target tempo (BPM) — gates atTempo / mastery. */
  targetTempoBPM: number;
  tier: Tier;
  /** Absolute ms timestamp corresponding to beat 0 of the chart. */
  startTimeMs: number;
  assistsUsed?: Assist[];
  /** Override id generation for deterministic tests. */
  attemptId?: string;
  /**
   * The take's feel (doc 09): resolution is `chart.feel ?? song.feel`.
   * Swung feels shift every expected offbeat-eighth onset to the swing split
   * and produce the Attempt.swing ratio evidence. Omitted/straight/waltz =
   * byte-identical grading to before.
   */
  feel?: Feel;
}

const gradeGoodOrBetter = (g: NoteGrade): boolean =>
  g === 'perfect' || g === 'great' || g === 'good';
const gradeGreatOrBetter = (g: NoteGrade): boolean => g === 'perfect' || g === 'great';

interface PlayedSlot {
  note: NotePlayed;
  consumed: boolean;
}

function judgeEvent(
  event: NoteEvent,
  expectedOnsetMs: number,
  slots: PlayedSlot[],
  w: TimingWindows,
  matchMs: number,
): PerNoteGrade {
  const deviations: number[] = [];
  let matchedCount = 0;

  for (const pitch of event.pitches) {
    // Nearest unconsumed played note of this pitch within the match window.
    let bestIdx = -1;
    let bestAbs = Infinity;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.consumed || slot.note.pitch !== pitch) continue;
      const dev = slot.note.timestampMs - expectedOnsetMs;
      const abs = Math.abs(dev);
      if (abs <= matchMs && abs < bestAbs) {
        bestAbs = abs;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      slots[bestIdx].consumed = true;
      deviations.push(slots[bestIdx].note.timestampMs - expectedOnsetMs);
      matchedCount++;
    }
  }

  const allMatched = matchedCount === event.pitches.length;
  const anyMatched = matchedCount > 0;
  const meanDev =
    deviations.length > 0
      ? deviations.reduce((a, b) => a + b, 0) / deviations.length
      : null;

  let grade: NoteGrade;
  if (!anyMatched) {
    grade = 'miss';
  } else if (!allMatched) {
    // Missing a chord-tone → pitch is wrong; still record timing for insight.
    grade = 'miss';
  } else {
    grade = gradeTiming(meanDev as number, w, matchMs);
  }

  return {
    noteEventId: event.id,
    grade,
    deviationMs: allMatched ? meanDev : null,
    pitchCorrect: allMatched,
  };
}

export function buildHistogram(deviations: number[]): TimingHistogram {
  if (deviations.length === 0) {
    return { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 };
  }
  const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const sorted = [...deviations].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance =
    deviations.reduce((a, b) => a + (b - mean) ** 2, 0) / deviations.length;
  const stdDev = Math.sqrt(variance);

  // 40ms buckets from -200 to +200, with over/underflow edges.
  const BUCKET = 40;
  const bucketMap = new Map<number, number>();
  for (const d of deviations) {
    const clamped = Math.max(-220, Math.min(220, d));
    const center = Math.round(clamped / BUCKET) * BUCKET;
    bucketMap.set(center, (bucketMap.get(center) ?? 0) + 1);
  }
  const buckets = [...bucketMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([centerMs, count]) => ({ centerMs, count }));

  return { buckets, meanMs: mean, medianMs: median, stdDevMs: stdDev };
}

/**
 * The star matrix floors (doc 03 §3.4, amended 2026-07-23 — see ADR).
 * Exported so the recital-grade display layer interpolates within EXACTLY
 * these bands and can never drift from the pass bar.
 */
export const STAR_FLOORS = {
  three: { notes: 0.95, good: 0.85, great: 0.5 },
  two: { notes: 0.85, good: 0.7 },
  one: { notes: 0.6 },
} as const;

function ratePerformance(
  notesCorrectPct: number,
  goodOrBetterPct: number,
  greatOrBetterPct: number,
): 0 | 1 | 2 | 3 {
  // doc 03 §3.4, amended 2026-07-23 (see ADR): 3★ originally demanded 85%
  // GREAT-or-better (±110 ms at tier 1) — near-advanced steadiness at the very
  // first checkpoint, and unreachable for a correct, steady beginner. Now 3★ =
  // near-perfect notes, strong Good-window timing, and half the notes Great —
  // still impossible to earn sloppily (guardrail #8), reachable when earned.
  const f = STAR_FLOORS;
  if (notesCorrectPct >= f.three.notes && goodOrBetterPct >= f.three.good && greatOrBetterPct >= f.three.great) return 3;
  if (notesCorrectPct >= f.two.notes && goodOrBetterPct >= f.two.good) return 2;
  if (notesCorrectPct >= f.one.notes) return 1;
  return 0;
}

/** A pulse break: consecutive played onsets more than this many beats apart
 * while the chart expected notes in between (chart rests never count). */
export const STOP_GAP_BEATS = 2;

/**
 * Continuity evidence (doc-08 §4.9): teachers grade pulse-survival above raw
 * error counts — near-perfect notes with two mid-take stops reads as a C, a
 * flubbed-but-flowing take as a B. Note percentages can't see a stop; the
 * played timestamps (only available here) can.
 */
function computeContinuity(
  played: readonly { timestampMs: number }[],
  sortedEvents: readonly { startBeat: number }[],
  onsetMs: (beat: number) => number,
  beatMs: number,
): { stops: number; maxGapBeats: number } {
  if (sortedEvents.length === 0) return { stops: 0, maxGapBeats: 0 };
  const first = onsetMs(sortedEvents[0].startBeat);
  const last = onsetMs(sortedEvents[sortedEvents.length - 1].startBeat);
  const expected = sortedEvents.map((e) => onsetMs(e.startBeat));

  const onsets = played
    .map((n) => n.timestampMs)
    .filter((t) => t > first - beatMs && t < last + beatMs)
    .sort((a, b) => a - b);
  // Anchor the walk at the first and last expected onsets so silence at the
  // start or a hands-off ending counts as a gap too.
  const anchors = [first, ...onsets, last];

  let stops = 0;
  let maxGapBeats = 0;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    const gapBeats = (b - a) / beatMs;
    if (gapBeats <= STOP_GAP_BEATS) continue;
    // Only a gap the CHART wanted filled is a stop — written rests are music.
    const expectedInside = expected.some((o) => o > a + beatMs / 2 && o < b - beatMs / 2);
    if (!expectedInside) continue;
    stops += 1;
    maxGapBeats = Math.max(maxGapBeats, gapBeats);
  }
  return { stops, maxGapBeats: Math.round(maxGapBeats * 100) / 100 };
}

export function scoreAttempt(params: ScoreParams): Attempt {
  const { chart, played, tempoBPM, targetTempoBPM, tier, startTimeMs, feel } = params;
  const assistsUsed = params.assistsUsed ?? [];
  const windows = windowsForTier(tier);
  const beatMs = 60000 / tempoBPM;
  const matchMs = matchWindowMs(windows, beatMs);
  /** Beat → expected ms on the (possibly swung) grid — the grading truth. */
  const onsetMs = (beat: number): number => startTimeMs + applySwing(feel, beat) * beatMs;

  const slots: PlayedSlot[] = played.map((note) => ({ note, consumed: false }));

  // Judge in time order so earlier notes claim their matches first.
  const events = [...chart.notes].sort((a, b) => a.startBeat - b.startBeat);
  const perNoteGrades: PerNoteGrade[] = events.map((event) =>
    judgeEvent(event, onsetMs(event.startBeat), slots, windows, matchMs),
  );

  const total = perNoteGrades.length;
  const correct = perNoteGrades.filter((g) => g.pitchCorrect);

  // Count WRONG notes: played notes never matched to an event AND whose pitch
  // isn't expected anywhere nearby in time (so a merely mistimed correct-pitch
  // note or a double isn't double-penalized). These count against accuracy.
  const onsetsByPitch = new Map<number, number[]>();
  for (const event of events) {
    const onset = onsetMs(event.startBeat);
    for (const pitch of event.pitches) {
      const arr = onsetsByPitch.get(pitch);
      if (arr) arr.push(onset);
      else onsetsByPitch.set(pitch, [onset]);
    }
  }
  const beatsPerBar = chart.timeSignature.beatsPerBar;
  const maxEventBar = events.reduce(
    (m, e) => Math.max(m, Math.floor(e.startBeat / beatsPerBar)),
    0,
  );
  const wrongWindowMs = Math.max(matchMs, beatMs);
  const wrongNotes: { pitch: number; bar: number }[] = [];
  for (const slot of slots) {
    if (slot.consumed) continue;
    const onsets = onsetsByPitch.get(slot.note.pitch);
    const nearRealNote =
      onsets?.some((o) => Math.abs(slot.note.timestampMs - o) <= wrongWindowMs) ?? false;
    if (nearRealNote) continue;
    // Attribute the wrong note to the bar it landed in (clamped to the song).
    const beat = (slot.note.timestampMs - startTimeMs) / beatMs;
    const bar = Math.min(maxEventBar, Math.max(0, Math.floor(beat / beatsPerBar)));
    wrongNotes.push({ pitch: slot.note.pitch, bar });
  }
  const extraNotes = wrongNotes.length;

  // Accuracy folds wrong notes into the denominator: right notes ÷ (expected
  // notes + wrong notes). Playing extra/incorrect notes now lowers the score.
  const notesCorrectPct = total + extraNotes === 0 ? 0 : correct.length / (total + extraNotes);

  // Timing percentages are over correctly-played notes (the "hits").
  const hitCount = correct.length;
  const goodOrBetter = correct.filter((g) => gradeGoodOrBetter(g.grade)).length;
  const greatOrBetter = correct.filter((g) => gradeGreatOrBetter(g.grade)).length;
  const goodOrBetterPct = hitCount === 0 ? 0 : goodOrBetter / hitCount;
  const greatOrBetterPct = hitCount === 0 ? 0 : greatOrBetter / hitCount;

  const deviations = perNoteGrades
    .filter((g) => g.deviationMs !== null)
    .map((g) => g.deviationMs as number);
  const timingHistogram = buildHistogram(deviations);

  const stars = ratePerformance(notesCorrectPct, goodOrBetterPct, greatOrBetterPct);
  const atTempo = tempoBPM >= targetTempoBPM * 0.99;
  const continuity = computeContinuity(played, events, onsetMs, beatMs);
  const swing = isSwungFeel(feel)
    ? swingReport({
        events,
        perNoteGrades,
        beatMs,
        bpm: tempoBPM,
        beatsPerBar: chart.timeSignature.beatsPerBar,
      })
    : undefined;
  // On a swung chart with measurable pairs, mastery also means it SWUNG
  // (doc 09 §6) — otherwise a flat Free Play take could bank tier-gate boss
  // evidence that the declared lesson bar exists to prevent.
  const swungEnough = swing === undefined || swing.inBandPct >= SWING_MASTERY_IN_BAND;
  const masteryStar = stars === 3 && atTempo && assistsUsed.length === 0 && swungEnough;

  return {
    ...(swing ? { swing } : {}),
    continuity,
    id: params.attemptId ?? crypto.randomUUID(),
    refId: chart.id,
    refKind: 'chart',
    timestamp: Date.now(),
    perNoteGrades,
    timingHistogram,
    wrongNotes,
    extraNotes,
    notesCorrectPct,
    goodOrBetterPct,
    greatOrBetterPct,
    stars,
    masteryStar,
    atTempo,
    tempoBPM,
    assistsUsed,
    xpAwarded: 0, // RewardService fills these
    riffsAwarded: 0,
  };
}
