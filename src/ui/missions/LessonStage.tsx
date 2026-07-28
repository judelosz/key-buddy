import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Attempt } from '@/core/types';
import type { CurriculumLesson, LessonMode, Module } from '@/core/curriculum/types';
import type { ExerciseResult, ExerciseSpec, PromptResult } from '@/core/exercise/types';
import { generateExercise } from '@/core/exercise/generators';
import { getContent } from '@/core/content/bundled';
import { chartForLesson } from '@/core/content/resolveChart';
import type { LessonReward, SessionRunContext } from '@/core/session/recordLesson';
import { useGameStore } from '@/ui/store/gameStore';
import { ExerciseRunner } from '@/ui/session/exerciseRunner';
import { ChartPlayer, type ChartPlayerPolicy } from '@/ui/components/ChartPlayer';
import { ExerciseShell } from '@/ui/exercises/ExerciseShell';
import {
  ChoiceExerciseView,
  KeyboardExerciseView,
  ListenExerciseView,
  RhythmTapExerciseView,
} from '@/ui/exercises/exerciseViews';
import { MODE_LABELS } from './modeChip';

/** How each practice mode configures the chart player (doc 06 §3.3/§3.4). */
export function policyForMode(mode: LessonMode): ChartPlayerPolicy {
  switch (mode) {
    case 'guided':
      return { tempo: 0.65, fallingNotes: 'on', allowWatch: true, allowArrangementChoice: false };
    case 'supported':
      return { tempo: 'choice', fallingNotes: 'choice', allowWatch: true, allowArrangementChoice: false };
    case 'independent':
      return { tempo: 'choice', fallingNotes: 'off', allowWatch: false, allowArrangementChoice: false };
    case 'performance':
      return { tempo: 1, fallingNotes: 'off', allowWatch: false, allowArrangementChoice: false };
    case 'scouting':
    case 'woodshed':
      return { tempo: 0.5, fallingNotes: 'on', allowWatch: true, allowArrangementChoice: false };
  }
}

const CHECKPOINT_MODES: readonly LessonMode[] = ['independent', 'performance'];

export interface LessonStageProps {
  lesson: CurriculumLesson;
  module: Module;
  /** Adaptive override for chart lessons (checkpoints only via practiceRun). */
  policyOverride?: { tempoPct: number; fallingNotes: 'on' | 'off' };
  /** Adaptive generator overrides (e.g. rhythm-tap bpm); checkpoint-guarded. */
  generatorOverrides?: Record<string, unknown>;
  /** An explicitly labeled stepped-down rep: overrides apply even on a
   * checkpoint (checkpoint honesty still fails assisted/slowed takes). */
  practiceRun?: boolean;
  /** Replaces the default mode banner (e.g. an adaptation explanation). */
  banner?: ReactNode;
  /** Session bookkeeping threaded into recordLesson, when inside a session. */
  sessionCtx?: SessionRunContext;
  onReward: (r: LessonReward) => void;
  onExit: () => void;
  exitLabel?: string;
  /** Host renders its own frame with a back affordance — drop ChartPlayer's
   * header row so chart lessons never show two stacked headers. */
  hideChartHeader?: boolean;
}

/**
 * The lesson execution dispatcher — THE single recordLesson call site.
 * Chart/fragment lessons drive the shared ChartPlayer with a mode-derived
 * policy; everything else runs through the ExerciseRunner. Hosts (LessonRunner,
 * SessionRunner) frame it and consume the reward.
 */
export function LessonStage(props: LessonStageProps) {
  const isChartLesson =
    props.lesson.exerciseType === 'play-chart' || props.lesson.exerciseType === 'fragment';
  return isChartLesson ? <ChartLesson {...props} /> : <ExerciseLesson {...props} />;
}

