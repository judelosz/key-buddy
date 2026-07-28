/**
 * InputService — source-agnostic note input (build-spec §6.1).
 *
 * Providers (MIDI keyboard, on-screen/computer-key virtual keyboard, and later
 * mic §12) emit a RAW note (pitch, velocity, uncalibrated timestamp).
 * InputService applies the one-time calibration offset and re-emits a unified,
 * calibrated `NotePlayed` stream that the ScoringEngine and visualizer consume.
 *
 * MULTIPLE providers can be active at once: the virtual keyboard stays live even
 * when a MIDI device is connected, so a laptop with no keyboard always works and
 * you can mix on-screen + hardware freely.
 *
 * Clock: raw timestamps are in the `performance.now()` domain (Web MIDI's
 * event.timeStamp and our virtual provider both use it), so input and the audio
 * Transport share one monotonic clock.
 */
import type { NotePlayed } from '@/core/types';

/** A note as a provider sees it, before calibration. */
export interface RawNote {
  pitch: number;
  velocity: number;
  timestampMs: number; // performance.now() domain
}

export type InputStatus =
  | { kind: 'no-provider' }
  | { kind: 'connecting' }
  | { kind: 'ready'; source: NotePlayed['source']; deviceName: string }
  | { kind: 'no-device'; message: string }
  | { kind: 'unsupported'; message: string }
  | { kind: 'error'; message: string };

export interface InputProvider {
  readonly source: NotePlayed['source'];
  /** Begin listening; resolves once the provider has settled its status. */
  start(): Promise<void>;
  stop(): void;
  onRawNote(cb: (n: RawNote) => void): () => void;
  getStatus(): InputStatus;
  onStatusChange(cb: (s: InputStatus) => void): () => void;
}

type NoteListener = (n: NotePlayed) => void;
type StatusListener = (s: InputStatus) => void;

/** Same-pitch notes closer than this are one physical press delivered twice
 * (multi-port MIDI controllers). Human same-pitch retriggers are ≥ ~30 ms. */
export const DUPLICATE_NOTE_MS = 10;

interface Entry {
  offNote: () => void;
  offStatus: () => void;
}

export class InputService {
  private readonly entries = new Map<InputProvider, Entry>();
  private offsetMs = 0;
  private readonly noteListeners = new Set<NoteListener>();
  private readonly statusListeners = new Set<StatusListener>();
  /** Per-pitch last raw-emit time, for multi-port duplicate suppression. */
  private readonly lastEmitByPitch = new Map<number, number>();

  /** Latency offset (ms) subtracted from every note timestamp. */
  setCalibrationOffset(ms: number): void {
    this.offsetMs = ms;
  }
  getCalibrationOffset(): number {
    return this.offsetMs;
  }

  /**
   * Combined status: MIDI takes precedence when present (so hardware
   * connect/error states surface), otherwise the always-on virtual keyboard.
   */
  getStatus(): InputStatus {
    const providers = [...this.entries.keys()];
    const midi = providers.find((p) => p.source === 'midi');
    if (midi) return midi.getStatus();
    const virtual = providers.find((p) => p.source === 'virtual');
    if (virtual) return virtual.getStatus();
    return { kind: 'no-provider' };
  }

  hasProvider(provider: InputProvider): boolean {
    return this.entries.has(provider);
  }

  /** Add a provider alongside any already active ones. */
  async addProvider(provider: InputProvider): Promise<void> {
    if (this.entries.has(provider)) return;
    const offNote = provider.onRawNote((raw) => this.emitNote(raw, provider.source));
    const offStatus = provider.onStatusChange(() => this.emitStatus(this.getStatus()));
    this.entries.set(provider, { offNote, offStatus });
    await provider.start();
    this.emitStatus(this.getStatus());
  }

  removeProvider(provider: InputProvider): void {
    const entry = this.entries.get(provider);
    if (!entry) return;
    entry.offNote();
    entry.offStatus();
    provider.stop();
    this.entries.delete(provider);
    this.emitStatus(this.getStatus());
  }

  /** Replace all active providers with a single one (used by tests). */
  async useProvider(provider: InputProvider): Promise<void> {
    for (const existing of [...this.entries.keys()]) {
      if (existing !== provider) this.removeProvider(existing);
    }
    this.emitStatus({ kind: 'connecting' });
    await this.addProvider(provider);
  }

  onNote(cb: NoteListener): () => void {
    this.noteListeners.add(cb);
    return () => this.noteListeners.delete(cb);
  }

  onStatusChange(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  dispose(): void {
    for (const provider of [...this.entries.keys()]) this.removeProvider(provider);
    this.noteListeners.clear();
    this.statusListeners.clear();
  }

  private emitNote(raw: RawNote, source: NotePlayed['source']): void {
    // Multi-port MIDI controllers deliver one physical press on 2+ input
    // ports; a same-pitch retrigger this fast is physically impossible, so
    // it's always a duplicate — drop it before any consumer sees it. Scoped
    // to MIDI: the virtual provider has no hardware to double-deliver from
    // (and automated tests legitimately click faster than humans).
    if (source === 'midi') {
      const last = this.lastEmitByPitch.get(raw.pitch);
      if (last !== undefined && raw.timestampMs - last < DUPLICATE_NOTE_MS) return;
      this.lastEmitByPitch.set(raw.pitch, raw.timestampMs);
    }
    const note: NotePlayed = {
      pitch: raw.pitch,
      velocity: raw.velocity,
      timestampMs: raw.timestampMs - this.offsetMs,
      source,
    };
    for (const l of this.noteListeners) l(note);
  }

  private emitStatus(s: InputStatus): void {
    for (const l of this.statusListeners) l(s);
  }
}
