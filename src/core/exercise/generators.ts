/**
 * Exercise generators — turn a CurriculumLesson's generatorParams into a
 * deterministic ExerciseSpec. Pure: randomness is injected (`rand` returns
 * 0–1) so tests and replays are reproducible.
 */
import type { Tier } from '@/core/types';
import type { CurriculumLesson, TheoryConcept } from '@/core/curriculum/types';
import { midiToName, nameToPitchClass, parseChordSymbol, voiceChord } from '@/core/music';
import { DEFAULT_KEYBOARD_RANGE, displayRange, octaveRange } from '@/core/pianoLayout';
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
    // Per-choice: what the heard chord was vs. what each other quality WOULD
    // have sounded like — ear discrimination is the lesson.
    const heard = QUALITY_SIGNATURES[quality];
    const choiceExplanations = qualities.map((q) =>
      q === quality
        ? `Yes — ${heard} That's the ${QUALITY_LABELS[q].toLowerCase()} signature.`
        : `Not ${QUALITY_LABELS[q].toLowerCase()} — that would sound ${QUALITY_CONTRAST[q]}, and ${heard.toLowerCase()}`,
    );
    return {
      id: `${lesson.id}-p${i}`,
      displayText: 'Listen — what kind of chord is that?',
      audio,
      choices,
      choiceExplanations,
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

/** What each quality sounds like (correct-answer framing). */
const QUALITY_SIGNATURES: Record<string, string> = {
  major: 'This one rang bright and settled.',
  minor: 'This one sat darker — the middle note a half-step low.',
  dom7: 'This one had an extra, buzzier note leaning on top.',
  dim: 'This one sounded tense and unstable, like it needs to move.',
};

/** What each quality WOULD sound like (wrong-answer contrast framing). */
const QUALITY_CONTRAST: Record<string, string> = {
  major: 'bright and settled',
  minor: 'darker in the middle',
  dom7: 'buzzier, with a leaning extra note',
  dim: 'tense and unstable',
};

/** params: { beats: number[], bpm: number, countInBeats?, beatsPerBar?, reps?, swingRatio? } */
function rhythmTap(lesson: CurriculumLesson): ExercisePrompt[] {
  const p = lesson.generatorParams ?? {};
  const beats = numArray(p.beats);
  const bpm = num(p.bpm, 80);
  const countInBeats = num(p.countInBeats, 4);
  const beatsPerBar = num(p.beatsPerBar, 4);
  const reps = num(p.reps, 1);
  // Swung echo prompts (doc 09 §7): offbeat targets shift to the ratio split
  // and the result carries measured swing evidence.
  const swingRatio = typeof p.swingRatio === 'number' ? p.swingRatio : undefined;
  return Array.from({ length: reps }, (_, i) => ({
    id: `${lesson.id}-p${i}`,
    displayText: str(
      p.promptText,
      swingRatio
        ? 'Tap the long-short shuffle — LONG on the click, short on the "and"'
        : 'Tap along — any key, right on the click',
    ),
    expected: {
      kind: 'taps' as const,
      beats,
      bpm,
      countInBeats,
      beatsPerBar,
      ...(swingRatio ? { swingRatio } : {}),
    },
    explanation: swingRatio
      ? 'Say "doo-dah, doo-dah" with the click — the first of each pair is twice as long.'
      : 'Listen to the count-in, then land your taps with the click.',
  }));
}

// ─── Feel identification (doc 09 §7: teach the feel before grading it) ───────

/**
 * Blues-flavored one-bar ear cells — 8 straight eighths each, all alternating
 * onbeat/offbeat so the swing transform reshapes every pair. A pool (plus
 * register and tempo variation) keeps the mission from droning one riff
 * (test-window feedback); the two cells WITHIN a prompt always share cell,
 * register, and tempo so the only difference to hear is the lean.
 */
const FEEL_CELLS: readonly (readonly number[])[] = [
  [48, 55, 48, 57, 48, 55, 48, 57], // shuffle-bass rock on C (root-5 / root-6)
  [41, 48, 41, 50, 41, 48, 41, 50], // the same rock on F
  [48, 52, 55, 57, 60, 57, 55, 52], // boogie arpeggio, up and back
  [60, 63, 65, 67, 70, 67, 65, 63], // C minor pentatonic climb
  [72, 70, 67, 65, 63, 65, 62, 60], // descending blues answer phrase
];
const FEEL_ID_BPMS = [80, 88, 96];
/** Keep transposed cells inside the sampled piano's comfortable range. */
const FEEL_CELL_TRANSPOSE_CEILING = 79;

/** Render a cell at a swing ratio as gapless AudioChords (timing lives in
 * durationSec; gapAfterSec 0). ratio 1 = straight. */
function feelCellAudio(
  cell: readonly number[],
  ratio: number,
  bpm: number,
  transpose: number,
  gapAfterSec = 0,
): AudioChord[] {
  const beatSec = 60 / bpm;
  const split = ratio / (ratio + 1);
  return cell.map((pitch, i) => ({
    pitches: [pitch + transpose],
    durationSec: (i % 2 === 1 ? 1 - split : split) * beatSec,
    gapAfterSec: i === cell.length - 1 ? gapAfterSec : 0,
  }));
}

/** Swing-dial comparison ratios (doc-08 2.11): subtle → target → hard. */
const DIAL_RATIOS = [1.5, 2, 3];

/**
 * A/B and swing-dial feel identification.
 * params: { variant: 'ab' | 'dial', count?, bpm? }
 *  - 'ab':   the same cell twice — once straight, once swung — "which swings?"
 *  - 'dial': the cell at two different swing ratios — "which swings harder?"
 * Each prompt draws its own cell, register, and tempo (bpm param pins tempo).
 */
function feelId(lesson: CurriculumLesson, rand: Rand): ExercisePrompt[] {
  const p = lesson.generatorParams ?? {};
  const variant = str(p.variant, 'ab');
  const count = num(p.count, 6);
  const pinnedBpm = typeof p.bpm === 'number' ? p.bpm : undefined;
  const betweenSec = 0.9;

  // Cycle the cell pool so a 6-prompt mission never repeats before it must.
  const cells = sampleCycle(FEEL_CELLS, count, rand);

  return Array.from({ length: count }, (_, i) => {
    const cell = cells[i];
    const bpm = pinnedBpm ?? FEEL_ID_BPMS[Math.floor(rand() * FEEL_ID_BPMS.length)];
    const canTranspose = Math.max(...cell) + 12 <= FEEL_CELL_TRANSPOSE_CEILING;
    const transpose = canTranspose && rand() < 0.4 ? 12 : 0;
    const cellAt = (ratio: number, gap = 0) => feelCellAudio(cell, ratio, bpm, transpose, gap);

    if (variant === 'dial') {
      const [a, b] = shuffled(DIAL_RATIOS, rand).slice(0, 2);
      const harderFirst = a > b;
      return {
        id: `${lesson.id}-p${i}`,
        displayText: 'Two shuffles — which one swings harder?',
        audio: [...cellAt(a, betweenSec), ...cellAt(b)],
        choices: ['The first', 'The second'],
        choiceExplanations: harderFirst
          ? [
              'Yes — the first leaned harder: its LONG-shorts were more lopsided, closer to a skip.',
              'The second was the gentler one — its pairs were more even, a lighter lean.',
            ]
          : [
              'The first was the gentler one — its pairs were more even, a lighter lean.',
              'Yes — the second leaned harder: its LONG-shorts were more lopsided, closer to a skip.',
            ],
        expected: { kind: 'choice' as const, answerIndex: harderFirst ? 0 : 1 },
        explanation:
          'Both swung — listen for HOW lopsided the long-short pairs are, not whether they lean.',
      };
    }
    const swungFirst = rand() < 0.5;
    return {
      id: `${lesson.id}-p${i}`,
      displayText: 'The same riff twice — which one swings?',
      audio: swungFirst
        ? [...cellAt(2, betweenSec), ...cellAt(1)]
        : [...cellAt(1, betweenSec), ...cellAt(2)],
      choices: ['The first', 'The second'],
      choiceExplanations: swungFirst
        ? [
            'Yes — the first skipped along in LONG-short pairs ("doo-dah"); that lean is the swing.',
            'The second walked evenly — every eighth the same length. Straight, not swung.',
          ]
        : [
            'The first walked evenly — every eighth the same length. Straight, not swung.',
            'Yes — the second skipped along in LONG-short pairs ("doo-dah"); that lean is the swing.',
          ],
      expected: { kind: 'choice' as const, answerIndex: swungFirst ? 0 : 1 },
      explanation:
        'Swing pairs the eighths LONG-short ("doo-dah"); straight eighths are all the same length.',
    };
  });
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
    choiceExplanations: q.choiceExplanations,
    expected: { kind: 'choice' as const, answerIndex: q.answerIndex },
    explanation: q.explanation,
  }));
}

