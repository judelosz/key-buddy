/**
 * ExerciseRunner — the impure shell around the pure ExerciseEngine (the
 * exercise counterpart of PlaySession). Wires the calibrated input stream and
 * the audio service to the engine: plays ear prompts, runs the metronome for
 * tap prompts, and feeds timestamped ResponseEvents.
 */
import { audioService } from '@/audio/audioService';
import { inputService } from '@/input';
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

export class ExerciseRunner {
  readonly engine: ExerciseEngine;
  private offNote: (() => void) | null = null;
  private offTick: (() => void) | null = null;
  private disposed = false;
  /** True while a taps prompt is running its metronome. */
  tapsRunning = false;

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

  /** Play the current prompt's ear material (replay any time). */
  async playPromptAudio(): Promise<void> {
    const prompt = this.currentPrompt;
    if (!prompt?.audio) return;
    await audioService.init();
    const startAudio = audioService.perfMsToAudioTime(performance.now()) + 0.15;
    let offset = 0;
    for (const chord of prompt.audio) {
      const dur = chord.durationSec ?? 1;
      chord.pitches.forEach((p, i) => {
        const stagger = chord.arpeggiate ? i * 0.22 : 0;
        audioService.playNote(p, dur, 0.85, startAudio + offset + stagger);
      });
      offset += dur + 0.25;
    }
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
    if (out.tapFeedback) this.cb.onTapFeedback?.(out.tapFeedback);
    if (out.promptResult) this.cb.onPromptResult(out.promptResult);
    if (out.done) {
      this.stopTaps();
      this.cb.onDone(out.done);
      return;
    }
    if (out.promptResult) this.armPrompt();
  }

  dispose(): void {
    this.disposed = true;
    this.offNote?.();
    this.offNote = null;
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
): Promise<number> {
  await audioService.init();
  const beatSec = 60 / bpm;
  const startAudio = audioService.perfMsToAudioTime(performance.now()) + 0.2;
  let endBeat = 0;
  for (const n of notes) {
    const dur = Math.max(0.15, n.durationBeats * beatSec * 0.9);
    for (const p of n.pitches) {
      audioService.playNote(p, dur, 0.85, startAudio + n.startBeat * beatSec);
    }
    endBeat = Math.max(endBeat, n.startBeat + n.durationBeats);
  }
  return (endBeat * beatSec + 0.5) * 1000;
}
