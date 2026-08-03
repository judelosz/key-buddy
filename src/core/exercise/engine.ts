/**
 * ExerciseEngine — a pure prompt-sequencing state machine (the exercise
 * counterpart of LiveGrader). The UI runner feeds it timestamped
 * ResponseEvents; it grades each prompt and returns the ExerciseResult when
 * the last prompt finishes. No I/O, timers, or randomness.
 */
import type { NoteGrade } from '@/core/types';
import { midiToName } from '@/core/music';
import { buildHistogram } from '@/core/scoring/scoringEngine';
import { gradeTiming } from '@/core/scoring/grade';
import {
  matchWindowMs,
  windowsForTier,
  type TimingWindows,
} from '@/core/scoring/timingWindows';
import { isOffbeatEighth, swingReport, swungBeat } from '@/core/scoring/swing';
import type {
  ExercisePrompt,
  ExerciseResult,
  ExerciseSpec,
  ExerciseSwing,
  PromptResult,
  ResponseEvent,
} from './types';

/** Taps need this share of Good-or-better timing to pass (doc 06 §5.1). */
const TAPS_PASS_PCT = 0.7;

/**
 * Rhythm taps grade against WIDENED timing windows. The doc-03 §3.2 windows
 * are tuned for pitched chart play, where the player has visual anchors
 * (falling notes, keys) on top of the click; a tap prompt is audio-anchored
 * gross motor through the full input-latency stack, and the same windows feel
 * brutal there (Phase-5 test-window feedback). Tier 1 Good: ±180 → ±315 ms.
 */
export const TAP_WINDOW_SCALE = 1.75;

/**
 * Per-take systematic-bias correction (doc-08 §3.9). Untrained tappers are
 * *consistent* (SD ~20–50 ms) but individually *biased* — negative mean
 * asynchrony plus device latency can offset every tap by up to ~100+ ms in
 * one direction. After each completed prompt the take's mean matched
 * deviation (clamped) is subtracted from the NEXT prompt's grading, so the
 * windows measure precision rather than punishing a constant offset. Raw
 * deviations are still reported (histogram meanMs exposes the real bias).
 */
export const TAP_BIAS_CLAMP_MS = 150;
/** Don't trust a bias estimate built on fewer matched taps than this. */
const TAP_BIAS_MIN_SAMPLES = 3;

/**
 * Count-in self-calibration. The pulse card invites tapping along with the
 * count-in clicks; those free taps are a perfect per-take latency sample —
 * the player syncs to the HEARD click, so their offset vs the scheduled
 * click grid captures the whole output+input latency chain. Their median
 * (clamped) becomes the take's starting bias, which is what makes
 * single-prompt tap missions passable on an uncalibrated device.
 */
export const TAP_COUNTIN_BIAS_CLAMP_MS = 350;
/** Ignore count-in taps wilder than this — not an attempt to hit a click. */
const TAP_COUNTIN_SANITY_MS = 450;
/** Need at least this many count-in taps to trust the estimate. */
const TAP_COUNTIN_MIN_SAMPLES = 2;

/** Two tap notes closer than this are ONE musical intent ("any key counts"):
 * fat-finger chords, near-simultaneous fingers, or residual input doubles.
 * The second never matches a target and never counts as an extra. */
export const TAP_COLLAPSE_MS = 80;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function tapWindowsForTier(tier: number): TimingWindows {
  const w = windowsForTier(tier);
  return {
    perfect: w.perfect * TAP_WINDOW_SCALE,
    great: w.great * TAP_WINDOW_SCALE,
    good: w.good * TAP_WINDOW_SCALE,
  };
}

const pc = (pitch: number) => ((pitch % 12) + 12) % 12;

interface TapState {
  /** Signed deviation of the tap matched to each target beat (null = missed). */
  deviations: (number | null)[];
  extras: number;
}

/** Real-time verdict for one tap — drives the live pill in the tap view. */
export interface TapFeedback {
  kind: 'countIn' | 'graded' | 'extra' | 'duplicate';
  /** Present when graded (bias-corrected classification). */
  grade?: NoteGrade;
  /** Bias-corrected signed ms (negative = early). Present when graded. */
  deviationMs?: number;
  /** Swung prompts: an early offbeat tap leaning back toward the straight
   * position — the specific coaching verdict, not just "early" (doc 09 §5). */
  tooStraight?: boolean;
}

