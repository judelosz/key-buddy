/**
 * ExerciseRunner — the impure shell around the pure ExerciseEngine (the
 * exercise counterpart of PlaySession). Wires the calibrated input stream and
 * the audio service to the engine: plays ear prompts, runs the metronome for
 * tap prompts, and feeds timestamped ResponseEvents.
 */
import { audioService } from '@/audio/audioService';
import { inputService } from '@/input';
import type { Feel } from '@/core/types';
import { applySwing, applySwingDuration } from '@/core/scoring/swing';
import { ExerciseEngine, type TapFeedback } from '@/core/exercise/engine';
import type {
  ExercisePrompt,
  ExerciseResult,
  ExerciseSpec,
  PromptResult,
} from '@/core/exercise/types';

export interface ExerciseRunnerCallbacks {
  /** Engine state changed (prompt advanced) — re-render. */
  onChange: () => void;
  onPromptResult: (r: PromptResult) => void;
  onDone: (r: ExerciseResult) => void;
  /** Live per-tap verdict (rhythm-tap prompts) — drives the on-time pill. */
  onTapFeedback?: (f: TapFeedback) => void;
}

/** Prompt-audio timers fire this far ahead of each note's due time; the note
 * itself is still placed on the audio clock, so rhythm cells stay precise
 * while cancellation can catch everything not yet handed to the context. */
const PROMPT_AUDIO_LOOKAHEAD_MS = 120;

export class ExerciseRunner {
  readonly engine: ExerciseEngine;
  private offNote: (() => void) | null = null;
  private offTick: (() => void) | null = null;
  private disposed = false;
  /** True while a taps prompt is running its metronome. */
  tapsRunning = false;
  /** Pending setTimeout ids for the current prompt's scheduled audio. */
  private promptAudioTimers: number[] = [];
  /**
   * Set after a CHOICE prompt is answered: the runner holds here — no next
   * prompt armed, no audio started, results not delivered — until the learner
   * continues from the per-question review screen. `done` is carried when the
   * answered question was the last one.
   */
  pendingReview: { prompt: ExercisePrompt; result: PromptResult; done?: ExerciseResult } | null =
    null;

  constructor(
    readonly spec: ExerciseSpec,
    private readonly cb: ExerciseRunnerCallbacks,
  ) {
    this.engine = new ExerciseEngine(spec);
  }

  /** Start listening and arm the first prompt. */
  begin(): void {
    this.offNote = inputService.onNote((note) => {
      // Taps prompts start on the player's OWN first tap — hands already in
      // position, the count-in launches from them, not from a mouse click.
      // That launch tap is consumed (never scored, never an extra).
      const prompt = this.currentPrompt;
      if (prompt?.expected.kind === 'taps' && !this.tapsRunning) {
        void this.startTaps();
        return;
      }
      this.handle(this.engine.feed({ kind: 'note', note }));
    });
    this.armPrompt();
  }

  get currentPrompt(): ExercisePrompt | null {
    return this.engine.currentPrompt;
  }

  submitChoice(index: number): void {
    this.handle(this.engine.feed({ kind: 'choice', index, atMs: performance.now() }));
  }

  /** Evaluate an accumulating prompt now (chord "Check" button). */
  commit(): void {
    this.handle(this.engine.feed({ kind: 'commit', atMs: performance.now() }));
  }

  markWatched(): void {
    this.handle(this.engine.feed({ kind: 'watch-complete', atMs: performance.now() }));
  }

  /**
   * Play a prompt's ear material (defaults to the current prompt; the review
   * screen replays the ANSWERED one). Notes are placed on the audio clock for
   * precision, but each is dispatched by a short-lookahead timer so
   * `cancelPromptAudio` can stop a riff mid-flight — an answered question must
   * never bleed its audio into the next one.
   */
  async playPromptAudio(prompt: ExercisePrompt | null = this.currentPrompt): Promise<void> {
    if (!prompt?.audio) return;
    await audioService.init();
    if (this.disposed) return;
    this.cancelPromptAudio();
    const startPerfMs = performance.now() + 150;
    let offsetSec = 0;
    for (const chord of prompt.audio) {
      const dur = chord.durationSec ?? 1;
      const duePerfMs = startPerfMs + offsetSec * 1000;
      const fireInMs = Math.max(0, duePerfMs - PROMPT_AUDIO_LOOKAHEAD_MS - performance.now());
      const timer = window.setTimeout(() => {
        const at = audioService.perfMsToAudioTime(duePerfMs);
        chord.pitches.forEach((p, i) => {
          const stagger = chord.arpeggiate ? i * 0.22 : 0;
          audioService.playNote(p, dur, 0.85, at + stagger);
        });
      }, fireInMs);
      this.promptAudioTimers.push(timer);
      // Rhythm cells (feel-id) set gapAfterSec 0 so durationSec alone carries
      // the timing; discrete ear prompts keep the default breathing gap.
      offsetSec += dur + (chord.gapAfterSec ?? 0.25);
    }
  }

