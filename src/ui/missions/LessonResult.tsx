import { ArrowLeft, ArrowRight, Award, Brain, Hand, RotateCcw, Sparkles, TrendingUp } from 'lucide-react';
import type { LessonReward } from '@/core/session/recordLesson';
import type { CurriculumLesson } from '@/core/curriculum/types';
import { useCountUp } from '@/ui/hooks/useCountUp';

interface LessonResultProps {
  lesson: CurriculumLesson;
  reward: LessonReward;
  onContinue: () => void;
  onRetry: () => void;
}

/** One calm, specific line per outcome (doc 06 §10) — capability, not score. */
function headline(lesson: CurriculumLesson, reward: LessonReward): string {
  if (!reward.passed) {
    switch (lesson.exerciseType) {
      case 'rhythm-tap':
        return 'The pulse slipped away — that’s normal at first.';
      case 'note-id':
        return 'Some keys are still hiding. The black-key groups are your map.';
      case 'theory-quiz':
      case 'interval-ear':
        return 'A few answers got away — worth one more look.';
      default:
        return 'Not this take — and that’s fine.';
    }
  }
  if (lesson.mode === 'performance') return 'You played it — accurate, in time, no help.';
  if (lesson.mode === 'independent') return 'You did that without any support.';
  if (lesson.mode === 'scouting') return 'You just explored a piece far above your tier.';
  switch (lesson.exerciseType) {
    case 'rhythm-tap':
      return 'You held the pulse.';
    case 'note-id':
      return 'You found your way around the keys.';
    case 'interval-ear':
      return 'Your ears called it.';
    case 'listen':
      return 'Heard and noted.';
    default:
      return 'Done — and it counted.';
  }
}

function nextStep(lesson: CurriculumLesson, reward: LessonReward): string | null {
  if (reward.passed) return null;
  if (lesson.mode === 'performance') {
    return 'Warm up with the earlier lessons at an easier tempo, then come back for the checkpoint.';
  }
  if (lesson.exerciseType === 'rhythm-tap') {
    return 'Try once more — count the four-beat count-in out loud, then keep counting as you tap.';
  }
  return 'Give it another try — the feedback under each answer tells you what to listen or look for.';
}

export function LessonResult({ lesson, reward, onContinue, onRetry }: LessonResultProps) {
  const xp = useCountUp(reward.xp);
  const tip = nextStep(lesson, reward);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center animate-fade-up">
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

      {/* Pass → Replay + Continue; fail → Go Back + Try Again. The dominant
          action always points the right way: forward on a pass, retry on a fail. */}
      <div className="flex items-center gap-3">
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
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
            >
              <RotateCcw size={16} /> Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
