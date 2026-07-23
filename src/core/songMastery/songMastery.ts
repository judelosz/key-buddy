/**
 * SongMastery reducer (doc 06 §5.2). A song's durable mastery is a reducer
 * over many Attempts across days — never inferred from one great take.
 *
 * Levels:
 *   0 Discovered        — seen/heard (record exists)
 *   1 Started           — at least one real chart attempt
 *   2 Sections learned  — every required section passed at least once
 *   3 Connected         — all transitions passed within ONE full take (any tempo)
 *   4 Performance-ready — ≥2 at-tempo qualifying performances on distinct days
 *   5 Durable mastery   — ≥5 qualifying performances across ≥5 days, ≥3 at
 *                         tempo, latest take has no weak section, one delayed
 *                         retrieval, and ≥1 transfer evidence
 *
 * A qualifying performance = full chart, zero assists, 3★, every required
 * section passed in that take; max one per calendar day. Levels are monotone.
 */
import type { Attempt, Chart } from '@/core/types';
import type {
  SectionMastery,
  SongMastery,
  TransferEvidence,
} from '@/core/curriculum/types';
import {
  SECTION_PASS,
  SECTION_TIMING_MIN,
  derivedTransitions,
  sectionResults,
  transitionResults,
} from './sections';

/** A song untouched for this long before a qualifying take = delayed retrieval. */
export const DELAYED_SONG_GAP_MS = 72 * 3_600_000;

export function initialSongMastery(songId: string): SongMastery {
  return {
    songId,
    level: 0,
    sectionProgress: {},
    transitionProgress: {},
    qualifyingSessionDates: [],
    qualifyingPerformances: [],
    transferEvidence: [],
    weakSectionIds: [],
  };
}

/** Fill Phase-5 fields on rows persisted by the Phase-4 schema. Old qualifying
 * dates required the mastery star, which implies at-tempo. Idempotent. */
export function normalizeSongMastery(raw: SongMastery): SongMastery {
  const qualifyingPerformances =
    raw.qualifyingPerformances ??
    raw.qualifyingSessionDates.map((date) => ({ date, atTempo: true, attemptId: 'pre-v3' }));
  return { ...initialSongMastery(raw.songId), ...raw, qualifyingPerformances };
}

export type SongEvidence =
  | { kind: 'previewed' }
  | {
      kind: 'chart-attempt';
      attempt: Attempt;
      todayISO: string;
      /** The chart the attempt was scored against; enables section/transition
       * evidence and levels 2–5. Without it only levels 0–1 move (legacy). */
      chart?: Chart;
      /** True when the song had no attempts for ≥ DELAYED_SONG_GAP_MS. */
      delayedContext?: boolean;
      /** Detected changed-context transfer, if any. */
      transfer?: TransferEvidence['kind'];
    };

const uniqueDates = (m: SongMastery) => new Set(m.qualifyingPerformances.map((q) => q.date));

/** Highest level the accumulated evidence supports (levels never regress). */
function computeLevel(m: SongMastery, chart: Chart | undefined, hasAttempt: boolean): SongMastery['level'] {
  if (!hasAttempt) return 0;
  if (!chart?.sections || chart.sections.length === 0) return 1;

  const required = chart.sections.filter((s) => s.required !== false);
  const sectionsLearned =
    required.length > 0 &&
    required.every((s) => (m.sectionProgress[s.id]?.passes ?? 0) >= 1);
  if (!sectionsLearned) return 1;

  const connected = derivedTransitions(chart).every(
    (tid) => (m.transitionProgress[tid]?.passes ?? 0) >= 1,
  );
  if (!connected) return 2;

  const atTempoDates = new Set(
    m.qualifyingPerformances.filter((q) => q.atTempo).map((q) => q.date),
  );
  if (atTempoDates.size < 2) return 3;

  const durable =
    m.qualifyingPerformances.length >= 5 &&
    uniqueDates(m).size >= 5 &&
    m.qualifyingPerformances.filter((q) => q.atTempo).length >= 3 &&
    m.weakSectionIds.length === 0 &&
    m.delayedRetrievalAt !== undefined &&
    m.transferEvidence.length >= 1;
  return durable ? 5 : 4;
}

