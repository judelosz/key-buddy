import {
  ArrowLeft,
  ArrowRight,
  Award,
  Brain,
  Hand,
  LifeBuoy,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { LessonReward } from '@/core/session/recordLesson';
import type { CurriculumLesson } from '@/core/curriculum/types';
import { SONG_MASTERY_LABELS } from '@/core/songMastery/songMastery';
import { useCountUp } from '@/ui/hooks/useCountUp';
import { headline, nextStep } from './resultCopy';

interface LessonResultProps {
  lesson: CurriculumLesson;
  reward: LessonReward;
  onContinue: () => void;
  onRetry: () => void;
  /** The adaptive step-down offer — a visibly changed retry (doc 06 §5.6). */
  stepDown?: { label: string; onApply: () => void };
  /** After repeated failure: the smaller prerequisite lesson (doc 06 §3.4). */
  remediation?: { title: string; onOpen: () => void };
}

export function LessonResult({
  lesson,
  reward,
  onContinue,
  onRetry,
  stepDown,
  remediation,
}: LessonResultProps) {
  const xp = useCountUp(reward.xp);
  const tip = nextStep(lesson, reward);

  return (
    <div
      data-testid="lesson-result"
      className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center animate-fade-up"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full shadow-soft ${
          reward.passed ? 'bg-mint-soft text-mint-deep' : 'bg-amber-soft text-amber-deep'
        }`}
      >
        {reward.passed ? <Award size={28} /> : <RotateCcw size={26} />}
      </span>

      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {headline(lesson, reward)}
        </h2>
        {tip && <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{tip}</p>}
      </div>

      {reward.xp > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-surface px-5 py-2.5 shadow-soft">
          {reward.track === 'hands' ? (
            <Hand size={16} className="text-amber-deep" />
          ) : (
            <Brain size={16} className="text-peri-deep" />
          )}
          <span className="font-display text-lg font-semibold tabular-nums text-ink">+{xp} XP</span>
          <span className="text-xs text-ink-soft">
            {reward.track === 'hands' ? 'Hands' : 'Head'}
          </span>
        </div>
      )}

      {reward.moduleCompleted && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-2.5 text-sm font-medium text-mint-deep">
          <Sparkles size={16} /> Module complete!
        </div>
      )}
      {reward.tierAdvanced && (
        <div className="flex items-center gap-2 rounded-2xl bg-amber-soft px-4 py-2.5 text-sm font-medium text-amber-deep">
          <TrendingUp size={16} /> Level up — welcome to Tier {reward.newLearningTier}!
        </div>
      )}
      {reward.newlyUnlockedSongIds.length > 0 && (
        <div className="rounded-2xl bg-peri-soft px-4 py-2.5 text-sm font-medium text-peri-deep">
          New song unlocked — find it in Free Play.
        </div>
      )}
      {/* A celebratory chip on a failed take reads as a contradiction — the
          level-up still recorded; it just waits for the next pass to shine. */}
      {reward.passed && reward.chartReward?.songMasteryLeveledTo !== undefined && (
        <div className="rounded-2xl bg-rose-soft px-4 py-2.5 text-sm font-medium text-rose-deep">
          Song mastery leveled up →{' '}
          {SONG_MASTERY_LABELS[reward.chartReward.songMasteryLeveledTo]}
        </div>
      )}

      {/* After repeated failure the honest move is a smaller prerequisite,
          never a third identical retry (doc 06 §3.4). */}
      {!reward.passed && remediation && (
        <button
          type="button"
          onClick={remediation.onOpen}
          className="flex items-center gap-2 rounded-2xl bg-peri-soft px-4 py-2.5 text-sm font-medium text-peri-deep transition hover:-translate-y-px active:translate-y-px"
        >
          <LifeBuoy size={16} /> Fix the foundation first: “{remediation.title}”
        </button>
      )}

      {/* Pass → Replay + Continue; fail → Go Back + retry. When the adaptive
          engine has a step-down, THAT becomes the dominant retry — never an
          identical dead-end run. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {reward.passed ? (
          <>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
            >
              <RotateCcw size={15} /> Replay
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
            >
              Continue <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
            >
              <ArrowLeft size={15} /> Go Back
            </button>
            {stepDown ? (
              <>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
                >
                  <RotateCcw size={15} /> Try Again
                </button>
                <button
                  type="button"
                  onClick={stepDown.onApply}
                  className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
                >
                  <TrendingDown size={16} /> {stepDown.label}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
              >
                <RotateCcw size={16} /> Try Again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
