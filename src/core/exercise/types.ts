/**
 * Exercise engine domain (Phase 4): pure prompt/response shapes shared by the
 * generators, the ExerciseEngine state machine, and the UI runner. The engine
 * never touches audio, input, or timers — the runner feeds it ResponseEvents
 * with timestamps and plays ExercisePrompt.audio itself.
 */
import type { Attempt, NotePlayed, Pitch, Tier, TimingHistogram } from '@/core/types';
import type { ExerciseType } from '@/core/curriculum/types';

/** Measured swing evidence (doc 09) — same shape as Attempt.swing. */
export type ExerciseSwing = NonNullable<Attempt['swing']>;

/** A chord (or single note) the runner plays for ear prompts. */
export interface AudioChord {
  pitches: Pitch[];
  arpeggiate?: boolean;
  durationSec?: number;
  /** Silence inserted after this chord before the next one (default 0.25 s).
   * Rhythm cells (feel-id) set 0 so durationSec alone carries the timing. */
  gapAfterSec?: number;
}

export type ExpectedAnswer =
  /** Play any key of this pitch class (octave-agnostic). */
  | { kind: 'pitch'; pitchClass: number }
  /** Play exactly this set of pitch classes (any inversion/octave, no extras). */
  | { kind: 'pitch-set'; pitchClasses: number[]; collectWindowMs: number }
  /** Pick a choice button. */
  | { kind: 'choice'; answerIndex: number }
  /** Tap this beat pattern against the metronome (beats relative to bar 0).
   * `swingRatio` (doc 09) marks a swung prompt: offbeat-eighth targets shift
   * to the ratio split, bias learns from onbeat taps only, and the result
   * carries measured swing evidence. */
  | {
      kind: 'taps';
      beats: number[];
      bpm: number;
      countInBeats: number;
      beatsPerBar: number;
      swingRatio?: number;
    }
  /** Just watch/listen (completion = engagement). */
  | { kind: 'watch' };

export interface ExercisePrompt {
  id: string;
  /** Learner-facing instruction, e.g. "Find and play E". */
  displayText?: string;
  /** Ear material the runner plays (replay always allowed). */
  audio?: AudioChord[];
  /** Labels for 'choice' answers. */
  choices?: string[];
  /** One line per choice (aligned with `choices`): why the right one is right
   * and why each wrong one is wrong. RULE (2026-07-23): every choice prompt —
   * authored or generated — must provide these; they power the learner-facing
   * "Explain my answer" panel. */
  choiceExplanations?: string[];
  expected: ExpectedAnswer;
  /** Shown after a miss — one calm, specific line (doc 06 §10). */
  explanation?: string;
}

export interface ExerciseSpec {
  lessonId: string;
  exerciseType: ExerciseType;
  tier: Tier;
  prompts: ExercisePrompt[];
  /**
   * On-screen keyboard window for this exercise (whole octaves). Derived from
   * the exercise's own pitches — never narrower than the app-wide default —
   * or authored per lesson via generatorParams.lowPitch/highPitch.
   */
  keyboardRange?: { low: number; high: number };
}

export type ResponseEvent =
  | { kind: 'note'; note: NotePlayed }
  | { kind: 'choice'; index: number; atMs: number }
  /** Anchors the prompt's clock (for taps: the first count-in click). */
  | { kind: 'prompt-shown'; atMs: number }
  /** Ends an accumulating prompt (chord collect window / tap pattern). */
  | { kind: 'commit'; atMs: number }
  | { kind: 'watch-complete'; atMs: number };

export interface PromptResult {
  promptId: string;
  correct: boolean;
  /** Fractional credit (taps use good-or-better share); 1/0 for discrete prompts. */
  scorePct: number;
  /** Signed ms deviations of matched taps (rhythm prompts). */
  deviationsMs?: number[];
  /** What actually happened, for specific feedback ("You played B3"). */
  detail?: string;
  /** Choice prompts: the index the learner picked (drives "Explain my answer"). */
  chosenIndex?: number;
  /** Swung tap prompts: the measured ratio evidence for this prompt. */
  swing?: ExerciseSwing;
}

export interface ExerciseResult {
  lessonId: string;
  exerciseType: ExerciseType;
  promptCount: number;
  correctCount: number;
  /** Mean of per-prompt scorePct — the lesson's pass metric. */
  scorePct: number;
  /** Rhythm prompts only: share of taps with Good-or-better timing. */
  goodOrBetterPct?: number;
  timingHistogram?: TimingHistogram;
  /** Swung tap lessons: pooled swing evidence across prompts (pair-weighted).
   * Consumed by passCriteria.minSwingInBandPct in the lesson reducer. */
  swing?: ExerciseSwing;
  details: PromptResult[];
}
