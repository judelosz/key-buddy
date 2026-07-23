import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { CurriculumLesson, Module } from '@/core/curriculum/types';
import { getContent } from '@/core/content/bundled';
import type { LessonReward } from '@/core/session/recordLesson';
import {
  directiveLabel,
  practiceGeneratorOverridesFor,
  practicePolicyOverrideFor,
  type AdaptationDirective,
} from '@/core/adaptive/adaptive';
import { remediationCandidates } from '@/core/curriculum/remediation';
import { useAppStore } from '@/ui/store/appStore';
import { useGameStore } from '@/ui/store/gameStore';
import { LessonResult } from './LessonResult';
import { LessonStage } from './LessonStage';
import { ModeChip } from './modeChip';

interface AdaptiveRetry {
  policyOverride?: { tempoPct: number; fallingNotes: 'on' | 'off' };
  generatorOverrides?: Record<string, unknown>;
  message: string;
}

/**
 * Full-screen lesson takeover (rendered over the Missions tab): frame +
 * LessonStage (the single recording path) + LessonResult. A failed lesson
 * offers the doc-06 §5.6 step-down — a visibly changed retry, never an
 * identical dead-end — and, after repeated failure, the remediation lesson.
 */
export function LessonRunner({ lesson, module }: { lesson: CurriculumLesson; module: Module }) {
  const setActiveLesson = useAppStore((s) => s.setActiveLesson);
  const lastAdaptation = useGameStore((s) => s.lastAdaptation);
  const adaptationFor = useGameStore((s) => s.adaptationFor);
  const [reward, setReward] = useState<LessonReward | null>(null);
  const [retryOverride, setRetryOverride] = useState<AdaptiveRetry | null>(null);
  const [nonce, setNonce] = useState(0); // bump to retry with a fresh instance

  const close = () => setActiveLesson(null);
  const retry = () => {
    setReward(null);
    setRetryOverride(null);
    setNonce((n) => n + 1);
  };

  // The store already folded this result into the adaptive state; the offer
  // presents THAT directive (no double-stepping).
  const failedHere =
    reward !== null && !reward.passed && lastAdaptation?.next.refId === lesson.id;
  const directive: AdaptationDirective | undefined = failedHere
    ? lastAdaptation?.directive
    : undefined;
  const practiceOnly = lesson.mode === 'independent' || lesson.mode === 'performance';

  const stepDown =
    directive !== undefined
      ? {
          label: directiveLabel(directive, practiceOnly),
          onApply: () => {
            // Practice-run variants: a checkpoint step-down really is slowed /
            // guided — checkpoint honesty keeps it from passing as the boss.
            const adapt = adaptationFor(lesson);
            setRetryOverride({
              policyOverride: practicePolicyOverrideFor(lesson, adapt),
              generatorOverrides: practiceGeneratorOverridesFor(lesson, adapt),
              message: directive.message,
            });
            setReward(null);
            setNonce((n) => n + 1);
          },
        }
      : undefined;

  const remediationTarget =
    failedHere && lastAdaptation?.recommendRemediation
      ? remediationCandidates(getContent(), lesson)[0]
      : undefined;
  const remediation = remediationTarget
    ? {
        title: remediationTarget.title,
        onOpen: () =>
          setActiveLesson({
            moduleId: remediationTarget.moduleId,
            lessonId: remediationTarget.id,
          }),
      }
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={close}
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <ChevronLeft size={16} /> Missions
        </button>
        <div className="flex items-center gap-2 text-right">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              {lesson.title}
            </h2>
            <p className="text-xs text-ink-soft">{module.title}</p>
          </div>
          <ModeChip mode={lesson.mode} />
        </div>
      </div>

      {reward ? (
        <LessonResult
          lesson={lesson}
          reward={reward}
          onContinue={close}
          onRetry={retry}
          stepDown={stepDown}
          remediation={remediation}
        />
      ) : (
        <LessonStage
          key={nonce}
          lesson={lesson}
          module={module}
          policyOverride={retryOverride?.policyOverride}
          generatorOverrides={retryOverride?.generatorOverrides}
          practiceRun={retryOverride !== null}
          banner={
            retryOverride ? (
              <div className="rounded-2xl bg-peri-soft px-4 py-3 text-sm text-peri-deep">
                <span className="font-display font-semibold">Adjusted: </span>
                {retryOverride.message}
                {practiceOnly && (
                  <span className="opacity-75"> This is a practice run, not the checkpoint.</span>
                )}
              </div>
            ) : undefined
          }
          onReward={setReward}
          onExit={close}
        />
      )}
    </div>
  );
}