export class ExerciseEngine {
  private index = 0;
  private readonly results: PromptResult[] = [];
  private promptShownAt: number | null = null;
  private collected = new Set<number>();
  private collectedPitches: number[] = [];
  private taps: TapState = { deviations: [], extras: 0 };
  /** Per-take systematic tap bias (ms), learned prompt-by-prompt — survives
   * resetPromptState so prompt 1 always grades uncorrected. */
  private tapBiasMs = 0;
  /** This prompt's count-in tap offsets (vs the count-in click grid). */
  private countInDevs: number[] = [];
  /** Set once per prompt, when the first graded tap arrives. */
  private countInBiasApplied = false;
  /** Last accepted tap time — taps within TAP_COLLAPSE_MS are one intent. */
  private lastTapAtMs: number | null = null;
  private finished = false;

  constructor(private readonly spec: ExerciseSpec) {
    this.resetPromptState();
  }

  get currentPrompt(): ExercisePrompt | null {
    return this.finished ? null : (this.spec.prompts[this.index] ?? null);
  }

  get progress(): { index: number; total: number } {
    return { index: this.index, total: this.spec.prompts.length };
  }

  feed(e: ResponseEvent): {
    promptResult?: PromptResult;
    done?: ExerciseResult;
    /** Live per-tap verdict (taps prompts only) — pure addition, UI-facing. */
    tapFeedback?: TapFeedback;
  } {
    const prompt = this.currentPrompt;
    if (!prompt) return {};

    if (e.kind === 'prompt-shown') {
      this.promptShownAt = e.atMs;
      return {};
    }

    const expected = prompt.expected;
    switch (expected.kind) {
      case 'pitch': {
        if (e.kind !== 'note') return {};
        const correct = pc(e.note.pitch) === expected.pitchClass;
        return this.finishPrompt(prompt, {
          correct,
          scorePct: correct ? 1 : 0,
          detail: `You played ${midiToName(e.note.pitch)}`,
        });
      }

      case 'pitch-set': {
        if (e.kind === 'note') {
          this.collected.add(pc(e.note.pitch));
          this.collectedPitches.push(e.note.pitch);
          // Evaluate as soon as enough distinct tones are down.
          if (this.collected.size >= expected.pitchClasses.length) {
            return this.evaluatePitchSet(prompt);
          }
          return {};
        }
        if (e.kind === 'commit') return this.evaluatePitchSet(prompt);
        return {};
      }

      case 'choice': {
        if (e.kind !== 'choice') return {};
        const correct = e.index === expected.answerIndex;
        return this.finishPrompt(prompt, {
          correct,
          scorePct: correct ? 1 : 0,
          detail: prompt.choices?.[e.index],
          chosenIndex: e.index,
        });
      }

      case 'taps': {
        // Nothing counts until the count-in anchors the grid — a stray key
        // press (or the launch tap that starts the metronome) is never an
        // "extra" against the score.
        if (this.promptShownAt === null) return {};
        if (e.kind === 'note') {
          return { tapFeedback: this.matchTap(e.note.timestampMs, expected) };
        }
        if (e.kind === 'commit') return this.evaluateTaps(prompt, expected);
        return {};
      }

      case 'watch': {
        if (e.kind !== 'watch-complete') return {};
        return this.finishPrompt(prompt, { correct: true, scorePct: 1 });
      }
    }
  }

  // ── Pitch-set (chord build) ────────────────────────────────────────────────

  private evaluatePitchSet(prompt: ExercisePrompt): ReturnType<ExerciseEngine['feed']> {
    const expected = prompt.expected;
    if (expected.kind !== 'pitch-set') return {};
    const want = new Set(expected.pitchClasses);
    const got = this.collected;
    const correct = want.size === got.size && [...want].every((p) => got.has(p));
    const played = this.collectedPitches.map((p) => midiToName(p)).join(', ');
    return this.finishPrompt(prompt, {
      correct,
      scorePct: correct ? 1 : 0,
      detail: played.length > 0 ? `You played ${played}` : 'No notes played',
    });
  }

  // ── Taps (rhythm) ──────────────────────────────────────────────────────────

  private tapTargets(expected: Extract<ExercisePrompt['expected'], { kind: 'taps' }>): number[] {
    const anchor = this.promptShownAt ?? 0;
    const beatMs = 60_000 / expected.bpm;
    // A swung prompt's offbeat targets sit at the ratio split (doc 09 §2).
    const beatOf = (b: number): number =>
      expected.swingRatio ? swungBeat(b, expected.swingRatio) : b;
    return expected.beats.map((b) => anchor + (expected.countInBeats + beatOf(b)) * beatMs);
  }

