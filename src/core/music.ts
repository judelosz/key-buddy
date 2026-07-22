/** Small music helpers shared across UI and scoring display. */

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note number → scientific pitch name, e.g. 60 → "C4". */
export function midiToName(pitch: number): string {
  const name = NAMES[((pitch % 12) + 12) % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}${octave}`;
}

/** True for the black keys (C#, D#, F#, G#, A#). */
export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}

const PITCH_CLASSES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/** Note name (no octave), e.g. "C", "F#", "Bb" → pitch class 0–11. */
export function nameToPitchClass(name: string): number | null {
  return PITCH_CLASSES[name] ?? null;
}

export type ChordQuality = 'major' | 'minor' | 'dom7' | 'dim';

const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  dim: [0, 3, 6],
};

export interface ParsedChord {
  rootPc: number;
  quality: ChordQuality;
  pitchClasses: number[];
}

/**
 * Parse the chord symbols the early curriculum uses: C, F, G, Dm, G7, Bdim.
 * Returns null for anything richer (extensions arrive with later tiers).
 */
export function parseChordSymbol(symbol: string): ParsedChord | null {
  const m = /^([A-G][#b]?)(m|7|dim)?$/.exec(symbol.trim());
  if (!m) return null;
  const rootPc = nameToPitchClass(m[1]);
  if (rootPc === null) return null;
  const quality: ChordQuality =
    m[2] === 'm' ? 'minor' : m[2] === '7' ? 'dom7' : m[2] === 'dim' ? 'dim' : 'major';
  return {
    rootPc,
    quality,
    pitchClasses: QUALITY_INTERVALS[quality].map((i) => (rootPc + i) % 12),
  };
}

/** Chord tones as MIDI pitches voiced upward from the root at/above `fromPitch`. */
export function voiceChord(parsed: ParsedChord, fromPitch: number): number[] {
  const base = fromPitch + ((parsed.rootPc - fromPitch) % 12 + 12) % 12;
  return QUALITY_INTERVALS[parsed.quality].map((i) => base + i);
}
