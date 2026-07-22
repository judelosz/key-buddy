/**
 * Exercise engine domain (Phase 4): pure prompt/response shapes shared by the
 * generators, the ExerciseEngine state machine, and the UI runner. The engine
 * never touches audio, input, or timers — the runner feeds it ResponseEvents
 * with timestamps and plays ExercisePrompt.audio itself.
 */
import type { NotePlayed, Pitch, Tier, TimingHistogram } from '@/core/types';
import type { ExerciseType } from '@/core/curriculum/types';

/** A chord (or single note) the runner plays for ear prompts. */
export interface AudioChord {
  pitches: Pitch[];
  arpeggiate?: boolean;
  durationSec?: number;
}

export type ExpectedAnswer =
  /** Play any key of this pitch class (octave-agnostic). */
  | { kind: 'pitch'; pitchClass: number }
  /** Play exactly this set of pitch classes (any inversion/octave, no extras). */
  | { kind: 'pitch-set'; pitchClasses: number[]; collectWindowMs: number }
  /** Pick a choice button. */
  | { kind: 'choice'; answerIndex: number }
  /** Tap this beat pattern against the metronome (beats relative to bar 0). */
  | { kind: 'taps'; beats: number[]; bpm: number; countInBeats: number; beatsPerBar: number }
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
  details: PromptResult[];
}
