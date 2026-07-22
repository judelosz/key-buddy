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
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';
import { KeyboardHint } from '@/ui/components/KeyboardHint';

/** note-id and build-chord: play on the (real or on-screen) keyboard. */
export function KeyboardExerciseView({
  runner,
  showCheck,
}: {
  runner: ExerciseRunner;
  showCheck?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <KeyboardHint />
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <PianoKeyboard />
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

/** rhythm-tap: start the metronome, tap any key on the clicks. */
export function RhythmTapExerciseView({ runner }: { runner: ExerciseRunner }) {
  return (
    <div className="flex flex-col gap-4">
      {!runner.tapsRunning ? (
        <button
          type="button"
          onClick={() => void runner.startTaps()}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
        >
          <Drum size={18} /> Start the count-in
        </button>
      ) : (
        <p className="font-display text-sm font-medium text-amber-deep">
          Count-in… then tap any key right on each click.
        </p>
      )}
      <KeyboardHint />
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <PianoKeyboard />
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
