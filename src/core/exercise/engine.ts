/**
 * ExerciseEngine — a pure prompt-sequencing state machine (the exercise
 * counterpart of LiveGrader). The UI runner feeds it timestamped
 * ResponseEvents; it grades each prompt and returns the ExerciseResult when
 * the last prompt finishes. No I/O, timers, or randomness.
 */
import { midiToName } from '@/core/music';
import { buildHistogram } from '@/core/scoring/scoringEngine';
import { gradeTiming } from '@/core/scoring/grade';
import {
  matchWindowMs,
  windowsForTier,
  type TimingWindows,
} from '@/core/scoring/timingWindows';
import type {
  ExercisePrompt,
  ExerciseResult,
  ExerciseSpec,
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

export class ExerciseEngine {
  private index = 0;
  private readonly results: PromptResult[] = [];
  private promptShownAt: number | null = null;
  private collected = new Set<number>();
  private collectedPitches: number[] = [];
  private taps: TapState = { deviations: [], extras: 0 };
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

  feed(e: ResponseEvent): { promptResult?: PromptResult; done?: ExerciseResult } {
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
          this.matchTap(e.note.timestampMs, expected);
          return {};
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
    return expected.beats.map((b) => anchor + (expected.countInBeats + b) * beatMs);
  }

  private matchTap(
    atMs: number,
    expected: Extract<ExercisePrompt['expected'], { kind: 'taps' }>,
  ): void {
    const targets = this.tapTargets(expected);
    const beatMs = 60_000 / expected.bpm;
    // Count-in taps are free. The pulse card invites tapping along with the
    // count-in clicks; those taps land after the anchor but long before the
    // first graded beat, and used to count as score-diluting "extras".
    if (targets.length > 0 && atMs < targets[0] - beatMs / 2) return;
    const windows = tapWindowsForTier(this.spec.tier);
    const matchMs = matchWindowMs(windows, beatMs);

    let best = -1;
    let bestAbs = Infinity;
    targets.forEach((t, i) => {
      if (this.taps.deviations[i] !== null && this.taps.deviations[i] !== undefined) return;
      const dev = atMs - t;
      if (Math.abs(dev) < bestAbs) {
        bestAbs = Math.abs(dev);
        best = i;
      }
    });
    if (best >= 0 && bestAbs <= matchMs) {
      this.taps.deviations[best] = atMs - targets[best];
    } else {
      this.taps.extras += 1;
    }
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
    const goodOrBetter = matched.filter((d) =>
      ['perfect', 'great', 'good'].includes(gradeTiming(d, windows, matchMs)),
    ).length;
    const denominator = expected.beats.length + this.taps.extras;
    const scorePct = denominator === 0 ? 0 : goodOrBetter / denominator;

    return this.finishPrompt(prompt, {
      correct: scorePct >= TAPS_PASS_PCT,
      scorePct,
      deviationsMs: matched,
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

    return {
      lessonId: this.spec.lessonId,
      exerciseType: this.spec.exerciseType,
      promptCount: this.results.length,
      correctCount,
      scorePct,
      goodOrBetterPct: hasTaps ? scorePct : undefined,
      timingHistogram: hasTaps ? buildHistogram(allDeviations) : undefined,
      details: this.results,
    };
  }
}
