import type { ReactNode } from 'react';
import { Check, Volume2, X } from 'lucide-react';
import type { ExercisePrompt, PromptResult } from '@/core/exercise/types';

interface ExerciseShellProps {
  prompt: ExercisePrompt | null;
  progress: { index: number; total: number };
  /** Result of the just-finished prompt (transient feedback). */
  lastResult: PromptResult | null;
  onReplayAudio?: () => void;
  children?: ReactNode;
}

/**
 * Shared exercise frame: prompt text, per-rep progress dots, replay-audio
 * button, and the calm per-prompt feedback line (doc 06 §10).
 */
export function ExerciseShell({
  prompt,
  progress,
  lastResult,
  onReplayAudio,
  children,
}: ExerciseShellProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: progress.total }, (_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i < progress.index
                  ? 'w-2 bg-mint-deep'
                  : i === progress.index
                    ? 'w-5 bg-amber-deep'
                    : 'w-2 bg-line'
              }`}
            />
          ))}
        </div>
        <span className="text-xs tabular-nums text-ink-soft">
          {Math.min(progress.index + 1, progress.total)} / {progress.total}
        </span>
      </div>

      {prompt?.displayText && (
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-xl font-semibold tracking-tight text-ink">
            {prompt.displayText}
          </h3>
          {prompt.audio && onReplayAudio && (
            <button
              type="button"
              onClick={onReplayAudio}
              className="inline-flex items-center gap-1.5 rounded-full bg-peri-soft px-3 py-1.5 text-sm font-medium text-peri-deep transition hover:-translate-y-px active:translate-y-px"
            >
              <Volume2 size={14} /> Play again
            </button>
          )}
        </div>
      )}

      {lastResult && (
        <div
          className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm animate-fade-up ${
            lastResult.correct ? 'bg-mint-soft text-mint-deep' : 'bg-amber-soft text-amber-deep'
          }`}
        >
          {lastResult.correct ? (
            <Check size={16} className="mt-0.5 shrink-0" />
          ) : (
            <X size={16} className="mt-0.5 shrink-0" />
          )}
          <span>
            {lastResult.correct ? 'Nice.' : 'Not quite.'}{' '}
            {lastResult.detail && <span>{lastResult.detail}. </span>}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}
