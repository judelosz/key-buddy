import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  ChevronDown,
  ChevronRight,
  LifeBuoy,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { LessonReward } from '@/core/session/recordLesson';
import type { CurriculumLesson } from '@/core/curriculum/types';
import { SONG_MASTERY_LABELS } from '@/core/songMastery/songMastery';
import { generateTip } from '@/core/scoring/feedback';
import { chartForLesson } from '@/core/content/resolveChart';
import { getContent } from '@/core/content/bundled';
import { Celebration } from '@/ui/components/Celebration';
import { XpChip } from '@/ui/components/XpChip';
import { BarHeatMapCard, TimingHistogramCard, TipCard } from '@/ui/components/reportSections';
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
  const tip = nextStep(lesson, reward);
  const [reportOpen, setReportOpen] = useState(false);

  // Chart lessons carry their scored take — surface the honest timing detail
  // (one tip inline + the full report behind a disclosure, user decision C3).
  const take = useMemo(() => {
    if (!reward.attempt) return null;
    const resolved = chartForLesson(getContent(), lesson);
    if (!resolved) return null;
    return { attempt: reward.attempt, chart: resolved.chart };
  }, [lesson, reward.attempt]);
  const takeTip = take ? generateTip(take.attempt, take.chart) : null;

  return (
    <div
      data-testid="lesson-result"
      className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center animate-fade-up"
    >
      <Celebration show={reward.tierAdvanced} />
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

      {reward.xp > 0 && <XpChip xp={reward.xp} track={reward.track} />}

      {/* Warm celebration tier (§4a): milestone chips pop in, staggered. */}
      {reward.moduleCompleted && (
        <div className="flex animate-pop items-center gap-2 rounded-2xl bg-mint-soft px-4 py-2.5 text-sm font-medium text-mint-deep">
          <Sparkles size={16} /> Module complete!
        </div>
      )}
      {reward.tierAdvanced && (
        <div
          className="flex animate-pop items-center gap-2 rounded-2xl bg-amber-soft px-4 py-2.5 text-sm font-medium text-amber-deep"
          style={{ animationDelay: '120ms' }}
        >
          <TrendingUp size={16} /> Level up — welcome to Tier {reward.newLearningTier}!
        </div>
      )}
      {reward.newlyUnlockedSongIds.length > 0 && (
        <div
          className="animate-pop rounded-2xl bg-peri-soft px-4 py-2.5 text-sm font-medium text-peri-deep"
          style={{ animationDelay: '240ms' }}
        >
          New song unlocked — find it in Free Play.
        </div>
      )}
      {/* A celebratory chip on a failed take reads as a contradiction — the
          level-up still recorded; it just waits for the next pass to shine. */}
      {reward.passed && reward.chartReward?.songMasteryLeveledTo !== undefined && (
        <div
          className="animate-pop rounded-2xl bg-rose-soft px-4 py-2.5 text-sm font-medium text-rose-deep"
          style={{ animationDelay: '180ms' }}
        >
          Song mastery leveled up →{' '}
          {SONG_MASTERY_LABELS[reward.chartReward.songMasteryLeveledTo]}
        </div>
      )}

      {/* Chart takes: one actionable tip inline, the full report on demand. */}
      {take && takeTip && (
        <div className="flex w-full flex-col gap-3 text-left">
          <TipCard tip={takeTip} />
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            className="inline-flex items-center gap-1 self-center text-sm font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            See the full take report{' '}
            {reportOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {reportOpen && (
            <div className="flex flex-col gap-3 animate-fade-up">
              <TimingHistogramCard attempt={take.attempt} />
              <BarHeatMapCard attempt={take.attempt} chart={take.chart} />
            </div>
          )}
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
