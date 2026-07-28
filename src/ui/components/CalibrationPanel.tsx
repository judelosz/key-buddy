import { useCallback, useRef, useState } from 'react';
import { Activity, Check } from 'lucide-react';
import { audioService } from '@/audio/audioService';
import { inputService } from '@/input';
import { computeCalibrationOffset, type CalibrationResult } from '@/input/calibration';
import { useAppStore } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';

const COUNT_IN_BEATS = 2;
const MEASURE_BEATS = 8;
const BPM = 90;

type Phase = 'idle' | 'running' | 'done';

interface CalibrationPanelProps {
  /** Hide the intro copy when the host (e.g. onboarding) provides its own. */
  showIntro?: boolean;
}

/**
 * Embeddable latency-calibration flow: tap along with the metronome for a few
 * bars; the measured offset is applied to every future timing judgment.
 * Used by the Settings screen and the onboarding input-setup step.
 */
export function CalibrationPanel({ showIntro = true }: CalibrationPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const setCalibrationOffsetMs = useAppStore((s) => s.setCalibrationOffsetMs);
  const savedOffset = useAppStore((s) => s.calibrationOffsetMs);

  const clicksRef = useRef<number[]>([]);
  const tapsRef = useRef<number[]>([]);

  const run = useCallback(async () => {
    await audioService.init();
    clicksRef.current = [];
    tapsRef.current = [];
    setResult(null);
    setPhase('running');

    // Measure raw taps vs raw clicks (no existing offset skewing the result).
    const priorOffset = inputService.getCalibrationOffset();
    inputService.setCalibrationOffset(0);

    const offTap = inputService.onNote((n) => {
      tapsRef.current.push(n.timestampMs);
    });

    const offTick = audioService.onTick((tick) => {
      // Skip the count-in beats; collect the measured window.
      if (tick.beat >= COUNT_IN_BEATS) clicksRef.current.push(tick.perfMs);

      if (tick.beat >= COUNT_IN_BEATS + MEASURE_BEATS) {
        offTick();
        offTap();
        audioService.stopMetronome();
        const res = computeCalibrationOffset(clicksRef.current, tapsRef.current);
        // If the tapper produced nothing usable, keep the prior offset.
        const applied = res.sampleCount > 0 ? res.offsetMs : priorOffset;
        inputService.setCalibrationOffset(applied);
        setCalibrationOffsetMs(Math.round(applied));
        // Persist so the offset survives reloads (rehydrated in gameStore.init).
        void useGameStore.getState().setCalibrationOffset(applied);
        setResult(res);
        setPhase('done');
      }
    });

    audioService.startMetronome(BPM, 4);
  }, [setCalibrationOffsetMs]);

  return (
    <div className="flex flex-col gap-5">
      {showIntro && (
        <p className="max-w-prose text-sm text-ink-soft">
          The audio stack adds a little delay, so honest playing can read as &ldquo;late.&rdquo; Tap
          any key on each click for a couple of bars and we&rsquo;ll measure the offset and subtract
          it from every judgment. One-time, per device.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void run()}
          disabled={phase === 'running'}
          className="inline-flex items-center gap-2 rounded-full bg-rose px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px disabled:opacity-50"
        >
          <Activity size={16} />
          {phase === 'running' ? 'Listening — tap the clicks…' : 'Start calibration'}
        </button>
        <span className="text-sm text-ink-soft">
          Current offset:{' '}
          <span className="font-medium tabular-nums text-ink">{savedOffset} ms</span>
        </span>
      </div>

      {phase === 'done' && result && (
        <div className="flex items-center gap-3 rounded-2xl bg-mint-soft px-4 py-3 text-sm text-mint-deep">
          <Check size={18} />
          <span>
            Measured <span className="font-medium tabular-nums">{Math.round(result.offsetMs)} ms</span>{' '}
            from {result.sampleCount} taps (±{Math.round(result.stdDevMs)} ms). Applied and saved.
          </span>
        </div>
      )}

      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <PianoKeyboard />
      </div>
    </div>
  );
}