  private matchTap(
    atMs: number,
    expected: Extract<ExercisePrompt['expected'], { kind: 'taps' }>,
  ): TapFeedback {
    // Collapse near-simultaneous notes into one tap intent — the second of a
    // doubled delivery (or a two-finger tap) must never become an "extra".
    if (this.lastTapAtMs !== null && atMs - this.lastTapAtMs < TAP_COLLAPSE_MS) {
      return { kind: 'duplicate' };
    }
    this.lastTapAtMs = atMs;
    const targets = this.tapTargets(expected);
    const beatMs = 60_000 / expected.bpm;
    // Count-in taps are free — and they self-calibrate the take. The pulse
    // card invites tapping along with the count-in clicks; each free tap's
    // offset against the count-in click grid is recorded, and their median
    // becomes this prompt's starting bias once graded taps begin.
    if (targets.length > 0 && atMs < targets[0] - beatMs / 2) {
      const anchor = this.promptShownAt ?? 0;
      let bestDev = Infinity;
      for (let k = 0; k < expected.countInBeats; k++) {
        const dev = atMs - (anchor + k * beatMs);
        if (Math.abs(dev) < Math.abs(bestDev)) bestDev = dev;
      }
      if (Math.abs(bestDev) <= TAP_COUNTIN_SANITY_MS) this.countInDevs.push(bestDev);
      return { kind: 'countIn' };
    }
    // First graded tap: fold the count-in sample into the bias.
    if (!this.countInBiasApplied) {
      this.countInBiasApplied = true;
      if (this.countInDevs.length >= TAP_COUNTIN_MIN_SAMPLES) {
        const m = median(this.countInDevs);
        this.tapBiasMs = Math.max(
          -TAP_COUNTIN_BIAS_CLAMP_MS,
          Math.min(TAP_COUNTIN_BIAS_CLAMP_MS, m),
        );
      }
    }
    const windows = tapWindowsForTier(this.spec.tier);
    const matchMs = matchWindowMs(windows, beatMs);

    let best = -1;
    let bestAbs = Infinity;
    targets.forEach((t, i) => {
      if (this.taps.deviations[i] !== null && this.taps.deviations[i] !== undefined) return;
      // Match on the bias-corrected deviation — a systematic lag larger than
      // the match window would otherwise be lost as an "extra" before the
      // grading correction could ever see it.
      const dev = atMs - t - this.tapBiasMs;
      if (Math.abs(dev) < bestAbs) {
        bestAbs = Math.abs(dev);
        best = i;
      }
    });
    if (best >= 0 && bestAbs <= matchMs) {
      this.taps.deviations[best] = atMs - targets[best]; // stored raw
      const corrected = atMs - targets[best] - this.tapBiasMs;
      // Swung offbeat tap leaning at least halfway back toward the straight
      // position → name the failure mode, don't just say "early".
      let tooStraight = false;
      if (expected.swingRatio && isOffbeatEighth(expected.beats[best])) {
        const split = expected.swingRatio / (expected.swingRatio + 1);
        const straightGapMs = (split - 0.5) * beatMs;
        tooStraight = corrected <= -straightGapMs / 2;
      }
      return {
        kind: 'graded',
        grade: gradeTiming(corrected, windows, matchMs),
        deviationMs: Math.round(corrected),
        ...(tooStraight ? { tooStraight } : {}),
      };
    }
    this.taps.extras += 1;
    return { kind: 'extra' };
  }

