/**
 * Exercise generators — turn a CurriculumLesson's generatorParams into a
 * deterministic ExerciseSpec. Pure: randomness is injected (`rand` returns
 * 0–1) so tests and replays are reproducible.
 */
import type { Tier } from '@/core/types';
import type { CurriculumLesson, TheoryConcept } from '@/core/curriculum/types';
import { midiToName, nameToPitchClass, parseChordSymbol, voiceChord } from '@/core/music';
import type { AudioChord, ExercisePrompt, ExerciseSpec } from './types';

export interface GeneratorContext {
  tier: Tier;
  /** Resolved by the caller for theory-quiz lessons. */
  concept?: TheoryConcept;
}

export type Rand = () => number;

// ─── Sampling helpers ────────────────────────────────────────────────────────

function shuffled<T>(items: readonly T[], rand: Rand): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** n items covering the pool before repeating (shuffle, cycle). */
function sampleCycle<T>(pool: readonly T[], n: number, rand: Rand): T[] {
  const out: T[] = [];
  while (out.length < n) {
    for (const item of shuffled(pool, rand)) {
      if (out.length >= n) break;
      out.push(item);
    }
  }
  return out;
}

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const strArray = (v: unknown): string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : [];
const numArray = (v: unknown): number[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : [];

// ─── Per-type generators ─────────────────────────────────────────────────────

/** params: { noteNames: string[], count?: number } */
function noteId(lesson: CurriculumLesson, rand: Rand): ExercisePrompt[] {
  const p = lesson.generatorParams ?? {};
  const names = strArray(p.noteNames);
  const count = num(p.count, Math.max(3, names.length));
  return sampleCycle(names, count, rand).map((name, i) => {
    const pc = nameToPitchClass(name);
    return {
      id: `${lesson.id}-p${i}`,
      displayText: `Find and play ${name}`,
      expected: { kind: 'pitch' as const, pitchClass: pc ?? 0 },
      explanation: `${name} is the key just left of the group — listen and look for the pattern.`,
    };
  });
}

/** params: { chords: string[], count?: number, collectWindowMs?: number } */
function buildChord(lesson: CurriculumLesson, rand: Rand): ExercisePrompt[] {
  const p = lesson.generatorParams ?? {};
  const chords = strArray(p.chords);
  const count = num(p.count, Math.max(3, chords.length));
  const collectWindowMs = num(p.collectWindowMs, 2000);
  return sampleCycle(chords, count, rand).flatMap((symbol, i) => {
    const parsed = parseChordSymbol(symbol);
    if (!parsed) return [];
    const tones = voiceChord(parsed, 60).map((pitch) => midiToName(pitch).replace(/\d+$/, ''));
    return [
      {
        id: `${lesson.id}-p${i}`,
        displayText: `Play a ${symbol} chord (${tones.join('–')}) — all together or one at a time`,
        expected: {
          kind: 'pitch-set' as const,
          pitchClasses: parsed.pitchClasses,
          collectWindowMs,
        },
        explanation: `${symbol} is built ${tones.join('–')}. Any octave or order counts.`,
      },
    ];
  });
}

const QUALITY_LABELS: Record<string, string> = {
  major: 'Major',
  minor: 'Minor',
  dom7: 'Dominant 7th',
  dim: 'Diminished',
};

/** params: { qualities: string[], roots?: string[], count?: number } */
function chordEar(lesson: CurriculumLesson, rand: Rand): ExercisePrompt[] {
  const p = lesson.generatorParams ?? {};
  const qualities = strArray(p.qualities).filter((q) => q in QUALITY_LABELS);
  const roots = strArray(p.roots);
  const count = num(p.count, 6);
  const choices = qualities.map((q) => QUALITY_LABELS[q]);
  return sampleCycle(qualities, count, rand).map((quality, i) => {
    const rootName = roots.length > 0 ? roots[Math.floor(rand() * roots.length)] : 'C';
    const parsed = parseChordSymbol(
      quality === 'minor' ? `${rootName}m` : quality === 'dom7' ? `${rootName}7` : quality === 'dim' ? `${rootName}dim` : rootName,
    );
    const pitches = parsed ? voiceChord(parsed, 60) : [60, 64, 67];
    const audio: AudioChord[] = [{ pitches, durationSec: 1.6 }];
    return {
      id: `${lesson.id}-p${i}`,
      displayText: 'Listen — what kind of chord is that?',
      audio,
      choices,
      expected: { kind: 'choice' as const, answerIndex: qualities.indexOf(quality) },
      explanation:
        quality === 'dom7'
          ? 'The dominant 7th has an extra, buzzier note on top of the major chord.'
          : quality === 'minor'
            ? 'Minor chords sound darker — the middle note sits a half-step lower.'
            : 'Major chords sound bright and settled.',
    };
  });
}

/** params: { beats: number[], bpm: number, countInBeats?, beatsPerBar?, reps? } */
function rhythmTap(lesson: CurriculumLesson): ExercisePrompt[] {
  const p = lesson.generatorParams ?? {};
  const beats = numArray(p.beats);
  const bpm = num(p.bpm, 80);
  const countInBeats = num(p.countInBeats, 4);
  const beatsPerBar = num(p.beatsPerBar, 4);
  const reps = num(p.reps, 1);
  return Array.from({ length: reps }, (_, i) => ({
    id: `${lesson.id}-p${i}`,
    displayText: str(p.promptText, 'Tap along — any key, right on the click'),
    expected: { kind: 'taps' as const, beats, bpm, countInBeats, beatsPerBar },
    explanation: 'Listen to the count-in, then land your taps with the click.',
  }));
}

/** Samples from the concept's question pool. params: { count?: number } */
function theoryQuiz(
  lesson: CurriculumLesson,
  concept: TheoryConcept | undefined,
  rand: Rand,
): ExercisePrompt[] {
  const pool = concept?.questions ?? [];
  const count = Math.min(num(lesson.generatorParams?.count, 5), pool.length);
  return sampleCycle(pool, count, rand).map((q, i) => ({
    id: `${lesson.id}-p${i}-${q.id}`,
    displayText: q.promptText,
    choices: q.choices,
    expected: { kind: 'choice' as const, answerIndex: q.answerIndex },
    explanation: q.explanation,
  }));
}

function listen(lesson: CurriculumLesson): ExercisePrompt[] {
  return [
    {
      id: `${lesson.id}-p0`,
      displayText: str(lesson.generatorParams?.promptText, 'Watch and listen.'),
      expected: { kind: 'watch' as const },
    },
  ];
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Build the ExerciseSpec for a lesson. Chart/fragment lessons don't come here
 * (they run through PlaySession + the ScoringEngine).
 */
export function generateExercise(
  lesson: CurriculumLesson,
  ctx: GeneratorContext,
  rand: Rand,
): ExerciseSpec {
  let prompts: ExercisePrompt[];
  switch (lesson.exerciseType) {
    case 'note-id':
      prompts = noteId(lesson, rand);
      break;
    case 'build-chord':
      prompts = buildChord(lesson, rand);
      break;
    case 'chord-ear':
      prompts = chordEar(lesson, rand);
      break;
    case 'rhythm-tap':
      prompts = rhythmTap(lesson);
      break;
    case 'theory-quiz':
      prompts = theoryQuiz(lesson, ctx.concept, rand);
      break;
    case 'listen':
      prompts = listen(lesson);
      break;
    default:
      throw new Error(`No generator for exercise type '${lesson.exerciseType}'`);
  }
  if (prompts.length === 0) {
    throw new Error(`Exercise ${lesson.id} generated no prompts — check generatorParams`);
  }
  return { lessonId: lesson.id, exerciseType: lesson.exerciseType, tier: ctx.tier, prompts };
}
