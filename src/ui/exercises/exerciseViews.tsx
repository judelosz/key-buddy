/**
 * Per-type exercise interaction surfaces, all driven by an ExerciseRunner.
 * Kept together: each view is a thin layer over the shared runner/shell.
 */
import { useEffect, useState } from 'react';
import { Drum, PlayCircle, Check } from 'lucide-react';
import type { Chart } from '@/core/types';
import type { ExercisePrompt } from '@/core/exercise/types';
import type { ExerciseRunner } from '@/ui/session/exerciseRunner';
import { playNotesOnce } from '@/ui/session/exerciseRunner';
import { audioService } from '@/audio/audioService';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';
import { KeyboardHint } from '@/ui/components/KeyboardHint';

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

/** rhythm-tap: the player's own first tap launches the count-in. */
export function RhythmTapExerciseView({ runner }: { runner: ExerciseRunner }) {
  const range = runner.spec.keyboardRange;
  const prompt = runner.currentPrompt;
  const expected = prompt?.expected.kind === 'taps' ? prompt.expected : null;
  // Absolute beat index from the shared metronome clock (null until the first
  // tick lands) — drives the follow-along pulse.
  const [beat, setBeat] = useState<number | null>(null);

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
        <p className="flex items-center gap-2 font-display text-sm font-medium text-amber-deep">
          <Drum size={16} className="animate-pop" />
          Tap any key when you&rsquo;re ready — your first tap starts the count-in.
        </p>
      ) : (
        /* Follow-along pulse: pops on every click of the shared metronome
           clock — amber during the count-in, rose once taps count. */
        <div className="flex flex-col items-center gap-2.5 rounded-3xl border border-line bg-surface px-6 py-5 shadow-soft">
          <span
            key={beat ?? -1}
            className={`flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl font-semibold shadow-soft animate-pop ${
              beat === null || inCountIn
                ? 'bg-amber-soft text-amber-deep'
                : 'bg-rose-soft text-rose-deep'
            }`}
          >
            {beat === null ? '…' : barBeat + 1}
          </span>
          <div className="flex items-center gap-2" aria-hidden="true">
            {Array.from({ length: beatsPerBar }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  beat !== null && i === barBeat
                    ? inCountIn
                      ? 'bg-amber-deep'
                      : 'bg-rose-deep'
                    : 'bg-sand'
                }`}
              />
            ))}
          </div>
          <p className="font-display text-sm font-medium text-ink-soft">
            {beat === null || inCountIn
              ? 'Count-in — feel the pulse…'
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
}: {
  runner: ExerciseRunner;
  chart: Pick<Chart, 'notes'>;
  tempoBPM: number;
}) {
  const [state, setState] = useState<'idle' | 'playing' | 'done'>('idle');

  useEffect(() => () => setState('idle'), [chart]);

  const play = async () => {
    setState('playing');
    const durationMs = await playNotesOnce(chart.notes, tempoBPM);
    window.setTimeout(() => setState('done'), durationMs);
  };

  return (
    <div className="flex flex-col items-start gap-4">
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
          className="inline-flex items-center gap-2 rounded-full bg-mint-soft px-5 py-2.5 font-display text-sm font-semibold text-mint-deep transition hover:-translate-y-px active:translate-y-px"
        >
          <Check size={16} /> Got it — continue
        </button>
      )}
    </div>
  );
}
