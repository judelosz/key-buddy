import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, HelpCircle, Volume2, X } from 'lucide-react';
import type { ExercisePrompt, PromptResult } from '@/core/exercise/types';

interface ExerciseShellProps {
  prompt: ExercisePrompt | null;
  progress: { index: number; total: number };
  /** Result of the just-finished prompt (transient feedback). */
  lastResult: PromptResult | null;
  /** The prompt `lastResult` belongs to — powers "Explain my answer". */
  answeredPrompt?: ExercisePrompt | null;
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
  answeredPrompt,
  onReplayAudio,
  children,
}: ExerciseShellProps) {
  const [explainOpen, setExplainOpen] = useState(false);
  // A new answer collapses the previous explanation.
  useEffect(() => setExplainOpen(false), [lastResult?.promptId]);

  const explainable =
    lastResult !== null &&
    answeredPrompt !== null &&
    answeredPrompt !== undefined &&
    answeredPrompt.id === lastResult.promptId &&
    answeredPrompt.expected.kind === 'choice' &&
    (answeredPrompt.choices?.length ?? 0) > 0 &&
    answeredPrompt.choiceExplanations?.length === answeredPrompt.choices?.length;
  const answerIndex =
    explainable && answeredPrompt.expected.kind === 'choice'
      ? answeredPrompt.expected.answerIndex
      : -1;

  return (
    // Anchored in the upper third (not true vertical centering — the feedback
    // strip appearing would re-center and jump the whole column mid-answer).
    <div
      data-testid="exercise-shell"
      className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-[5vh]"
    >
      {/* The exercise gets a stage: dots + prompt + feedback live in one card
          instead of floating loose on the page. */}
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-soft">
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
            <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
              {prompt.displayText}
            </h3>
            {prompt.audio && onReplayAudio && (
              <button
                type="button"
                onClick={onReplayAudio}
                className="inline-flex items-center gap-1.5 rounded-full bg-peri-soft px-3 py-1.5 text-sm font-medium text-peri-ink transition hover:-translate-y-px active:translate-y-px"
              >
                <Volume2 size={14} /> Play again
              </button>
            )}
          </div>
        )}

      {lastResult && (
        <div
          className={`flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm animate-fade-up ${
            lastResult.correct ? 'bg-mint-soft text-mint-ink' : 'bg-amber-soft text-amber-ink'
          }`}
        >
          <div className="flex items-start gap-2">
            {lastResult.correct ? (
              <Check size={16} className="mt-0.5 shrink-0" />
            ) : (
              <X size={16} className="mt-0.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              {lastResult.correct ? 'Nice.' : 'Not quite.'}{' '}
              {lastResult.detail && <span>{lastResult.detail}. </span>}
            </span>
            {explainable && (
              <button
                type="button"
                onClick={() => setExplainOpen((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1 font-medium underline-offset-2 hover:underline"
              >
                <HelpCircle size={13} /> Explain my answer
                {explainOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            )}
          </div>

          {/* Why the right choice is right AND why each other one is wrong. */}
          {explainable && explainOpen && (
            <ul className="flex flex-col gap-1.5 rounded-xl bg-surface/70 p-3 text-ink animate-fade-up">
              {answeredPrompt.choices!.map((choice, i) => {
                const isAnswer = i === answerIndex;
                const isPick = i === lastResult.chosenIndex;
                return (
                  <li key={i} className="flex items-start gap-2">
                    {isAnswer ? (
                      <Check size={14} className="mt-0.5 shrink-0 text-mint-ink" />
                    ) : (
                      <X size={14} className="mt-0.5 shrink-0 text-rose-ink/60" />
                    )}
                    <span className="min-w-0">
                      <span className={`font-medium ${isAnswer ? 'text-mint-ink' : 'text-ink'}`}>
                        {choice}
                      </span>
                      {isPick && (
                        <span className="ml-1.5 rounded-full bg-sand px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                          your pick
                        </span>
                      )}
                      <span className="block text-xs text-ink-soft">
                        {answeredPrompt.choiceExplanations![i]}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      </div>

      {children}
    </div>
  );
}
