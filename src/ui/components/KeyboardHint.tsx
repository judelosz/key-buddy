import { Keyboard } from 'lucide-react';

/** Explains the computer-keyboard → piano mapping (always available, no MIDI needed). */
export function KeyboardHint() {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-peri-soft px-4 py-3 text-sm text-peri-deep">
      <Keyboard size={16} className="mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold">No MIDI keyboard? Use your computer keys.</span>{' '}
        <span className="text-ink-soft">
          <kbd className="font-display">Z X C V B N M</kbd> are the white keys C–B,{' '}
          <kbd className="font-display">S D G H J</kbd> the black keys, and{' '}
          <kbd className="font-display">Q W E R T Y U</kbd> the octave above.
        </span>
      </p>
    </div>
  );
}