function updatedSection(
  prev: SectionMastery | undefined,
  sectionId: string,
  passed: boolean,
  nowMs: number,
): SectionMastery {
  return {
    sectionId,
    passes: (prev?.passes ?? 0) + (passed ? 1 : 0),
    lastPassedAt: passed ? nowMs : prev?.lastPassedAt,
    weak: !passed,
  };
}

export function updateSongMastery(prev: SongMastery, evidence: SongEvidence): SongMastery {
  if (evidence.kind === 'previewed') {
    return prev; // Discovery is level 0 — creating the record is the evidence.
  }

  const { attempt, todayISO, chart } = evidence;
  const next: SongMastery = {
    ...prev,
    sectionProgress: { ...prev.sectionProgress },
    transitionProgress: { ...prev.transitionProgress },
    qualifyingPerformances: [...prev.qualifyingPerformances],
    qualifyingSessionDates: [...prev.qualifyingSessionDates],
    transferEvidence: [...prev.transferEvidence],
    lastAttemptId: attempt.id,
    lastAttemptAt: attempt.timestamp,
  };

  // ── Section drill: only that section's evidence moves ─────────────────────
  if (attempt.sectionId !== undefined) {
    const passed =
      attempt.notesCorrectPct >= SECTION_PASS && attempt.goodOrBetterPct >= SECTION_TIMING_MIN;
    next.sectionProgress[attempt.sectionId] = updatedSection(
      prev.sectionProgress[attempt.sectionId],
      attempt.sectionId,
      passed,
      attempt.timestamp,
    );
    next.weakSectionIds = recomputeWeak(next);
    next.level = maxLevel(prev.level, computeLevel(next, chart, true));
    if (next.level > prev.level) next.lastAdvancedAt = attempt.timestamp;
    return next;
  }

  // ── Full-chart attempt ─────────────────────────────────────────────────────
  let allRequiredPassedThisTake = false;
  if (chart?.sections && chart.sections.length > 0) {
    const results = sectionResults(attempt, chart);
    for (const r of results) {
      next.sectionProgress[r.sectionId] = updatedSection(
        prev.sectionProgress[r.sectionId],
        r.sectionId,
        r.passed,
        attempt.timestamp,
      );
    }
    const required = new Set(
      chart.sections.filter((s) => s.required !== false).map((s) => s.id),
    );
    allRequiredPassedThisTake = results
      .filter((r) => required.has(r.sectionId))
      .every((r) => r.passed);

    for (const t of transitionResults(attempt, chart)) {
      if (!t.passed) continue;
      const prevT = next.transitionProgress[t.transitionId];
      next.transitionProgress[t.transitionId] = {
        transitionId: t.transitionId,
        passes: (prevT?.passes ?? 0) + 1,
        lastPassedAt: attempt.timestamp,
      };
    }
  }

  const qualifying =
    attempt.assistsUsed.length === 0 &&
    attempt.stars === 3 &&
    allRequiredPassedThisTake &&
    !next.qualifyingPerformances.some((q) => q.date === todayISO);
  if (qualifying) {
    next.qualifyingPerformances.push({
      date: todayISO,
      atTempo: attempt.atTempo,
      attemptId: attempt.id,
      chartId: attempt.refId,
    });
    if (!next.qualifyingSessionDates.includes(todayISO)) {
      next.qualifyingSessionDates.push(todayISO);
    }
    next.bestAttemptId = attempt.id;
    if (evidence.delayedContext) next.delayedRetrievalAt = attempt.timestamp;
  } else if (next.bestAttemptId === undefined) {
    next.bestAttemptId = attempt.id;
  }

  if (evidence.transfer && !next.transferEvidence.some((t) => t.kind === evidence.transfer)) {
    next.transferEvidence.push({
      kind: evidence.transfer,
      at: attempt.timestamp,
      attemptId: attempt.id,
    });
  }

  next.weakSectionIds = recomputeWeak(next);
  next.level = maxLevel(prev.level, computeLevel(next, chart, true));
  if (next.level > prev.level) next.lastAdvancedAt = attempt.timestamp;
  return next;
}

function recomputeWeak(m: SongMastery): string[] {
  return Object.values(m.sectionProgress)
    .filter((s) => s.weak)
    .map((s) => s.sectionId);
}

function maxLevel(a: SongMastery['level'], b: SongMastery['level']): SongMastery['level'] {
  return (a > b ? a : b) as SongMastery['level'];
}