  private evaluateTaps(
    prompt: ExercisePrompt,
    expected: Extract<ExercisePrompt['expected'], { kind: 'taps' }>,
  ): ReturnType<ExerciseEngine['feed']> {
    const beatMs = 60_000 / expected.bpm;
    const windows = tapWindowsForTier(this.spec.tier);
    const matchMs = matchWindowMs(windows, beatMs);

    const matched = expected.beats
      .map((_, i) => this.taps.deviations[i] ?? null)
      .filter((d): d is number => d !== null);
    // Grade with the bias learned from PREVIOUS prompts subtracted; report
    // raw deviations so the histogram still shows the true offset.
    const goodOrBetter = matched.filter((d) =>
      ['perfect', 'great', 'good'].includes(gradeTiming(d - this.tapBiasMs, windows, matchMs)),
    ).length;
    const denominator = expected.beats.length + this.taps.extras;
    const scorePct = denominator === 0 ? 0 : goodOrBetter / denominator;

    // Update the take's bias estimate for the next prompt. On swung prompts
    // the estimate uses ONBEAT taps only — feeding offbeat error into it would
    // forgive swing-flattening, the exact failure mode being graded (doc 09 §4).
    const biasSamples = expected.beats
      .map((b, i) => ({ beat: b, dev: this.taps.deviations[i] ?? null }))
      .filter((x): x is { beat: number; dev: number } => x.dev !== null)
      .filter((x) => !expected.swingRatio || !isOffbeatEighth(x.beat))
      .map((x) => x.dev);
    if (biasSamples.length >= TAP_BIAS_MIN_SAMPLES) {
      const rawMean = biasSamples.reduce((s, d) => s + d, 0) / biasSamples.length;
      this.tapBiasMs = Math.max(-TAP_BIAS_CLAMP_MS, Math.min(TAP_BIAS_CLAMP_MS, rawMean));
    }

    // Swung prompts carry measured ratio evidence (deviations are stored
    // relative to the swung targets, which is what swingReport expects).
    let swing: ExerciseSwing | undefined;
    if (expected.swingRatio) {
      swing = swingReport({
        events: expected.beats.map((b, i) => ({
          id: `tap${i}`,
          pitches: [0],
          startBeat: b,
          durationBeats: 0.5,
          hand: 'right' as const,
        })),
        perNoteGrades: expected.beats.map((_b, i) => ({
          noteEventId: `tap${i}`,
          grade: 'good' as const,
          deviationMs: this.taps.deviations[i] ?? null,
          pitchCorrect: true,
        })),
        beatMs,
        bpm: expected.bpm,
        beatsPerBar: expected.beatsPerBar,
        ratio: expected.swingRatio,
      });
    }

    return this.finishPrompt(prompt, {
      correct: scorePct >= TAPS_PASS_PCT,
      scorePct,
      deviationsMs: matched,
      ...(swing ? { swing } : {}),
      detail:
        this.taps.extras > 0
          ? `${goodOrBetter}/${expected.beats.length} in time, ${this.taps.extras} extra tap${this.taps.extras === 1 ? '' : 's'}`
          : `${goodOrBetter}/${expected.beats.length} in time`,
    });
  }

  // ── Sequencing ─────────────────────────────────────────────────────────────

  private resetPromptState(): void {
    this.promptShownAt = null;
    this.collected = new Set();
    this.collectedPitches = [];
    this.taps = { deviations: [], extras: 0 };
    this.countInDevs = [];
    this.countInBiasApplied = false;
    this.lastTapAtMs = null;
  }

  private finishPrompt(
    prompt: ExercisePrompt,
    partial: Omit<PromptResult, 'promptId'>,
  ): ReturnType<ExerciseEngine['feed']> {
    const promptResult: PromptResult = { promptId: prompt.id, ...partial };
    this.results.push(promptResult);
    this.index += 1;
    this.resetPromptState();
    if (this.index >= this.spec.prompts.length) {
      this.finished = true;
      return { promptResult, done: this.buildResult() };
    }
    return { promptResult };
  }

  private buildResult(): ExerciseResult {
    const correctCount = this.results.filter((r) => r.correct).length;
    const scorePct =
      this.results.length === 0
        ? 0
        : this.results.reduce((a, r) => a + r.scorePct, 0) / this.results.length;

    const allDeviations = this.results.flatMap((r) => r.deviationsMs ?? []);
    const hasTaps = this.results.some((r) => r.deviationsMs !== undefined);

    // Pool swing evidence across prompts, weighted by pair count.
    const swings = this.results
      .map((r) => r.swing)
      .filter((s): s is ExerciseSwing => s !== undefined);
    let swing: ExerciseSwing | undefined;
    if (swings.length > 0) {
      const pairs = swings.reduce((a, s) => a + s.offbeatPairs, 0);
      const flattening = swings.find((s) => s.flattening)?.flattening;
      swing = {
        measuredRatio:
          Math.round(
            (swings.reduce((a, s) => a + s.measuredRatio * s.offbeatPairs, 0) / pairs) * 100,
          ) / 100,
        inBandPct: swings.reduce((a, s) => a + s.inBandPct * s.offbeatPairs, 0) / pairs,
        offbeatPairs: pairs,
        ...(flattening ? { flattening } : {}),
      };
    }

    return {
      lessonId: this.spec.lessonId,
      exerciseType: this.spec.exerciseType,
      promptCount: this.results.length,
      correctCount,
      scorePct,
      goodOrBetterPct: hasTaps ? scorePct : undefined,
      timingHistogram: hasTaps ? buildHistogram(allDeviations) : undefined,
      ...(swing ? { swing } : {}),
      details: this.results,
    };
  }
}
