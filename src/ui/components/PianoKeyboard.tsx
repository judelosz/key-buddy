import { useCallback, useEffect, useMemo, useState } from 'react';
import { COMPUTER_KEY_MAP } from '@/input/providers/virtualProvider';
import { virtualProvider } from '@/input';
import { audioService } from '@/audio/audioService';
import { isBlackKey, midiToName } from '@/core/music';

interface PianoKeyboardProps {
  lowPitch?: number;
  highPitch?: number;
  /** Show the computer-key hint on each key. */
  showKeyHints?: boolean;
}

const REVERSE_KEY_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(COMPUTER_KEY_MAP).map(([k, v]) => [v, k]),
);

async function ensureAudio(): Promise<void> {
  if (!audioService.isInitialized) await audioService.init();
}

export function PianoKeyboard({
  lowPitch = 60,
  highPitch = 84,
  showKeyHints = true,
}: PianoKeyboardProps) {
  const [active, setActive] = useState<Set<number>>(new Set());

  const pitches = useMemo(
    () => Array.from({ length: highPitch - lowPitch + 1 }, (_, i) => lowPitch + i),
    [lowPitch, highPitch],
  );
  const whites = pitches.filter((p) => !isBlackKey(p));

  const flash = useCallback((pitch: number) => {
    setActive((prev) => new Set(prev).add(pitch));
    window.setTimeout(() => {
      setActive((prev) => {
        const next = new Set(prev);
        next.delete(pitch);
        return next;
      });
    }, 140);
  }, []);

  const trigger = useCallback(
    async (pitch: number) => {
      await ensureAudio();
      virtualProvider.press(pitch, 96);
      flash(pitch);
    },
    [flash],
  );

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
    <div className="relative select-none" data-testid="piano-keyboard">
      <div className="flex h-40 gap-[3px]">
        {whites.map((pitch) => (
          <button
            key={pitch}
            type="button"
            aria-label={midiToName(pitch)}
            data-pitch={pitch}
            onPointerDown={() => void trigger(pitch)}
            className={`relative flex-1 rounded-b-xl border border-line transition-colors ${
              active.has(pitch) ? 'bg-rose text-ink' : 'bg-white text-ink-soft'
            }`}
          >
            <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] font-medium">
              {showKeyHints && REVERSE_KEY_MAP[pitch] ? REVERSE_KEY_MAP[pitch].toUpperCase() : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 flex h-24 gap-[3px]">
        {whites.map((pitch) => {
          const sharp = pitch + 1;
          const hasSharp = isBlackKey(sharp) && sharp <= highPitch;
          return (
            <div key={pitch} className="relative flex-1">
              {hasSharp && (
                <button
                  type="button"
                  aria-label={midiToName(sharp)}
                  data-pitch={sharp}
                  onPointerDown={() => void trigger(sharp)}
                  className={`pointer-events-auto absolute right-0 top-0 z-10 h-full w-[62%] translate-x-1/2 rounded-b-lg text-[9px] transition-colors ${
                    active.has(sharp) ? 'bg-rose-deep text-white' : 'bg-ink text-white/70'
                  }`}
                >
                  <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
                    {showKeyHints && REVERSE_KEY_MAP[sharp]
                      ? REVERSE_KEY_MAP[sharp].toUpperCase()
                      : ''}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
