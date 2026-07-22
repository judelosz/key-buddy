import { useCallback, useEffect, useMemo, useState } from 'react';
import { COMPUTER_KEY_MAP } from '@/input/providers/virtualProvider';
import { virtualProvider, inputService } from '@/input';
import { audioService } from '@/audio/audioService';
import { midiToName } from '@/core/music';
import { keyRects } from '@/core/pianoLayout';

interface PianoKeyboardProps {
  lowPitch?: number;
  highPitch?: number;
  /**
   * Key labels: real note names (default), or none — note-hunt lessons hide
   * them unless the lesson grants the 'note-names' assist. The computer-key
   * mapping lives in the KeyboardHint disclosure, not on the keys.
   */
  labels?: 'notes' | 'none';
  height?: number;
}

/** "C4" → "C4" (octave kept on C as a landmark), "D4" → "D", "C#4" → "C♯". */
function keyLabel(pitch: number): string {
  const name = midiToName(pitch).replace('#', '♯');
  const letter = name.replace(/-?\d+$/, '');
  return letter === 'C' ? name : letter;
}

async function ensureAudio(): Promise<void> {
  if (!audioService.isInitialized) await audioService.init();
}

export function PianoKeyboard({
  lowPitch = 60,
  highPitch = 84,
  labels = 'notes',
  height = 150,
}: PianoKeyboardProps) {
  const [active, setActive] = useState<Set<number>>(new Set());

  // Rects as percentages (totalWidth = 100) so the layout is resolution-free
  // and matches the falling-notes canvas exactly.
  const rects = useMemo(() => keyRects(lowPitch, highPitch, 100), [lowPitch, highPitch]);
  const whites = rects.filter((r) => !r.black);
  const blacks = rects.filter((r) => r.black);

  const flash = useCallback((pitch: number) => {
    setActive((prev) => new Set(prev).add(pitch));
    window.setTimeout(() => {
      setActive((prev) => {
        const next = new Set(prev);
        next.delete(pitch);
        return next;
      });
    }, 180);
  }, []);

  // Highlight keys from the unified input stream, so MIDI, computer keys, AND
  // on-screen taps all light up the key that was played.
  useEffect(() => inputService.onNote((n) => flash(n.pitch)), [flash]);

  const trigger = useCallback(async (pitch: number) => {
    await ensureAudio();
    virtualProvider.press(pitch, 96); // flash comes back via inputService.onNote
  }, []);

  useEffect(() => {
    const held = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const pitch = COMPUTER_KEY_MAP[key];
      if (pitch === undefined || held.has(key)) return;
      held.add(key);
      void trigger(pitch);
    };
    const onUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [trigger]);

  return (
    <div className="relative w-full select-none" style={{ height }} data-testid="piano-keyboard">
      {whites.map((r) => (
        <button
          key={r.pitch}
          type="button"
          aria-label={midiToName(r.pitch)}
          data-pitch={r.pitch}
          onPointerDown={() => void trigger(r.pitch)}
          className={`absolute bottom-0 top-0 rounded-b-lg border border-line transition-colors ${
            active.has(r.pitch) ? 'bg-rose text-ink' : 'bg-white text-ink-soft'
          }`}
          style={{ left: `calc(${r.x}% + 1px)`, width: `calc(${r.width}% - 2px)` }}
        >
          {labels === 'notes' && (
            <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] font-medium">
              {keyLabel(r.pitch)}
            </span>
          )}
        </button>
      ))}
      {blacks.map((r) => (
        <button
          key={r.pitch}
          type="button"
          aria-label={midiToName(r.pitch)}
          data-pitch={r.pitch}
          onPointerDown={() => void trigger(r.pitch)}
          className={`absolute top-0 z-10 rounded-b-lg text-[9px] transition-colors ${
            active.has(r.pitch) ? 'bg-rose-deep text-white' : 'bg-ink text-white/70'
          }`}
          style={{ left: `${r.x}%`, width: `${r.width}%`, height: '62%' }}
        >
          {labels === 'notes' && (
            <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
              {keyLabel(r.pitch)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
