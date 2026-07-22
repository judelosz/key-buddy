/**
 * SongMastery reducer foundation (doc 06 §5.2). A song's durable mastery is a
 * reducer over many Attempts across days — never inferred from one great take.
 *
 * Phase 4 computes only the low levels:
 *   0 Discovered — the song has been seen/heard (preview, listen lesson)
 *   1 Started    — at least one real chart/fragment attempt
 * Levels 2–5 need chart sections and the Phase-5 evidence engine; meanwhile
 * qualifying-performance evidence (mastery-quality takes on distinct days)
 * accumulates here so nothing is lost before Phase 5 turns it on.
 */
import type { Attempt } from '@/core/types';
import type { SongMastery } from '@/core/curriculum/types';

export function initialSongMastery(songId: string): SongMastery {
  return {
    songId,
    level: 0,
    sectionProgress: {},
    transitionProgress: {},
    qualifyingSessionDates: [],
    transferEvidence: [],
    weakSectionIds: [],
  };
}

export type SongEvidence =
  | { kind: 'previewed' }
  | { kind: 'chart-attempt'; attempt: Attempt; todayISO: string };

export function updateSongMastery(prev: SongMastery, evidence: SongEvidence): SongMastery {
  if (evidence.kind === 'previewed') {
    return prev; // Discovery is level 0 — creating the record is the evidence.
  }

  const { attempt, todayISO } = evidence;
  const qualifying =
    attempt.masteryStar && !prev.qualifyingSessionDates.includes(todayISO)
      ? [...prev.qualifyingSessionDates, todayISO]
      : prev.qualifyingSessionDates;

  // Best-attempt tracking is class-based (mastery beats everything); finer
  // comparison needs the stored attempt and arrives with the Phase-5 engine.
  const bestAttemptId =
    prev.bestAttemptId === undefined || attempt.masteryStar ? attempt.id : prev.bestAttemptId;

  return {
    ...prev,
    level: prev.level < 1 ? 1 : prev.level,
    qualifyingSessionDates: qualifying,
    lastAttemptId: attempt.id,
    bestAttemptId,
    lastAdvancedAt: prev.level < 1 ? attempt.timestamp : prev.lastAdvancedAt,
  };
}
