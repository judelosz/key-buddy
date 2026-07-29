import { useState } from 'react';
import { ChevronDown, ChevronRight, Keyboard } from 'lucide-react';

interface KeyboardHintProps {
  /** Start expanded (onboarding's input step wants the mapping visible). */
  defaultOpen?: boolean;
}

/**
 * Computer-keyboard → piano mapping, tucked away behind a small disclosure so
 * it doesn't shout from every screen. Click to expand.
 */
export function KeyboardHint({ defaultOpen = false }: KeyboardHintProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-ink-soft transition hover:text-ink"
      >
        <Keyboard size={13} />
        No MIDI keyboard?
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <p className="mt-1.5 rounded-2xl bg-peri-soft px-4 py-3 text-peri-ink animate-fade-up">
          <span className="font-semibold">Use your computer keys.</span>{' '}
          <span className="text-ink-soft">
            <kbd className="font-display">Z X C V B N M</kbd> are the white keys C–B,{' '}
            <kbd className="font-display">S D G H J</kbd> the black keys, and{' '}
            <kbd className="font-display">Q W E R T Y U</kbd> the octave above.
          </span>
        </p>
      )}
    </div>
  );
}