  /** Stop the current prompt's audio: clear unfired timers, release the rest. */
  private cancelPromptAudio(): void {
    for (const t of this.promptAudioTimers) window.clearTimeout(t);
    this.promptAudioTimers = [];
    if (audioService.isInitialized) audioService.stopAllNotes();
  }

  /**
   * Run a taps prompt: start the metronome, anchor the engine's beat grid on
   * the first click, and commit after the pattern (plus a grace beat) ends.
   */
  async startTaps(): Promise<void> {
    const prompt = this.currentPrompt;
    if (!prompt || prompt.expected.kind !== 'taps' || this.tapsRunning) return;
    const expected = prompt.expected;
    // Guard BEFORE the async init so two quick taps can't double-start.
    this.tapsRunning = true;
    this.cb.onChange();
    await audioService.init();

    const totalBeats =
      expected.countInBeats + Math.max(...expected.beats, 0) + 1.5;
    let anchored = false;
    this.offTick = audioService.onTick((tick) => {
      if (!anchored && tick.beat === 0) {
        anchored = true;
        this.engine.feed({ kind: 'prompt-shown', atMs: tick.perfMs });
      }
      if (tick.beat >= totalBeats) {
        this.stopTaps();
        this.handle(this.engine.feed({ kind: 'commit', atMs: performance.now() }));
      }
    });
    audioService.startMetronome(expected.bpm, expected.beatsPerBar);
  }

  private stopTaps(): void {
    this.offTick?.();
    this.offTick = null;
    if (this.tapsRunning) {
      this.tapsRunning = false;
      audioService.stopMetronome();
    }
  }

  private armPrompt(): void {
    const prompt = this.currentPrompt;
    if (!prompt) return;
    // Taps anchor on the metronome instead; everything else anchors now.
    if (prompt.expected.kind !== 'taps') {
      this.engine.feed({ kind: 'prompt-shown', atMs: performance.now() });
    }
    if (prompt.audio) void this.playPromptAudio();
    this.cb.onChange();
  }

  private handle(out: ReturnType<ExerciseEngine['feed']>): void {
    if (this.disposed) return;
    if (out.tapFeedback) {
      this.cb.onTapFeedback?.(out.tapFeedback);
      if (import.meta.env.DEV) {
        // Dev-only tap trace (window.__tapDebug) — how each tap was classified.
        const w = window as unknown as { __tapDebug?: unknown[] };
        (w.__tapDebug ??= []).push({ ...out.tapFeedback, at: Math.round(performance.now()) });
      }
    }
    if (out.promptResult) {
      // Choice prompts pause on a per-question review screen: cut the riff the
      // moment the answer lands, show verdict + "Explain my answer", and only
      // move on (or deliver the final result) when the learner continues.
      const answered = this.spec.prompts.find((p) => p.id === out.promptResult!.promptId);
      if (answered?.expected.kind === 'choice') {
        this.cancelPromptAudio();
        this.pendingReview = { prompt: answered, result: out.promptResult, done: out.done };
        this.cb.onPromptResult(out.promptResult);
        this.cb.onChange();
        return;
      }
    }
    if (out.promptResult) this.cb.onPromptResult(out.promptResult);
    if (out.done) {
      this.stopTaps();
      this.cb.onDone(out.done);
      return;
    }
    if (out.promptResult) this.armPrompt();
  }

  /** Leave the per-question review: arm the next prompt, or deliver the
   * lesson result if the reviewed question was the last one. */
  continueAfterReview(): void {
    const review = this.pendingReview;
    if (!review || this.disposed) return;
    this.pendingReview = null;
    if (review.done) {
      this.cb.onDone(review.done);
      return;
    }
    this.armPrompt();
  }

  dispose(): void {
    this.disposed = true;
    this.offNote?.();
    this.offNote = null;
    this.cancelPromptAudio();
    this.stopTaps();
  }
}

/**
 * Play a chart/fragment's notes once at the given tempo (for listen lessons)
 * without touching the Transport. Returns the total duration in ms.
 */
export async function playNotesOnce(
  notes: ReadonlyArray<{ pitches: number[]; startBeat: number; durationBeats: number }>,
  bpm: number,
  feel?: Feel,
): Promise<number> {
  await audioService.init();
  const beatSec = 60 / bpm;
  const startAudio = audioService.perfMsToAudioTime(performance.now()) + 0.2;
  let endBeat = 0;
  for (const n of notes) {
    const startBeat = applySwing(feel, n.startBeat);
    const durationBeats = applySwingDuration(feel, n.startBeat, n.durationBeats);
    const dur = Math.max(0.15, durationBeats * beatSec * 0.9);
    for (const p of n.pitches) {
      audioService.playNote(p, dur, 0.85, startAudio + startBeat * beatSec);
    }
    endBeat = Math.max(endBeat, startBeat + durationBeats);
  }
  return (endBeat * beatSec + 0.5) * 1000;
}
