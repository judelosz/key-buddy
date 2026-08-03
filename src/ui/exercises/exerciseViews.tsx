/**
 * Per-type exercise interaction surfaces, all driven by an ExerciseRunner.
 * Kept together: each view is a thin layer over the shared runner/shell.
 */
import { useEffect, useState } from 'react';
import { Drum, PlayCircle, Check } from 'lucide-react';
import type { Chart, Feel } from '@/core/types';
import type { ExercisePrompt } from '@/core/exercise/types';
import type { TapFeedback } from '@/core/exercise/engine';
import type { ExerciseRunner } from '@/ui/session/exerciseRunner';
import { playNotesOnce } from '@/ui/session/exerciseRunner';
import { audioService } from '@/audio/audioService';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';
import { KeyboardHint } from '@/ui/components/KeyboardHint';
import { PianoMotif } from '@/ui/components/genreMotifs';

/** note-id and build-chord: play on the (real or on-screen) keyboard. */
export function KeyboardExerciseView({
  runner,
  showCheck,
  noteLabels = true,
}: {
  runner: ExerciseRunner;
  showCheck?: boolean;
  /** False on independent/performance lessons — finding keys IS the test. */
  noteLabels?: boolean;
}) {
  const range = runner.spec.keyboardRange;
  return (
    <div className="flex flex-col gap-4">
      <KeyboardHint />
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <PianoKeyboard
          lowPitch={range?.low}
          highPitch={range?.high}
          labels={noteLabels ? 'notes' : 'none'}
        />
      </div>
      {showCheck && (
        <button
          type="button"
          onClick={() => runner.commit()}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-amber px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
        >
          <Check size={16} /> Check my chord
        </button>
      )}
    </div>
  );
}

/** Any prompt answered with choice pills (theory quiz, ear ID). */
export function ChoiceExerciseView({
  prompt,
  runner,
  disabled,
}: {
  prompt: ExercisePrompt;
  runner: ExerciseRunner;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {(prompt.choices ?? []).map((choice, i) => (
        <button
          key={`${prompt.id}-${i}`}
          type="button"
          disabled={disabled}
          onClick={() => runner.submitChoice(i)}
          className="rounded-full bg-surface px-5 py-3 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px disabled:opacity-50"
        >
          {choice}
        </button>
      ))}
    </div>
  );
}

/** Per-tap verdict copy + styling — the tap view has no note lane, so unlike
 * the chart player EVERY tap gets a verdict (this IS the timing feedback). */
const TAP_FLASH_STYLES: Record<string, { label: string; style: string }> = {
  perfect: { label: 'Perfect!', style: 'bg-mint-deep text-white' },
  great: { label: 'Great', style: 'bg-mint-soft text-mint-ink' },
  good: { label: 'Good', style: 'bg-amber-soft text-amber-ink' },
  early: { label: 'Early', style: 'bg-peri-soft text-peri-ink' },
  late: { label: 'Late', style: 'bg-peri-soft text-peri-ink' },
  miss: { label: 'Missed', style: 'bg-rose-soft text-rose-ink' },
  countIn: { label: '✓ synced', style: 'bg-sand text-ink-soft' },
  extra: { label: 'Extra tap', style: 'bg-rose-soft text-rose-ink' },
};
const TAP_FLASH_MS = 750;

