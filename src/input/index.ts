/**
 * App-wide input singletons. The virtual provider is shared so the on-screen
 * keyboard, computer-key handler, and tests all drive the same stream, and it
 * stays active alongside MIDI so laptop-key play always works.
 */
import { InputService } from './inputService';
import { VirtualKeyboardProvider } from './providers/virtualProvider';
import { MidiProvider } from './providers/midiProvider';

export const inputService = new InputService();
export const virtualProvider = new VirtualKeyboardProvider();

let midiProvider: MidiProvider | null = null;

/** Ensure the on-screen / computer keyboard is live (always safe to call). */
export async function enableVirtualInput(): Promise<void> {
  await inputService.addProvider(virtualProvider);
}

/** Connect a MIDI keyboard in addition to the virtual keyboard. */
export async function enableMidiInput(): Promise<void> {
  midiProvider ??= new MidiProvider();
  await inputService.addProvider(midiProvider);
}

export function disableMidiInput(): void {
  if (midiProvider) inputService.removeProvider(midiProvider);
}

export function isMidiEnabled(): boolean {
  return midiProvider !== null && inputService.hasProvider(midiProvider);
}

export { InputService } from './inputService';
export type { InputStatus, RawNote } from './inputService';
