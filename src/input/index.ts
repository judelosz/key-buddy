/**
 * App-wide input singletons. The virtual provider is shared so the on-screen
 * keyboard, computer-key handler, and tests all drive the same stream.
 */
import { InputService } from './inputService';
import { VirtualKeyboardProvider } from './providers/virtualProvider';
import { MidiProvider } from './providers/midiProvider';

export const inputService = new InputService();
export const virtualProvider = new VirtualKeyboardProvider();

let midiProvider: MidiProvider | null = null;

export async function useVirtualInput(): Promise<void> {
  await inputService.useProvider(virtualProvider);
}

export async function useMidiInput(): Promise<void> {
  midiProvider ??= new MidiProvider();
  await inputService.useProvider(midiProvider);
}

export { InputService } from './inputService';
export type { InputStatus, RawNote } from './inputService';