/** rhythm-tap: the player's own first tap launches the count-in. */
export function RhythmTapExerciseView({
  runner,
  tapFlash,
}: {
  runner: ExerciseRunner;
  /** Latest tap verdict from the engine (nonce re-pops the pill per tap). */
  tapFlash?: { f: TapFeedback; nonce: number } | null;
}) {
  const range = runner.spec.keyboardRange;
  const prompt = runner.currentPrompt;
  const expected = prompt?.expected.kind === 'taps' ? prompt.expected : null;
  // Absolute beat index from the shared metronome clock (null until the first
  // tick lands) — drives the follow-along pulse.
  const [beat, setBeat] = useState<number | null>(null);
  // The verdict pill hides itself shortly after the last tap.
  const [flashVisible, setFlashVisible] = useState(false);
  useEffect(() => {
    if (!tapFlash) return;
    setFlashVisible(true);
    const t = window.setTimeout(() => setFlashVisible(false), TAP_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [tapFlash]);
  const flash =
    flashVisible && tapFlash
      ? tapFlash.f.tooStraight
        ? // The specific swung-prompt failure mode beats a generic "Early".
          { label: 'Too straight — lean the pair', style: 'bg-peri-soft text-peri-ink' }
        : TAP_FLASH_STYLES[tapFlash.f.grade ?? tapFlash.f.kind]
      : null;

  useEffect(() => {
    if (!runner.tapsRunning) {
      setBeat(null);
      return;
    }
    const off = audioService.onTick((t) => setBeat(t.beat));
    return () => {
      off();
    };
  }, [runner, runner.tapsRunning]);

  const beatsPerBar = expected?.beatsPerBar ?? 4;
  const countIn = expected?.countInBeats ?? 4;
  const inCountIn = beat !== null && beat < countIn;
  const barBeat = beat === null ? 0 : ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;

  return (
    <div className="flex flex-col gap-4">
      {!runner.tapsRunning ? (
        <p className="flex items-center gap-2 font-display text-sm font-medium text-amber-ink">
          <Drum size={16} className="animate-pop" />
          Tap any key when you&rsquo;re ready — your first tap starts the count-in.
        </p>
      ) : (
        /* Follow-along pulse: pops on every click of the shared metronome
           clock — amber during the count-in, rose once taps count. Sized to
           be THE thing on screen while the player locks in. */
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-6 shadow-soft">
          <span
            key={beat ?? -1}
            className={`flex h-24 w-24 items-center justify-center rounded-full font-display text-4xl font-semibold shadow-soft animate-pop ${
              beat === null || inCountIn
                ? 'bg-amber text-ink'
                : 'bg-rose-soft text-rose-ink'
            }`}
          >
            {beat === null ? '…' : barBeat + 1}
          </span>
          <div className="flex items-center gap-2.5" aria-hidden="true">
            {Array.from({ length: beatsPerBar }, (_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all duration-150 ${
                  beat !== null && i === barBeat
                    ? `h-3.5 w-3.5 ${inCountIn ? 'bg-amber-deep' : 'bg-rose-deep'}`
                    : 'h-2.5 w-2.5 bg-sand'
                }`}
              />
            ))}
          </div>
          {/* Live verdict — how the last tap landed. Height reserved so the
              card never jumps as pills come and go. */}
          <div className="flex h-7 items-center" aria-live="polite">
            {flash && (
              <span
                key={tapFlash?.nonce}
                className={`animate-pop rounded-full px-3 py-1 font-display text-sm font-semibold shadow-soft ${flash.style}`}
              >
                {flash.label}
              </span>
            )}
          </div>
          <p
            className={`font-display text-base font-semibold ${
              beat === null || inCountIn ? 'text-amber-ink' : 'text-rose-ink'
            }`}
          >
            {beat === null || inCountIn
              ? 'Tap along with the count-in — it tunes the timing to your device'
              : 'Now tap with each pulse'}
          </p>
        </div>
      )}
      <KeyboardHint />
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <PianoKeyboard lowPitch={range?.low} highPitch={range?.high} />
      </div>
    </div>
  );
}

/** listen: play the material once, then continue. */
export function ListenExerciseView({
  runner,
  chart,
  tempoBPM,
  feel,
}: {
  runner: ExerciseRunner;
  chart: Pick<Chart, 'notes'>;
  tempoBPM: number;
  /** Swung material plays back long-short (doc 09) — a shuffle listen lesson
   * must SOUND like a shuffle. */
  feel?: Feel;
}) {
  const [state, setState] = useState<'idle' | 'playing' | 'done'>('idle');

  useEffect(() => () => setState('idle'), [chart]);

  const play = async () => {
    setState('playing');
    const durationMs = await playNotesOnce(chart.notes, tempoBPM, feel);
    window.setTimeout(() => setState('done'), durationMs);
  };

  const bars = Math.max(1, Math.ceil((chart.notes.length || 4) / 4));

  return (
    // Listening gets a stage of its own — the first lesson a player ever sees
    // shouldn't be a lone button on an empty page.
    <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-8 shadow-soft">
      <PianoMotif
        size={110}
        className="pointer-events-none absolute -right-4 -top-5 opacity-40"
      />
      <div className="flex h-16 items-end gap-1.5" aria-hidden="true">
        {EQ_BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className={`w-2.5 rounded-full transition-all duration-500 ${
              state === 'playing' ? 'animate-pulse bg-rose' : 'bg-peri-soft'
            }`}
            style={{
              height: `${h}%`,
              animationDelay: state === 'playing' ? `${i * 120}ms` : undefined,
            }}
          />
        ))}
      </div>
      <p className="text-xs text-ink-soft">
        {state === 'playing'
          ? 'Playing — just listen.'
          : `${chart.notes.length} notes · about ${bars} bar${bars === 1 ? '' : 's'} · ${tempoBPM} BPM`}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={state === 'playing'}
          onClick={() => void play()}
          className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px disabled:opacity-60"
        >
          <PlayCircle size={18} />
          {state === 'idle' ? 'Play it' : state === 'playing' ? 'Playing…' : 'Play it again'}
        </button>
        {state === 'done' && (
          <button
            type="button"
            onClick={() => runner.markWatched()}
            className="inline-flex items-center gap-2 rounded-full bg-mint-soft px-5 py-2.5 font-display text-sm font-semibold text-mint-ink transition hover:-translate-y-px active:translate-y-px"
          >
            <Check size={16} /> Got it — continue
          </button>
        )}
      </div>
    </div>
  );
}

/** Static equalizer silhouette for the listen stage (heights in %). */
const EQ_BAR_HEIGHTS = [38, 62, 88, 52, 74, 96, 60, 42, 70, 55];
