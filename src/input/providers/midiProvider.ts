/**
 * MidiProvider — real MIDI keyboard input via WEBMIDI.js (build-spec §6.1).
 *
 * Discovers devices, attaches noteon listeners to every input, and tracks
 * connect/disconnect so a lost keyboard surfaces a clear prompt rather than a
 * silent dead app. Emits RawNote in the performance.now() clock domain
 * (Web MIDI event timestamps), matching the virtual provider and audio Transport.
 */
import { WebMidi, type Input, type NoteMessageEvent } from 'webmidi';
import type { InputProvider, InputStatus, RawNote } from '@/input/inputService';

export class MidiProvider implements InputProvider {
  readonly source = 'midi' as const;
  private status: InputStatus = { kind: 'no-provider' };
  private readonly noteCbs = new Set<(n: RawNote) => void>();
  private readonly statusCbs = new Set<(s: InputStatus) => void>();
  private listening = false;

  async start(): Promise<void> {
    try {
      await WebMidi.enable();
    } catch (err) {
      const message =
        err instanceof Error && /not supported|SecurityError/i.test(err.message)
          ? 'Web MIDI is not available in this browser. Use the on-screen keyboard, or try Chrome/Edge.'
          : `Could not access MIDI: ${err instanceof Error ? err.message : String(err)}`;
      this.setStatus({ kind: 'unsupported', message });
      return;
    }

    WebMidi.addListener('connected', this.handleConnection);
    WebMidi.addListener('disconnected', this.handleConnection);
    this.attachInputs();
  }

  stop(): void {
    this.detachInputs();
    WebMidi.removeListener('connected', this.handleConnection);
    WebMidi.removeListener('disconnected', this.handleConnection);
    this.listening = false;
    this.setStatus({ kind: 'no-provider' });
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

  private readonly handleConnection = (): void => {
    this.attachInputs();
  };

  private readonly handleNoteOn = (e: NoteMessageEvent): void => {
    const velocity =
      typeof e.note.rawAttack === 'number'
        ? e.note.rawAttack
        : Math.round((e.note.attack ?? 0.7) * 127);
    const note: RawNote = {
      pitch: e.note.number,
      velocity,
      timestampMs: e.timestamp,
    };
    for (const cb of this.noteCbs) cb(note);
  };

  private attachInputs(): void {
    this.detachInputs();
    const inputs = WebMidi.inputs;
    if (inputs.length === 0) {
      this.setStatus({
        kind: 'no-device',
        message: 'No MIDI keyboard detected. Connect one, or use the on-screen keyboard.',
      });
      return;
    }
    for (const input of inputs) {
      input.addListener('noteon', this.handleNoteOn);
    }
    this.listening = true;
    this.setStatus({
      kind: 'ready',
      source: 'midi',
      deviceName: inputs.map((i: Input) => i.name).join(', '),
    });
  }

  private detachInputs(): void {
    if (!this.listening && WebMidi.inputs.length === 0) return;
    for (const input of WebMidi.inputs) {
      input.removeListener('noteon', this.handleNoteOn);
    }
  }

  private setStatus(s: InputStatus): void {
    this.status = s;
    for (const cb of this.statusCbs) cb(s);
  }
}
