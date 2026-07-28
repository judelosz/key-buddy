import { describe, it, expect } from 'vitest';
import {
  InputService,
  DUPLICATE_NOTE_MS,
  type InputProvider,
  type InputStatus,
  type RawNote,
} from '@/input/inputService';

/** Minimal provider that lets a test push raw notes by hand. */
class FakeProvider implements InputProvider {
  private cb: ((n: RawNote) => void) | null = null;
  constructor(readonly source: 'midi' | 'virtual') {}
  async start(): Promise<void> {}
  stop(): void {}
  onRawNote(cb: (n: RawNote) => void): () => void {
    this.cb = cb;
    return () => {
      this.cb = null;
    };
  }
  getStatus(): InputStatus {
    return { kind: 'ready', source: this.source, deviceName: 'fake' };
  }
  onStatusChange(): () => void {
    return () => {};
  }
  push(pitch: number, timestampMs: number): void {
    this.cb?.({ pitch, velocity: 90, timestampMs });
  }
}

describe('InputService duplicate suppression (multi-port MIDI)', () => {
  async function setup(source: 'midi' | 'virtual' = 'midi') {
    const service = new InputService();
    const provider = new FakeProvider(source);
    await service.addProvider(provider);
    const seen: { pitch: number; timestampMs: number }[] = [];
    service.onNote((n) => seen.push({ pitch: n.pitch, timestampMs: n.timestampMs }));
    return { provider, seen };
  }

  it('drops a same-pitch MIDI note arriving within the duplicate window', async () => {
    const { provider, seen } = await setup('midi');
    provider.push(60, 1_000);
    provider.push(60, 1_000 + DUPLICATE_NOTE_MS - 1); // second port's copy
    expect(seen).toHaveLength(1);
  });

  it('keeps distinct pitches even when near-simultaneous (a chord)', async () => {
    const { provider, seen } = await setup('midi');
    provider.push(60, 1_000);
    provider.push(64, 1_002);
    provider.push(67, 1_004);
    expect(seen).toHaveLength(3);
  });

  it('keeps honest same-pitch retriggers outside the window', async () => {
    const { provider, seen } = await setup('midi');
    provider.push(60, 1_000);
    provider.push(60, 1_040); // a real fast repeat
    expect(seen).toHaveLength(2);
  });

  it('never dedups the virtual provider — no hardware can double-deliver there', async () => {
    const { provider, seen } = await setup('virtual');
    provider.push(60, 1_000);
    provider.push(60, 1_005);
    expect(seen).toHaveLength(2);
  });
});
