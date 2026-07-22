/**
 * VirtualKeyboardProvider — an on-screen / computer-key input source that emits
 * the same RawNote stream as a real MIDI device. It makes the app runnable and
 * end-to-end testable without hardware, and is the injection point Playwright
 * uses to simulate deterministic MIDI (build-spec §9).
 *
 * `press()` is the single entry point: the on-screen keyboard, the computer-key
 * handler, and tests all call it. Timestamps use performance.now() to share the
 * audio Transport's clock.
 */
import type { InputProvider, InputStatus, RawNote } from '@/input/inputService';

export class VirtualKeyboardProvider implements InputProvider {
  readonly source = 'virtual' as const;
  private status: InputStatus = { kind: 'no-provider' };
  private readonly noteCbs = new Set<(n: RawNote) => void>();
  private readonly statusCbs = new Set<(s: InputStatus) => void>();

  async start(): Promise<void> {
    this.setStatus({ kind: 'ready', source: 'virtual', deviceName: 'On-screen keyboard' });
  }

  stop(): void {
    this.setStatus({ kind: 'no-provider' });
  }

  /** Inject a note. `timestampMs` defaults to now; tests can pass a fixed value. */
  press(pitch: number, velocity = 90, timestampMs: number = performance.now()): void {
    const note: RawNote = { pitch, velocity, timestampMs };
    for (const cb of this.noteCbs) cb(note);
  }

  onRawNote(cb: (n: RawNote) => void): () => void {
    this.noteCbs.add(cb);
    return () => this.noteCbs.delete(cb);
  }

  getStatus(): InputStatus {
    return this.status;
  }

  onStatusChange(cb: (s: InputStatus) => void): () => void {
    this.statusCbs.add(cb);
    return () => this.statusCbs.delete(cb);
  }

  private setStatus(s: InputStatus): void {
    this.status = s;
    for (const cb of this.statusCbs) cb(s);
  }
}

/**
 * Maps a computer keyboard row to MIDI pitches so a laptop can drive the app.
 * Two rows: Z..M lower octave, Q..P upper octave, starting at C4 (60).
 */
export const COMPUTER_KEY_MAP: Record<string, number> = {
  // lower octave (white keys) C4..
  z: 60, x: 62, c: 64, v: 65, b: 67, n: 69, m: 71,
  // lower octave sharps
  s: 61, d: 63, g: 66, h: 68, j: 70,
  // upper octave (white keys) C5..
  q: 72, w: 74, e: 76, r: 77, t: 79, y: 81, u: 83,
  // upper octave sharps
  '2': 73, '3': 75, '5': 78, '6': 80, '7': 82,
};