/** What changed between two mastery states — drives XP rows and UI chips. */
export function songMasteryDelta(
  prev: SongMastery,
  next: SongMastery,
): {
  leveledTo?: SongMastery['level'];
  newQualifyingDay: boolean;
  delayedRetrieval: boolean;
  newTransfer?: TransferEvidence['kind'];
} {
  const newTransfer = next.transferEvidence.find(
    (t) => !prev.transferEvidence.some((p) => p.kind === t.kind),
  );
  return {
    leveledTo: next.level > prev.level ? next.level : undefined,
    newQualifyingDay: next.qualifyingPerformances.length > prev.qualifyingPerformances.length,
    delayedRetrieval:
      next.delayedRetrievalAt !== undefined && prev.delayedRetrievalAt === undefined,
    newTransfer: newTransfer?.kind,
  };
}

export const SONG_MASTERY_LABELS: readonly string[] = [
  'Discovered',
  'Started',
  'Sections learned',
  'Connected',
  'Performance-ready',
  'Durable mastery',
];

/**
 * Learner-facing "what earns the next level" lines — computed strictly from
 * the same evidence `computeLevel` reads, so the UI can never promise progress
 * the reducer won't grant.
 */
export function nextEvidenceFor(m: SongMastery, chart: Chart | undefined): string[] {
  if (m.level >= 5) return ['Mastered — keep it warm with an occasional run'];
  if (m.level === 0) return ['Play it once to start the journey'];
  if (!chart?.sections || chart.sections.length === 0) return [];

  if (m.level === 1) {
    const missing = chart.sections
      .filter((s) => s.required !== false && (m.sectionProgress[s.id]?.passes ?? 0) < 1)
      .map((s) => s.label);
    return missing.length > 0
      ? [`Play these sections cleanly: ${missing.join(', ')}`]
      : ['Pass every section once'];
  }
  if (m.level === 2) {
    return ['Connect every section in one full take — slower is fine'];
  }
  if (m.level === 3) {
    const atTempoDays = new Set(
      m.qualifyingPerformances.filter((q) => q.atTempo).map((q) => q.date),
    ).size;
    const need = Math.max(0, 2 - atTempoDays);
    return [`${need} more clean, at-tempo full run${need === 1 ? '' : 's'} on separate days`];
  }

  // Level 4 → 5: enumerate exactly what durable mastery still needs.
  const lines: string[] = [];
  const perfs = m.qualifyingPerformances.length;
  const days = uniqueDates(m).size;
  const atTempo = m.qualifyingPerformances.filter((q) => q.atTempo).length;
  if (perfs < 5) lines.push(`${5 - perfs} more qualifying performance${5 - perfs === 1 ? '' : 's'}`);
  if (days < 5) lines.push(`spread across ${5 - days} more day${5 - days === 1 ? '' : 's'}`);
  if (atTempo < 3) lines.push(`${3 - atTempo} more at tempo`);
  if (m.weakSectionIds.length > 0) {
    const labels = m.weakSectionIds
      .map((id) => chart.sections?.find((s) => s.id === id)?.label ?? id)
      .join(', ');
    lines.push(`shore up: ${labels}`);
  }
  if (m.delayedRetrievalAt === undefined) lines.push('come back to it after a few days away');
  if (m.transferEvidence.length === 0) lines.push('show it transfers (new arrangement or fewer guides)');
  return lines;
}

/**
 * Honest changed-context transfer detection from data we actually have
 * (doc 06 §5.2; new-key/backing-track/memory arrive with later phases):
 *  - 'reduced-guidance': the first qualifying-quality take after real history
 *    that never produced one (the guide wheels came off).
 *  - 'arrangement': qualifying-quality on a different arrangement than every
 *    previous qualifying performance.
 */
export function detectTransfer(
  prev: SongMastery,
  attempt: Attempt,
): TransferEvidence['kind'] | undefined {
  const topQuality = attempt.assistsUsed.length === 0 && attempt.stars === 3;
  if (!topQuality || attempt.sectionId !== undefined) return undefined;

  if (
    prev.qualifyingPerformances.length > 0 &&
    prev.qualifyingPerformances.every((q) => q.chartId !== undefined && q.chartId !== attempt.refId)
  ) {
    return 'arrangement';
  }
  if (prev.lastAttemptAt !== undefined && prev.qualifyingPerformances.length === 0) {
    return 'reduced-guidance';
  }
  return undefined;
}
