import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Compass,
  Play,
  RotateCcw,
  SkipForward,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Attempt, Chart, Song } from '@/core/types';
import type { CurriculumLesson, Module } from '@/core/curriculum/types';
import { getContent } from '@/core/content/bundled';
import { fragmentAsChart } from '@/core/content/resolveChart';
import { sliceChartSection } from '@/core/songMastery/sections';
import {
  activityRef,
  xpPurposeFor,
  type SessionSegment,
} from '@/core/session/sessionTypes';
import type { LessonReward } from '@/core/session/recordLesson';
import {
  directiveLabel,
  generatorOverridesFor,
  isSteppable,
  policyOverrideFor,
  practiceGeneratorOverridesFor,
  practicePolicyOverrideFor,
} from '@/core/adaptive/adaptive';
import { useAppStore } from '@/ui/store/appStore';
import { useGameStore, type SessionSummary } from '@/ui/store/gameStore';
import { Celebration } from '@/ui/components/Celebration';
import { ChartPlayer, type ChartPlayerPolicy } from '@/ui/components/ChartPlayer';
import { XpChip } from '@/ui/components/XpChip';
import { GradeBadge } from '@/ui/components/reportSections';
import { LessonStage } from '@/ui/missions/LessonStage';
import { ModeChip } from '@/ui/missions/modeChip';
import { headline } from '@/ui/missions/resultCopy';
import { buildsFor, framingFor } from './segmentCopy';
import { SessionWrap } from './SessionWrap';

/** What one finished segment shows on its compact result card. */
interface SegmentResultData {
  passed: boolean;
  scorePct: number;
  xp: number;
  track: 'hands' | 'head';
  headlineText: string;
  tierAdvanced: boolean;
  songLeveledTo?: number;
  /** Set only for performance-mode segments — recital surfaces get a grade. */
  gradedAttempt?: Attempt;
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'run'; nonce: number; practice: boolean }
  | { kind: 'result'; data: SegmentResultData }
  | { kind: 'wrap'; summary: SessionSummary };

interface ResolvedSegment {
  segment: SessionSegment;
  lesson?: CurriculumLesson;
  module?: Module;
  song?: Song;
  /** Chart handed to the player (slice for drills, synthetic for fragments). */
  playChart?: Chart;
  /** Parent chart handed to the reducer for attribution. */
  parentChart?: Chart;
  title: string;
  subtitle?: string;
}

function resolveSegment(segment: SessionSegment): ResolvedSegment | null {
  const content = getContent();
  const a = segment.activity;
  if (a.kind === 'lesson') {
    const lesson = content.getLesson(a.lessonId);
    const module = content.getModule(a.moduleId);
    if (!lesson || !module) return null;
    return { segment, lesson, module, title: lesson.title, subtitle: module.title };
  }
  const song = content.getSong(a.songId);
  if (!song) return null;
  if (a.kind === 'fragment') {
    const fragment = content.getFragment(a.fragmentId);
    if (!fragment) return null;
    return {
      segment,
      song,
      playChart: fragmentAsChart(fragment),
      title: fragment.label,
      subtitle: `from “${song.title}”`,
    };
  }
  const parentChart = content.getChart(a.chartId);
  if (!parentChart) return null;
  if (a.kind === 'section-drill') {
    const slice = sliceChartSection(parentChart, a.sectionId);
    const label = parentChart.sections?.find((s) => s.id === a.sectionId)?.label ?? a.sectionId;
    if (!slice) return null;
    return { segment, song, playChart: slice, parentChart, title: song.title, subtitle: label };
  }
  return { segment, song, playChart: parentChart, parentChart, title: song.title, subtitle: 'Full take' };
}

/** Song-time segments practice openly; stretch runs like scouting. */
function chartPolicyFor(segment: SessionSegment): ChartPlayerPolicy {
  if (segment.purpose === 'stretch-boss') {
    return { tempo: 0.5, fallingNotes: 'on', allowWatch: true, allowArrangementChoice: false };
  }
  return { tempo: 'choice', fallingNotes: 'choice', allowWatch: true, allowArrangementChoice: false };
}

/**
 * The practice-session takeover (rendered over Missions, like a lesson).
 * Per segment: intro card (why this, framed positively) → run through the
 * SAME recording paths as everywhere else (LessonStage / ChartPlayer +
 * recordAttempt) → compact result → next. Open-ended: the queue refills as it
 * drains, and "Wrap up" is always one click away with zero guilt.
 */