/**
 * Beginner pitch-direction / same-different ear training.
 * params: { variant: 'direction' | 'same-different', count?: number }
 */
function intervalEar(lesson: CurriculumLesson, rand: Rand): ExercisePrompt[] {
  const p = lesson.generatorParams ?? {};
  const variant = str(p.variant, 'direction');
  const count = num(p.count, 6);
  const base = 60; // around middle C
  return Array.from({ length: count }, (_, i) => {
    const first = base + Math.floor(rand() * 5);
    if (variant === 'same-different') {
      const same = rand() < 0.5;
      const second = same ? first : first + (rand() < 0.5 ? -1 : 1) * (2 + Math.floor(rand() * 4));
      return {
        id: `${lesson.id}-p${i}`,
        displayText: 'Two notes — are they the same or different?',
        audio: [
          { pitches: [first], durationSec: 0.7 },
          { pitches: [second], durationSec: 0.7 },
        ],
        choices: ['Same', 'Different'],
        choiceExplanations: same
          ? [
              'They matched exactly — same key, same sound.',
              'Nothing moved — a "different" pair would change in height between the two notes.',
            ]
          : [
              'They didn\'t match — the second note changed height; "same" would sound like one note twice.',
              'The second note moved — that change in height is what "different" means.',
            ],
        expected: { kind: 'choice' as const, answerIndex: same ? 0 : 1 },
        explanation: same
          ? 'They matched exactly — same key, same sound.'
          : 'The second note moved — listen for the change in height.',
      };
    }
    const up = rand() < 0.5;
    const interval = 2 + Math.floor(rand() * 6); // 2–7 semitones, clearly audible
    const second = up ? first + interval : first - interval;
    return {
      id: `${lesson.id}-p${i}`,
      displayText: 'Two notes — did the second one go up or down?',
      audio: [
        { pitches: [first], durationSec: 0.7 },
        { pitches: [second], durationSec: 0.7 },
      ],
      choices: ['Up', 'Down'],
      choiceExplanations: up
        ? [
            'It climbed — the second note sounded higher, which lives to the right on the keyboard.',
            'Not down — a falling pair would sound like the second note sinking lower, and this one rose.',
          ]
        : [
            'Not up — a rising pair would sound like the second note lifting higher, and this one sank.',
            'It fell — the second note sounded lower, which lives to the left on the keyboard.',
          ],
      expected: { kind: 'choice' as const, answerIndex: up ? 0 : 1 },
      explanation: up
        ? 'It climbed — higher sounds sit to the right of the keyboard.'
        : 'It fell — lower sounds sit to the left of the keyboard.',
    };
  });
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

/**
 * The exercise's on-screen keyboard window. An authored
 * generatorParams.lowPitch/highPitch override wins (octave-aligned as given);
 * otherwise derive from any absolute pitches the exercise involves, never
 * narrower than the app-wide default (keyboard grading is octave-agnostic, so
 * every visible octave is a valid answer).
 */
function keyboardRangeFor(
  lesson: CurriculumLesson,
  prompts: readonly ExercisePrompt[],
): { low: number; high: number } {
  const p = lesson.generatorParams ?? {};
  if (typeof p.lowPitch === 'number' && typeof p.highPitch === 'number') {
    return octaveRange(p.lowPitch, p.highPitch);
  }
  const pitches = prompts.flatMap((pr) => pr.audio?.flatMap((a) => a.pitches) ?? []);
  if (pitches.length === 0) return { ...DEFAULT_KEYBOARD_RANGE };
  return displayRange(Math.min(...pitches), Math.max(...pitches));
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
    case 'feel-id':
      prompts = feelId(lesson, rand);
      break;
    case 'interval-ear':
      prompts = intervalEar(lesson, rand);
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
  return {
    lessonId: lesson.id,
    exerciseType: lesson.exerciseType,
    tier: ctx.tier,
    prompts,
    keyboardRange: keyboardRangeFor(lesson, prompts),
  };
}
