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
