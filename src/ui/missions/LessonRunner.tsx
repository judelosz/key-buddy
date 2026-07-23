import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Attempt } from '@/core/types';
import type { CurriculumLesson, LessonMode, Module } from '@/core/curriculum/types';
import type { ExerciseResult, ExerciseSpec, PromptResult } from '@/core/exercise/types';
import { generateExercise } from '@/core/exercise/generators';
import { getContent } from '@/core/content/bundled';
import { chartForLesson } from '@/core/content/resolveChart';
import type { LessonReward } from '@/core/session/recordLesson';
import { useAppStore } from '@/ui/store/appStore';
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
import { LessonResult } from './LessonResult';
import { MODE_LABELS, ModeChip } from './modeChip';

/** How each practice mode configures the chart player (doc 06 §3.3/§3.4). */
function policyForMode(mode: LessonMode): ChartPlayerPolicy {
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

const chartFor = (lesson: CurriculumLesson) => chartForLesson(getContent(), lesson);

/**
 * Full-screen lesson takeover (rendered over the Missions tab). Dispatches by
 * exercise type: chart/fragment lessons drive the shared ChartPlayer with a
 * mode-derived policy; everything else runs through the ExerciseRunner.
 */
export function LessonRunner({ lesson, module }: { lesson: CurriculumLesson; module: Module }) {
  const setActiveLesson = useAppStore((s) => s.setActiveLesson);
  const [reward, setReward] = useState<LessonReward | null>(null);
  const [nonce, setNonce] = useState(0); // bump to retry with a fresh instance

  const close = () => setActiveLesson(null);
  const retry = () => {
    setReward(null);
    setNonce((n) => n + 1);
  };

  const isChartLesson =
    lesson.exerciseType === 'play-chart' || lesson.exerciseType === 'fragment';

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
        <LessonResult lesson={lesson} reward={reward} onContinue={close} onRetry={retry} />
      ) : isChartLesson ? (
        <ChartLesson
          key={nonce}
          lesson={lesson}
          module={module}
          onReward={setReward}
          onExit={close}
        />
      ) : (
        <ExerciseLesson key={nonce} lesson={lesson} module={module} onReward={setReward} />
      )}
    </div>
  );
}

function ChartLesson({
  lesson,
  module,
  onReward,
  onExit,
}: {
  lesson: CurriculumLesson;
  module: Module;
  onReward: (r: LessonReward) => void;
  onExit: () => void;
}) {
  const recordLesson = useGameStore((s) => s.recordLesson);
  const resolved = useMemo(() => chartFor(lesson), [lesson]);
  if (!resolved) return <p className="text-sm text-ink-soft">This lesson's music is missing.</p>;

  const onAttemptCaptured = (attempt: Attempt) => {
    void recordLesson(lesson, module, { song: resolved.song, chart: resolved.chart, attempt }).then(onReward);
  };

  return (
    <ChartPlayer
      song={resolved.song}
      chart={resolved.chart}
      policy={policyForMode(lesson.mode)}
      onExit={onExit}
      onAttemptCaptured={onAttemptCaptured}
      exitLabel="Missions"
      banner={
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
      }
    />
  );
}

function ExerciseLesson({
  lesson,
  module,
  onReward,
}: {
  lesson: CurriculumLesson;
  module: Module;
  onReward: (r: LessonReward) => void;
}) {
  const recordLesson = useGameStore((s) => s.recordLesson);
  const [, setTick] = useState(0);
  const [lastResult, setLastResult] = useState<PromptResult | null>(null);
  const runnerRef = useRef<ExerciseRunner | null>(null);

  const spec: ExerciseSpec | null = useMemo(() => {
    if (lesson.exerciseType === 'listen') {
      return {
        lessonId: lesson.id,
        exerciseType: 'listen',
        tier: module.tier,
        prompts: [
          {
            id: `${lesson.id}-p0`,
            displayText:
              typeof lesson.generatorParams?.promptText === 'string'
                ? lesson.generatorParams.promptText
                : 'Watch and listen.',
            expected: { kind: 'watch' },
          },
        ],
      };
    }
    const concept = lesson.theoryConceptId
      ? getContent().getTheoryConcept(lesson.theoryConceptId)
      : undefined;
    return generateExercise(lesson, { tier: module.tier, concept }, Math.random);
  }, [lesson, module.tier]);

  useEffect(() => {
    if (!spec) return;
    const runner = new ExerciseRunner(spec, {
      onChange: () => setTick((t) => t + 1),
      onPromptResult: (r) => {
        setLastResult(r);
        setTick((t) => t + 1);
      },
      onDone: (result: ExerciseResult) => {
        void recordLesson(lesson, module, { result }).then(onReward);
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

  const listenChart = lesson.exerciseType === 'listen' ? chartFor(lesson) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">{lesson.prompt}</p>
      <ExerciseShell
        prompt={prompt}
        progress={runner.engine.progress}
        lastResult={lastResult}
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