function ChartLesson({
  lesson,
  module,
  policyOverride,
  practiceRun,
  banner,
  sessionCtx,
  onReward,
  onExit,
  exitLabel,
  hideChartHeader,
}: LessonStageProps) {
  const recordLesson = useGameStore((s) => s.recordLesson);
  const resolved = useMemo(() => chartForLesson(getContent(), lesson), [lesson]);
  if (!resolved) return <p className="text-sm text-ink-soft">This lesson's music is missing.</p>;

  const onAttemptCaptured = (attempt: Attempt) => {
    void recordLesson(
      lesson,
      module,
      { song: resolved.song, chart: resolved.chart, attempt },
      sessionCtx,
    ).then(onReward);
  };

  // Checkpoint policies are sacrosanct — overrides touch them only as an
  // explicitly labeled practice run (which honesty rules keep from passing).
  const base = policyForMode(lesson.mode);
  const applyOverride =
    policyOverride !== undefined &&
    (practiceRun === true || !CHECKPOINT_MODES.includes(lesson.mode));
  const policy: ChartPlayerPolicy = applyOverride
    ? { ...base, tempo: policyOverride.tempoPct, fallingNotes: policyOverride.fallingNotes }
    : base;

  return (
    <ChartPlayer
      song={resolved.song}
      chart={resolved.chart}
      policy={policy}
      onExit={onExit}
      onAttemptCaptured={onAttemptCaptured}
      exitLabel={exitLabel ?? 'Missions'}
      hideHeader={hideChartHeader}
      banner={
        banner ?? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              lesson.mode === 'performance'
                ? 'bg-rose-soft text-rose-deep'
                : lesson.mode === 'scouting'
                  ? 'bg-peri-soft text-peri-deep'
                  : 'bg-sand text-ink-soft'
            }`}
          >
            <span className="font-display font-semibold">{MODE_LABELS[lesson.mode]}: </span>
            {lesson.prompt} <span className="opacity-75">({lesson.successRule})</span>
          </div>
        )
      }
    />
  );
}

function ExerciseLesson({
  lesson,
  module,
  generatorOverrides,
  practiceRun,
  banner,
  sessionCtx,
  onReward,
}: LessonStageProps) {
  const recordLesson = useGameStore((s) => s.recordLesson);
  const [, setTick] = useState(0);
  const [lastResult, setLastResult] = useState<PromptResult | null>(null);
  const runnerRef = useRef<ExerciseRunner | null>(null);

  const effectiveLesson: CurriculumLesson = useMemo(() => {
    const apply =
      generatorOverrides !== undefined &&
      (practiceRun === true || !CHECKPOINT_MODES.includes(lesson.mode));
    if (!apply) return lesson;
    return {
      ...lesson,
      generatorParams: { ...lesson.generatorParams, ...generatorOverrides },
    };
  }, [lesson, generatorOverrides, practiceRun]);

  const spec: ExerciseSpec | null = useMemo(() => {
    if (effectiveLesson.exerciseType === 'listen') {
      return {
        lessonId: effectiveLesson.id,
        exerciseType: 'listen',
        tier: module.tier,
        prompts: [
          {
            id: `${effectiveLesson.id}-p0`,
            displayText:
              typeof effectiveLesson.generatorParams?.promptText === 'string'
                ? effectiveLesson.generatorParams.promptText
                : 'Watch and listen.',
            expected: { kind: 'watch' },
          },
        ],
      };
    }
    const concept = effectiveLesson.theoryConceptId
      ? getContent().getTheoryConcept(effectiveLesson.theoryConceptId)
      : undefined;
    return generateExercise(effectiveLesson, { tier: module.tier, concept }, Math.random);
  }, [effectiveLesson, module.tier]);

  useEffect(() => {
    if (!spec) return;
    const runner = new ExerciseRunner(spec, {
      onChange: () => setTick((t) => t + 1),
      onPromptResult: (r) => {
        setLastResult(r);
        setTick((t) => t + 1);
      },
      onDone: (result: ExerciseResult) => {
        void recordLesson(lesson, module, { result }, sessionCtx).then(onReward);
      },
    });
    runnerRef.current = runner;
    runner.begin();
    return () => runner.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  const runner = runnerRef.current;
  if (!spec || !runner) return null;
  const prompt = runner.currentPrompt;
  const answeredPrompt = lastResult
    ? (spec.prompts.find((p) => p.id === lastResult.promptId) ?? null)
    : null;

  const listenChart =
    lesson.exerciseType === 'listen' ? chartForLesson(getContent(), lesson) : null;

  return (
    <div className="flex flex-col gap-4">
      {banner ?? <p className="text-sm text-ink-soft">{lesson.prompt}</p>}
      <ExerciseShell
        prompt={prompt}
        progress={runner.engine.progress}
        lastResult={lastResult}
        answeredPrompt={answeredPrompt}
        onReplayAudio={() => void runner.playPromptAudio()}
      >
        {prompt && lesson.exerciseType === 'listen' && listenChart && (
          <ListenExerciseView
            runner={runner}
            chart={listenChart.chart}
            tempoBPM={Math.round(listenChart.song.tempoTargetBPM * 0.9)}
          />
        )}
        {prompt && (lesson.exerciseType === 'note-id' || lesson.exerciseType === 'build-chord') && (
          <KeyboardExerciseView
            runner={runner}
            showCheck={lesson.exerciseType === 'build-chord'}
            // Doc 06 §3.3: guided/supported keep note names; independent and
            // performance checkpoints test the keyboard map itself.
            noteLabels={
              lesson.mode === 'guided' ||
              lesson.mode === 'supported' ||
              lesson.mode === 'scouting' ||
              lesson.assistOptions.includes('note-names')
            }
          />
        )}
        {prompt && lesson.exerciseType === 'rhythm-tap' && <RhythmTapExerciseView runner={runner} />}
        {prompt &&
          (lesson.exerciseType === 'theory-quiz' ||
            lesson.exerciseType === 'interval-ear' ||
            lesson.exerciseType === 'chord-ear') && (
            <ChoiceExerciseView prompt={prompt} runner={runner} disabled={false} />
          )}
      </ExerciseShell>
    </div>
  );
}
