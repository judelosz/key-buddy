import { describe, it, expect } from 'vitest';
import type { Attempt, PlayerState, SkillProgress } from '@/core/types';
import type { CurriculumLesson, LessonProgress, SongMastery } from '@/core/curriculum/types';
import { ContentService } from '@/core/content/contentService';
import { rawContent } from '@/core/content/bundled';
import { nextRecommendedLesson } from '@/core/curriculum/selectors';
import { recordLessonAttempt } from '@/core/session/recordLesson';
import { initialPlayerState } from '@/data/repository';

/**
 * Walk the entire authored path (every tier with a gate) through the real reducer, one
 * simulated day per lesson, always following nextRecommendedLesson. Proves the
 * whole curriculum is completable: every gate's XP band is reachable, bosses
 * are playable, checkpoints pass, and delayed reviews occur naturally as FSRS
 * cards come due across days.
 */
const DAY = 86_400_000;
const START = Date.parse('2026-07-22T12:00:00Z');

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function cannedAttempt(refId: string, refKind: 'chart' | 'fragment', performance: boolean, nowMs: number): Attempt {
  return {
    id: `walk-${refId}-${nowMs}`,
    refId,
    refKind,
    timestamp: nowMs,
    perNoteGrades: [],
    timingHistogram: { buckets: [], meanMs: 0, medianMs: 0, stdDevMs: 0 },
    wrongNotes: [],
    extraNotes: 0,
    notesCorrectPct: 1,
    goodOrBetterPct: 1,
    greatOrBetterPct: 0.9,
    stars: 3,
    masteryStar: performance,
    atTempo: performance,
    tempoBPM: 96,
    assistsUsed: [],
    xpAwarded: 0,
    riffsAwarded: 0,
  };
}

describe('the authored path is completable end to end', () => {
  it('walking every recommended lesson advances through every authored gate', () => {
    const content = ContentService.createValidated(rawContent);
    let player: PlayerState = initialPlayerState();
    let skills = new Map<string, SkillProgress>();
    let lessons = new Map<string, LessonProgress>();
    let songMastery = new Map<string, SongMastery>();
    let chartMastery = new Map<string, boolean>();
    let nowMs = START;

    const visited: string[] = [];
    for (let step = 0; step < 500; step++) {
      const next = nextRecommendedLesson(content, lessons, player.learningTier, skills, nowMs);
      if (!next) {
        if (player.learningTier >= 6) break;
        nowMs += DAY; // nothing due yet — wait for reviews to age in
        continue;
      }
      const lesson: CurriculumLesson = next.lesson;
      visited.push(lesson.id);

      const isChart = lesson.exerciseType === 'play-chart' || lesson.exerciseType === 'fragment';
      const chartId = lesson.chartId ?? lesson.fragmentId ?? '';
      const chartObj = lesson.chartId
        ? content.getChart(lesson.chartId)!
        : lesson.fragmentId
          ? {
              id: lesson.fragmentId,
              songId: content.getFragment(lesson.fragmentId)!.sourceSongId,
              arrangementLevel: 'simplified' as const,
              ...content.getFragment(lesson.fragmentId)!.chart,
            }
          : undefined;
      const song = lesson.chartId
        ? content.getSong(content.getChart(lesson.chartId)!.songId)!
        : lesson.fragmentId
          ? content.getSong(content.getFragment(lesson.fragmentId)!.sourceSongId)!
          : undefined;

      const outcome = recordLessonAttempt({
        lesson,
        module: next.module,
        result: isChart
          ? undefined
          : {
              lessonId: lesson.id,
              exerciseType: lesson.exerciseType,
              promptCount: 5,
              correctCount: 5,
              scorePct: 1,
              details: [],
            },
        chartOutcome: isChart
          ? {
              song: song!,
              chart: chartObj!,
              attempt: cannedAttempt(
                chartId,
                lesson.exerciseType === 'fragment' ? 'fragment' : 'chart',
                lesson.mode === 'performance',
                nowMs,
              ),
              prevBestStars: 0,
            }
          : undefined,
        playerState: player,
        skillProgressById: skills,
        lessonProgressById: lessons,
        songMastery: song ? songMastery.get(song.id) : undefined,
        gate: {
          tierGates: content.tierGates,
          assessments: content.assessments,
          lessonProgressById: lessons,
          chartMasteryById: chartMastery,
        },
        allSkills: content.skills,
        allSongs: [...content.songs],
        nowMs,
        todayISO: iso(nowMs),
        rand: 1,
      });

      expect(outcome.reward.passed, `lesson ${lesson.id} should pass with a perfect result`).toBe(true);

      player = outcome.playerState;
      skills = new Map(skills);
      for (const s of outcome.changedSkills) skills.set(s.skillId, s);
      lessons = new Map(lessons).set(lesson.id, outcome.lessonProgress);
      if (outcome.songMastery) {
        songMastery = new Map(songMastery).set(outcome.songMastery.songId, outcome.songMastery);
      }
      if (outcome.chart) {
        chartMastery = new Map(chartMastery).set(
          outcome.chart.attempt.refId,
          chartMastery.get(outcome.chart.attempt.refId) || outcome.chart.chartMasteryStar,
        );
      }
      nowMs += DAY; // one lesson a day — lets FSRS reviews come due naturally
    }

    // Every authored lesson was reached (reviews may repeat some).
    const allLessonIds = content.modules.flatMap((m) => m.lessonIds);
    expect(new Set(visited).size).toBe(allLessonIds.length);

    // Every authored tier gate opened along the way (content-driven, so the
    // suite extends itself as new tiers are authored).
    const gateTiers = content.tierGates.map((g) => g.tier).sort((a, b) => a - b);
    const topTier = gateTiers[gateTiers.length - 1] + 1;
    expect(player.learningTier).toBe(topTier);
    expect(player.playerLevel).toBe(topTier);
    expect(Object.keys(player.tierGatePassedAt).map(Number).sort((a, b) => a - b)).toEqual(gateTiers);
  });
});