export function SessionRunner() {
  const setSessionActive = useAppStore((s) => s.setSessionActive);
  const activeSession = useGameStore((s) => s.activeSession);
  const completeSegment = useGameStore((s) => s.completeSegment);
  const skipSegment = useGameStore((s) => s.skipSegment);
  const endSession = useGameStore((s) => s.endSession);
  const recordAttempt = useGameStore((s) => s.recordAttempt);
  const adaptationFor = useGameStore((s) => s.adaptationFor);
  const lastAdaptation = useGameStore((s) => s.lastAdaptation);

  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  // Set the moment a wrap begins — endSession clears activeSession before the
  // wrap phase lands, and the auto-exit below must not fire in that window.
  const wrappingRef = useRef(false);

  const current = activeSession?.plan.queue[0] ?? null;
  const completedCount = activeSession?.runState.completed.length ?? 0;
  const resolved = current ? resolveSegment(current) : null;

  const wrapUp = async () => {
    if (wrappingRef.current) return;
    wrappingRef.current = true;
    const summary = await endSession();
    if (summary) setPhase({ kind: 'wrap', summary });
    else setSessionActive(false);
  };

  // No session at all (and not mid-wrap) → leave the takeover.
  useEffect(() => {
    if (phase.kind === 'wrap' || wrappingRef.current) return;
    if (!activeSession) setSessionActive(false);
  }, [activeSession, phase.kind, setSessionActive]);

  // Queue ran completely dry mid-session — wrap with what happened.
  useEffect(() => {
    if (activeSession && !current && phase.kind !== 'wrap') void wrapUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, current, phase.kind]);

  // Unresolvable content — skip it rather than trap the session.
  useEffect(() => {
    if (current && !resolved) {
      void skipSegment(current.id).then(() => setPhase({ kind: 'intro' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, resolved]);

  if (phase.kind === 'wrap') {
    return <SessionWrap summary={phase.summary} onDone={() => setSessionActive(false)} />;
  }
  if (!activeSession || !current || !resolved) return null;

  const advance = async (outcome: { passed: boolean; scorePct: number }) => {
    const { next } = await completeSegment({ segmentId: current.id, ...outcome });
    if (next) setPhase({ kind: 'intro' });
    else await wrapUp();
  };

  const onLessonReward = (r: LessonReward) => {
    setPhase({
      kind: 'result',
      data: {
        passed: r.passed,
        scorePct: r.scorePct,
        xp: r.xp,
        track: r.track,
        headlineText: resolved.lesson ? headline(resolved.lesson, r) : 'Done.',
        tierAdvanced: r.tierAdvanced,
        songLeveledTo: r.chartReward?.songMasteryLeveledTo,
        gradedAttempt: resolved.lesson?.mode === 'performance' ? r.attempt : undefined,
      },
    });
  };

  const onChartAttempt = (raw: Attempt) => {
    if (!resolved.song || !resolved.playChart) return;
    const isStretch = current.purpose === 'stretch-boss';
    const attempt: Attempt = { ...raw };
    if (current.activity.kind === 'section-drill') {
      attempt.refId = resolved.parentChart?.id ?? raw.refId;
      attempt.sectionId = current.activity.sectionId;
    }
    if (current.activity.kind === 'fragment') attempt.refKind = 'fragment';
    const chartForReducer = resolved.parentChart ?? resolved.playChart;
    void recordAttempt(resolved.song, chartForReducer, attempt, {
      sessionId: activeSession.plan.sessionId,
      skipSongMastery: isStretch,
    }).then((reward) => {
      setPhase({
        kind: 'result',
        data: {
          passed: isStretch || attempt.stars >= 2,
          scorePct: attempt.notesCorrectPct,
          xp: reward.xp,
          track: 'hands',
          headlineText: isStretch
            ? 'That’s where you’re headed. No pressure — it counts as exploring.'
            : attempt.stars >= 2
              ? 'Solid take — it all counted.'
              : 'Not this take — and that’s fine.',
          tierAdvanced: reward.tierAdvanced,
          songLeveledTo: reward.songMasteryLeveledTo,
        },
      });
    });
  };

  // ── Run phase ──────────────────────────────────────────────────────────────
  if (phase.kind === 'run') {
    const banner =
      current.adaptation || phase.practice ? (
        <div className="rounded-2xl bg-peri-soft px-4 py-3 text-sm text-peri-ink">
          <span className="font-display font-semibold">Adjusted: </span>
          {phase.practice && lastAdaptation?.directive
            ? lastAdaptation.directive.message
            : current.adaptation?.message}
        </div>
      ) : undefined;

    if (resolved.lesson && resolved.module) {
      const adapt = adaptationFor(resolved.lesson);
      const sessionCtx = {
        sessionId: activeSession.plan.sessionId,
        purpose: xpPurposeFor(current.purpose),
        addressedRecordedWeakness: current.purpose === 'remediation',
      };
      return (
        <SessionFrame
          completed={completedCount}
          remaining={activeSession.plan.queue.length}
          onWrapUp={wrapUp}
        >
          <LessonStage
            key={`${current.id}-${phase.nonce}`}
            lesson={resolved.lesson}
            module={resolved.module}
            policyOverride={
              phase.practice
                ? practicePolicyOverrideFor(resolved.lesson, adapt)
                : policyOverrideFor(resolved.lesson, adapt)
            }
            generatorOverrides={
              phase.practice
                ? practiceGeneratorOverridesFor(resolved.lesson, adapt)
                : generatorOverridesFor(resolved.lesson, adapt)
            }
            practiceRun={phase.practice}
            banner={banner}
            sessionCtx={sessionCtx}
            onReward={onLessonReward}
            onExit={() => setPhase({ kind: 'intro' })}
            exitLabel="Session"
          />
        </SessionFrame>
      );
    }
    if (resolved.song && resolved.playChart) {
      return (
        <SessionFrame
          completed={completedCount}
          remaining={activeSession.plan.queue.length}
          onWrapUp={wrapUp}
        >
          <ChartPlayer
            key={`${current.id}-${phase.nonce}`}
            song={resolved.song}
            chart={resolved.playChart}
            policy={chartPolicyFor(current)}
            onExit={() => setPhase({ kind: 'intro' })}
            onAttemptCaptured={onChartAttempt}
            exitLabel="Session"
            banner={
              banner ?? (
                <div className="rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
                  <span className="font-display font-semibold">
                    {framingFor(current.purpose).eyebrow}:{' '}
                  </span>
                  {current.reason}
                </div>
              )
            }
          />
        </SessionFrame>
      );
    }
    return null;
  }

  // ── Result phase ───────────────────────────────────────────────────────────
  if (phase.kind === 'result') {
    const d = phase.data;
    const isStretch = current.purpose === 'stretch-boss';
    const ref = activityRef(current.activity);
    const refId =
      current.activity.kind === 'lesson' ? current.activity.lessonId : ref.split(':')[1];
    const directive =
      !d.passed &&
      lastAdaptation?.next.refId === refId &&
      (resolved.lesson === undefined || resolved.lesson === null || isSteppable(resolved.lesson))
        ? lastAdaptation?.directive
        : undefined;
    const practiceOnly =
      resolved.lesson?.mode === 'independent' || resolved.lesson?.mode === 'performance';

    return (
      <SessionFrame
        completed={completedCount}
        remaining={activeSession.plan.queue.length}
        onWrapUp={wrapUp}
      >
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-8 text-center animate-fade-up">
          <Celebration show={d.tierAdvanced} />
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-full shadow-soft ${
              isStretch
                ? 'bg-peri-soft text-peri-ink'
                : d.passed
                  ? 'bg-mint-soft text-mint-ink'
                  : 'bg-amber-soft text-amber-ink'
            }`}
          >
            {isStretch ? <Compass size={24} /> : d.passed ? <TrendingUp size={24} /> : <RotateCcw size={22} />}
          </span>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {d.headlineText}
          </h2>
          {d.gradedAttempt && <GradeBadge attempt={d.gradedAttempt} />}
          {d.xp > 0 && <XpChip xp={d.xp} track={d.track} size="sm" />}
          {d.tierAdvanced && (
            <div className="flex animate-pop items-center gap-2 rounded-2xl bg-amber-soft px-4 py-2 text-sm font-medium text-amber-ink">
              <TrendingUp size={15} /> Level up!
            </div>
          )}
          {d.passed && d.songLeveledTo !== undefined && (
            <div className="animate-pop rounded-2xl bg-rose-soft px-4 py-2 text-sm font-medium text-rose-ink">
              Song mastery leveled up
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {d.passed || isStretch ? (
              <>
                <button type="button" onClick={wrapUp} className="rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px">
                  Wrap up
                </button>
                <button
                  type="button"
                  onClick={() => void advance({ passed: d.passed, scorePct: d.scorePct })}
                  className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
                >
                  Keep going <ArrowRight size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void advance({ passed: false, scorePct: d.scorePct })}
                  className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
                >
                  <SkipForward size={15} /> Skip for now
                </button>
                <button
                  type="button"
                  onClick={() => setPhase({ kind: 'run', nonce: Date.now(), practice: false })}
                  className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
                >
                  <RotateCcw size={15} /> Try again
                </button>
                {directive && (
                  <button
                    type="button"
                    onClick={() => setPhase({ kind: 'run', nonce: Date.now(), practice: true })}
                    className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
                  >
                    <TrendingDown size={16} /> {directiveLabel(directive, practiceOnly)}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </SessionFrame>
    );
  }

  // ── Intro phase ────────────────────────────────────────────────────────────
  const framing = framingFor(current.purpose);
  return (
    <SessionFrame
      completed={completedCount}
      remaining={activeSession.plan.queue.length}
      onWrapUp={wrapUp}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-10 text-center animate-fade-up">
        {/* First intro of the sitting: today's plan, so the whole session's
            purpose is visible before anything runs (transparency decision). */}
        {completedCount === 0 && activeSession.plan.queue.length > 1 && (
          <div className="flex max-w-md flex-wrap items-center justify-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
              Today&rsquo;s plan:
            </span>
            {activeSession.plan.queue.map((seg) => (
              <span
                key={seg.id}
                title={buildsFor(seg.purpose)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${framingFor(seg.purpose).tone}`}
              >
                {framingFor(seg.purpose).eyebrow.split(' — ')[0]}
              </span>
            ))}
            <span className="text-[11px] text-ink-soft">+ more if you want it</span>
          </div>
        )}
        <span className={`rounded-full px-4 py-1.5 font-display text-sm font-medium ${framing.tone}`}>
          {framing.eyebrow}
        </span>
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
            {resolved.title}
          </h2>
          {resolved.subtitle && <p className="mt-1 text-sm text-ink-soft">{resolved.subtitle}</p>}
        </div>
        <p className="flex max-w-md items-center justify-center gap-2 text-sm text-ink-soft">
          {resolved.lesson && <ModeChip mode={resolved.lesson.mode} />} {current.reason}
        </p>
        {/* What this segment builds toward — the level-up math, per card. */}
        <p className="max-w-md text-xs font-medium text-ink-soft">{buildsFor(current.purpose)}</p>
        {current.adaptation && (
          <p className="rounded-2xl bg-peri-soft px-4 py-2 text-xs text-peri-ink">
            {current.adaptation.message}
          </p>
        )}
        {framing.honesty && (
          <p className="max-w-md text-xs italic text-ink-soft">{framing.honesty}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void skipSegment(current.id).then(() => setPhase({ kind: 'intro' }))}
            className="rounded-full bg-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
          >
            Skip this one
          </button>
          <button
            type="button"
            onClick={() => setPhase({ kind: 'run', nonce: Date.now(), practice: false })}
            className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 font-display text-base font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
          >
            <Play size={18} className="fill-ink" /> Let’s go
          </button>
        </div>
        <button type="button" onClick={() => void wrapUp()} className="text-xs text-ink-soft underline-offset-2 hover:underline">
          Wrap up for today
        </button>
      </div>
    </SessionFrame>
  );
}

/** Shared session chrome: queue dots (never a fixed total) + wrap escape. */
function SessionFrame({
  completed,
  remaining,
  onWrapUp,
  children,
}: {
  completed: number;
  remaining: number;
  onWrapUp: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const upcoming = Math.min(Math.max(remaining - 1, 0), 2);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5" aria-label="Session progress">
          {Array.from({ length: completed }, (_, i) => (
            <span key={`d${i}`} className="h-2 w-2 rounded-full bg-mint-deep/80" />
          ))}
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-deep" />
          {Array.from({ length: upcoming }, (_, i) => (
            <span key={`u${i}`} className="h-2 w-2 rounded-full bg-sand" />
          ))}
          <span className="ml-1.5 text-[11px] text-ink-soft">more ready when you are</span>
        </div>
        <button
          type="button"
          onClick={() => void onWrapUp()}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Wrap up
        </button>
      </div>
      {children}
    </div>
  );
}
