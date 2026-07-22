import { useCallback, useRef, useState } from 'react';
import { Activity, Check } from 'lucide-react';
import { audioService } from '@/audio/audioService';
import { inputService } from '@/input';
import { computeCalibrationOffset, type CalibrationResult } from '@/input/calibration';
import { useAppStore } from '@/ui/store/appStore';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';

const COUNT_IN_BEATS = 2;
const MEASURE_BEATS = 8;
const BPM = 90;

type Phase = 'idle' | 'running' | 'done';

export function Calibration() {
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
        setResult(res);
        setPhase('done');
      }
    });

    audioService.startMetronome(BPM, 4);
  }, [setCalibrationOffsetMs]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Latency calibration</h2>
        <p className="mt-1 max-w-prose text-sm text-neutral-400">
          The audio stack adds a little delay, so honest playing can read as
          &ldquo;late.&rdquo; Tap any key (or the space-mapped keys) on each click for a
          couple of bars and we&rsquo;ll measure the offset and subtract it from every
          judgment. One-time, per device.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => void run()}
          disabled={phase === 'running'}
          className="inline-flex items-center gap-2 rounded-lg bg-grade-perfect px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
        >
          <Activity size={16} />
          {phase === 'running' ? 'Listening — tap the clicks…' : 'Start calibration'}
        </button>
        <span className="text-sm text-neutral-400">
          Current offset:{' '}
          <span className="font-medium tabular-nums text-neutral-200">{savedOffset} ms</span>
        </span>
      </div>

      {phase === 'done' && result && (
        <div className="flex items-center gap-3 rounded-lg border border-ink-line bg-ink-soft px-4 py-3 text-sm">
          <Check size={18} className="text-grade-perfect" />
          <span>
            Measured <span className="font-medium tabular-nums">{Math.round(result.offsetMs)} ms</span>{' '}
            from {result.sampleCount} taps (±{Math.round(result.stdDevMs)} ms). Applied and saved.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
        <PianoKeyboard />
      </div>
    </div>
  );
}
