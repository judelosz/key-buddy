/**
 * InputService — source-agnostic note input (build-spec §6.1).
 *
 * Providers (MIDI keyboard, on-screen virtual keyboard, and later mic §12) emit
 * a RAW note (pitch, velocity, uncalibrated timestamp). InputService applies the
 * one-time calibration offset and re-emits a unified, calibrated `NotePlayed`
 * stream that the ScoringEngine and visualizer consume. Nothing downstream knows
 * or cares which provider produced a note — so the deferred mic provider slots
 * in here with zero downstream change.
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

export class InputService {
  private provider: InputProvider | null = null;
  private providerUnsub: (() => void) | null = null;
  private providerStatusUnsub: (() => void) | null = null;
  private offsetMs = 0;
  private readonly noteListeners = new Set<NoteListener>();
  private readonly statusListeners = new Set<StatusListener>();

  /** Latency offset (ms) subtracted from every note timestamp. */
  setCalibrationOffset(ms: number): void {
    this.offsetMs = ms;
  }
  getCalibrationOffset(): number {
    return this.offsetMs;
  }

  getStatus(): InputStatus {
    return this.provider?.getStatus() ?? { kind: 'no-provider' };
  }

  /** Swap the active provider (stops the previous one). */
  async useProvider(provider: InputProvider): Promise<void> {
    this.teardownProvider();
    this.provider = provider;
    this.providerUnsub = provider.onRawNote((raw) => this.emitNote(raw, provider.source));
    this.providerStatusUnsub = provider.onStatusChange((s) => this.emitStatus(s));
    this.emitStatus({ kind: 'connecting' });
    await provider.start();
    this.emitStatus(provider.getStatus());
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
    this.teardownProvider();
    this.noteListeners.clear();
    this.statusListeners.clear();
  }

  private emitNote(raw: RawNote, source: NotePlayed['source']): void {
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

  private teardownProvider(): void {
    this.providerUnsub?.();
    this.providerStatusUnsub?.();
    this.provider?.stop();
    this.providerUnsub = null;
    this.providerStatusUnsub = null;
    this.provider = null;
  }
}
