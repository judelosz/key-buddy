import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputService } from '@/input/inputService';
import { VirtualKeyboardProvider } from '@/input/providers/virtualProvider';
import type { NotePlayed } from '@/core/types';

describe('InputService with the virtual provider', () => {
  let service: InputService;
  let provider: VirtualKeyboardProvider;

  beforeEach(async () => {
    service = new InputService();
    provider = new VirtualKeyboardProvider();
    await service.useProvider(provider);
  });

  it('reports ready status once a provider starts', () => {
    expect(service.getStatus()).toMatchObject({ kind: 'ready', source: 'virtual' });
  });

  it('emits a calibrated NotePlayed for a virtual key press', () => {
    const received: NotePlayed[] = [];
    service.onNote((n) => received.push(n));
    provider.press(60, 100, 5000);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ pitch: 60, velocity: 100, source: 'virtual' });
    expect(received[0].timestampMs).toBe(5000);
  });

  it('subtracts the calibration offset from timestamps', () => {
    service.setCalibrationOffset(40);
    const received: NotePlayed[] = [];
    service.onNote((n) => received.push(n));
    provider.press(62, 90, 5000);
    expect(received[0].timestampMs).toBe(4960);
  });

  it('stops emitting after a listener unsubscribes', () => {
    const cb = vi.fn();
    const unsub = service.onNote(cb);
    provider.press(60);
    unsub();
    provider.press(62);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('tears down the old provider when swapping', async () => {
    const cb = vi.fn();
    service.onNote(cb);
    const next = new VirtualKeyboardProvider();
    await service.useProvider(next);
    provider.press(60); // old provider — should be detached
    expect(cb).not.toHaveBeenCalled();
    next.press(64);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
