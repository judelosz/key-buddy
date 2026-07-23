/**
 * SessionBuilder (doc 06 §3.5/§7.1, doc 07 §10) — assembles each practice
 * session as a prioritized, interleaved, OPEN-ENDED queue. Pure: rand and
 * nowMs are injected; segments record exclusively through the two existing
 * reducers (recordLesson / recordChartAttempt) — the builder creates no new
 * mutation paths and can never bypass a tier gate.
 *
 * Doc 06 §7.1's time-budget template is reinterpreted as an ORDERING template
 * (familiar win → new material → due review → theory/ear → song time →
 * transfer → stretch); its 20–35% due-review share as a queue-composition
 * ratio. There is no duration input anywhere in this API (user decision).
 */
import type { SkillFamily, SkillProgress } from '@/core/types';
import type { SongMastery } from '@/core/curriculum/types';
import { isDue, retrievability } from '@/core/srs/fsrs';
import {
  isHandsMastered,
  trackForExerciseType,
  unlockedSongIds,
} from '@/core/progression/progressionService';
import {
  nextRecommendedLesson,
  overdueCompletedLessons,
} from '@/core/curriculum/selectors';
import { selectStretchFragment, stretchSongFor } from '@/core/curriculum/stretch';
import { initialAdaptation, policyOverrideFor } from '@/core/adaptive/adaptive';
import {
  activityRef,
  type SegmentActivity,
  type SegmentOutcome,
  type SegmentPurpose,
  type SessionInputs,
  type SessionPlan,
  type SessionRunState,
  type SessionSegment,
} from './sessionTypes';

// ─── Tunables ───────────────────────────────────────────────────────────────

export const QUEUE_TARGET = 8;
export const REFILL_THRESHOLD = 3;
export const REFILL_TO = 5;
/** Due-review share of the queue (doc 06 §7.1's 20–35%, as composition). */
export const DUE_REVIEW_MIN = 0.2;
export const DUE_REVIEW_MAX = 0.35;
/** Candidate priority = weighted sum of the four §3.5 signals. */
export const PRIORITY_WEIGHTS = {
  dueness: 0.35,
  errorSeverity: 0.3,
  prereqRelevance: 0.2,
  transferOpportunity: 0.15,
} as const;
export const FAMILIAR_WIN_MIN_SCORE = 0.85;
/** Mastered lower-tier skills with recall below this are transfer-re-entry
 * candidates (stale enough that a changed-context rep earns its keep). */
export const TRANSFER_STALE_RETRIEVABILITY = 0.9;

// ─── Review states (doc 06 §3.5) ────────────────────────────────────────────

export type ReviewState =
  | 'new'
  | 'learning'
  | 'functional'
  | 'struggling'
  | 'mastered'
  | 'maintenance';

const MAINTENANCE_STABILITY_DAYS = 30;

/**
 * Where a skill sits in the review lifecycle. `recentFailCount` is the number
 * of consecutive recent failures on results covering this skill.
 */
export function reviewStateFor(
  progress: SkillProgress | undefined,
  nowMs: number,
  recentFailCount = 0,
): ReviewState {
  if (!progress || progress.freshness.reps === 0) return 'new';
  if (recentFailCount >= 2) return 'struggling';
  const lock = Math.max(progress.handsLock, progress.headLock);
  if (lock >= 0.85) {
    return progress.freshness.stability >= MAINTENANCE_STABILITY_DAYS && !isDue(progress.freshness, nowMs)
      ? 'maintenance'
      : 'mastered';
  }
  return lock >= 0.6 ? 'functional' : 'learning';
}

// ─── Candidates ─────────────────────────────────────────────────────────────

interface Candidate {
  purpose: SegmentPurpose;
  activity: SegmentActivity;
  skillIds: string[];
  families: SkillFamily[];
  reason: string;
  priority: number;
}

/** Purposes that count toward the 20–35% due-review composition ratio. */
const REVIEW_PURPOSES: readonly SegmentPurpose[] = ['due-review', 'theory-ear'];

function familiesFor(inputs: SessionInputs, skillIds: readonly string[]): SkillFamily[] {
  const out: SkillFamily[] = [];
  for (const id of skillIds) {
    const family = inputs.content.getSkill(id)?.family;
    if (family && !out.includes(family)) out.push(family);
  }
  return out;
}

function duenessOf(inputs: SessionInputs, skillIds: readonly string[]): number {
  let max = 0;
  for (const id of skillIds) {
    const p = inputs.skillProgressById.get(id);
    if (p && isDue(p.freshness, inputs.nowMs)) {
      max = Math.max(max, 1 - retrievability(p.freshness, inputs.nowMs));
    }
  }
  return max;
}

/** Consecutive trailing failures on this lesson in recent history (newest first). */
function recentFailStreak(inputs: SessionInputs, lessonId: string): number {
  let streak = 0;
  for (const r of inputs.recentResults) {
    if (r.lessonId !== lessonId) continue;
    if (r.passed) break;
    streak += 1;
    if (streak >= 3) break;
  }
  return streak;
}

function errorSeverityFor(inputs: SessionInputs, lessonId: string): number {
  const streak = recentFailStreak(inputs, lessonId);
  return streak >= 2 ? 1 : streak === 1 ? 0.5 : 0;
}

function priorityOf(parts: {
  dueness?: number;
  errorSeverity?: number;
  prereqRelevance?: number;
  transferOpportunity?: number;
}): number {
  return (
    PRIORITY_WEIGHTS.dueness * (parts.dueness ?? 0) +
    PRIORITY_WEIGHTS.errorSeverity * (parts.errorSeverity ?? 0) +
    PRIORITY_WEIGHTS.prereqRelevance * (parts.prereqRelevance ?? 0) +
    PRIORITY_WEIGHTS.transferOpportunity * (parts.transferOpportunity ?? 0)
  );
}

/** Skills the CURRENT work leans on — new-material prerequisites + the
 * current tier's declared spiral revisits (feeds prereqRelevance). */
function relevantSkillIds(inputs: SessionInputs, newMaterialSkillIds: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const sid of newMaterialSkillIds) {
    for (const pre of inputs.content.getSkill(sid)?.prerequisites ?? []) set.add(pre);
  }
  for (const module of inputs.content.modulesForTier(inputs.player.learningTier)) {
    for (const sid of module.revisits) set.add(sid);
  }
  return set;
}

interface CandidatePools {
  familiarWin: Candidate | null;
  newMaterial: Candidate | null;
  /** Due-pool candidates (hands due-review + head theory-ear), priority desc. */
  due: Candidate[];
  song: Candidate[];
  transfer: Candidate[];
  stretch: Candidate | null;
}

function collectCandidates(
  inputs: SessionInputs,
  excludeRefs: ReadonlySet<string>,
  opts: { allowStretch: boolean },
): CandidatePools {
  const { content, player, skillProgressById, lessonProgressById } = inputs;
  const excluded = (a: SegmentActivity) => excludeRefs.has(activityRef(a));

  // New material — the path's single recommended next lesson.
  let newMaterial: Candidate | null = null;
  const rec = nextRecommendedLesson(content, lessonProgressById, player.learningTier);
  if (rec) {
    const activity: SegmentActivity = {
      kind: 'lesson',
      lessonId: rec.lesson.id,
      moduleId: rec.module.id,
    };
    if (!excluded(activity)) {
      const checkpoint = rec.module.bossLessonId === rec.lesson.id;
      newMaterial = {
        purpose: checkpoint ? 'independent-check' : 'new-material',
        activity,
        skillIds: rec.lesson.skillIds,
        families: familiesFor(inputs, rec.lesson.skillIds),
        reason: checkpoint ? 'Show it sticks — no guides, your pace' : 'Something new',
        priority: 1, // the path always leads
      };
    }
  }
  const relevant = relevantSkillIds(inputs, newMaterial?.skillIds ?? []);

  // Due reviews — the shared overdue pool, split hands/head by exercise track.
  const due: Candidate[] = [];
  for (const o of overdueCompletedLessons(
    content,
    lessonProgressById,
    player.learningTier,
    skillProgressById,
    inputs.nowMs,
  )) {
    const activity: SegmentActivity = {
      kind: 'lesson',
      lessonId: o.lesson.id,
      moduleId: o.module.id,
    };
    if (excluded(activity)) continue;
    const head = trackForExerciseType(o.lesson.exerciseType) === 'head';
    const transferOpportunity = o.dueSkillIds.some((sid) => {
      const skill = content.getSkill(sid);
      const p = skillProgressById.get(sid);
      return skill !== undefined && skill.tier < player.learningTier && p !== undefined && isHandsMastered(p);
    })
      ? 1
      : 0;
    due.push({
      purpose: head ? 'theory-ear' : 'due-review',
      activity,
      skillIds: o.lesson.skillIds,
      families: familiesFor(inputs, o.lesson.skillIds),
      reason: head ? 'Keep your ear and theory sharp' : 'Bring back a skill before it fades',
      priority: priorityOf({
        dueness: duenessOf(inputs, o.dueSkillIds),
        errorSeverity: errorSeverityFor(inputs, o.lesson.id),
        prereqRelevance: o.lesson.skillIds.some((s) => relevant.has(s)) ? 1 : 0,
        transferOpportunity,
      }),
    });
  }
  due.sort((a, b) => b.priority - a.priority);

  // Familiar win — a completed HANDS lesson the player is already good at.
  // Best score wins; among equals, the one untouched longest.
  let familiarWin: Candidate | null = null;
  let familiarBest: { score: number; lastDate: string } | null = null;
  for (const module of content.modules) {
    if (module.tier > player.learningTier) continue;
    for (const id of module.lessonIds) {
      const lesson = content.getLesson(id);
      const progress = lessonProgressById.get(id);
      if (!lesson || !progress || progress.completedAt === undefined) continue;
      if (lesson.mode === 'scouting' || lesson.exerciseType === 'listen') continue;
      if (trackForExerciseType(lesson.exerciseType) !== 'hands') continue;
      if (progress.bestScorePct < FAMILIAR_WIN_MIN_SCORE) continue;
      const activity: SegmentActivity = { kind: 'lesson', lessonId: id, moduleId: module.id };
      if (excluded(activity)) continue;
      const lastDate = progress.lastAttemptDate ?? '0000-00-00';
      const better =
        familiarBest === null ||
        progress.bestScorePct > familiarBest.score ||
        (progress.bestScorePct === familiarBest.score && lastDate < familiarBest.lastDate);
      if (better) {
        familiarBest = { score: progress.bestScorePct, lastDate };
        familiarWin = {
          purpose: 'familiar-win',
          activity,
          skillIds: lesson.skillIds,
          families: familiesFor(inputs, lesson.skillIds),
          reason: 'A familiar win to warm up',
          priority: progress.bestScorePct,
        };
      }
    }
  }

  // Song time — unlocked songs with started mastery: weak-section drills
  // first, otherwise a full take toward the next evidence level.
  const song: Candidate[] = [];
  const unlocked = unlockedSongIds(content.songs, skillProgressById);
  for (const s of content.songs) {
    if (!unlocked.has(s.id) || s.chartIds.length === 0) continue;
    const mastery = inputs.songMasteryById.get(s.id);
    if (!mastery || mastery.level < 1 || mastery.level >= 5) continue;
    const chart = content.getChart(s.chartIds[0]);
    if (!chart) continue;
    const staleDays = mastery.lastAttemptAt
      ? (inputs.nowMs - mastery.lastAttemptAt) / 86_400_000
      : 7;
    const skillIds = s.taughtSkills;
    const weakId = mastery.weakSectionIds.find((id) =>
      chart.sections?.some((sec) => sec.id === id),
    );
    if (weakId !== undefined) {
      const section = chart.sections?.find((sec) => sec.id === weakId);
      const drill: SegmentActivity = {
        kind: 'section-drill',
        songId: s.id,
        chartId: chart.id,
        sectionId: weakId,
      };
      if (!excluded(drill)) {
        song.push({
          purpose: 'section-drill',
          activity: drill,
          skillIds,
          families: familiesFor(inputs, skillIds),
          reason: `Shore up "${section?.label ?? weakId}" in ${s.title}`,
          priority: priorityOf({ errorSeverity: 0.8, dueness: Math.min(1, staleDays / 7) }),
        });
      }
    }
    const full: SegmentActivity = { kind: 'full-chart', songId: s.id, chartId: chart.id };
    if (!excluded(full)) {
      song.push({
        purpose: 'song-application',
        activity: full,
        skillIds,
        families: familiesFor(inputs, skillIds),
        reason: songReason(mastery, s.title),
        priority: priorityOf({ dueness: Math.min(1, staleDays / 7), transferOpportunity: 0.5 }),
      });
    }
  }
  song.sort((a, b) => b.priority - a.priority);

  // Transfer re-entry — a mastered lower-tier skill, stale, in a NEW context.
  const transfer: Candidate[] = [];
  if (player.learningTier >= 2) {
    for (const skill of content.skills) {
      if (skill.tier >= player.learningTier) continue;
      const p = skillProgressById.get(skill.id);
      if (!p || !isHandsMastered(p)) continue;
      const r = retrievability(p.freshness, inputs.nowMs);
      if (r >= TRANSFER_STALE_RETRIEVABILITY && !isDue(p.freshness, inputs.nowMs)) continue;
      const lastType = inputs.recentResults.find((res) => {
        const l = content.getLesson(res.lessonId);
        return l?.skillIds.includes(skill.id) ?? false;
      })?.exerciseType;
      const lessons = content
        .lessonsTeachingSkill(skill.id)
        .filter(
          (l) =>
            l.mode !== 'scouting' &&
            l.exerciseType !== 'listen' &&
            lessonProgressById.get(l.id)?.completedAt !== undefined &&
            !excludeRefs.has(`lesson:${l.id}`),
        );
      // Changed context beats a straight repeat (doc 06 §3.5 transfer).
      const pick = lessons.find((l) => lastType !== undefined && l.exerciseType !== lastType) ?? lessons[0];
      if (!pick) continue;
      transfer.push({
        purpose: 'transfer-reentry',
        activity: { kind: 'lesson', lessonId: pick.id, moduleId: pick.moduleId },
        skillIds: pick.skillIds,
        families: familiesFor(inputs, pick.skillIds),
        reason: `Bring back ${skill.name} in a new context`,
        priority: priorityOf({ transferOpportunity: 1, dueness: 1 - r }),
      });
    }
    transfer.sort((a, b) => b.priority - a.priority);
  }

  // Stretch boss — ≤1 per session, exploration-only.
  let stretch: Candidate | null = null;
  if (opts.allowStretch) {
    const stretchSong = stretchSongFor(player, content.songs, (id) => unlocked.has(id));
    if (stretchSong) {
      const working = new Set<string>();
      for (const [id, p] of skillProgressById) {
        if (p.handsLock > 0 || p.headLock > 0) working.add(id);
      }
      const recentStretch = new Set(
        inputs.recentAttempts.filter((a) => a.refKind === 'fragment').map((a) => a.refId),
      );
      const fragments = stretchSong.fragmentIds
        .map((id) => content.getFragment(id))
        .filter((f): f is NonNullable<typeof f> => f !== undefined);
      const frag = selectStretchFragment(stretchSong, fragments, working, recentStretch, inputs.rand);
      if (frag) {
        const activity: SegmentActivity = {
          kind: 'fragment',
          songId: stretchSong.id,
          fragmentId: frag.id,
        };
        if (!excluded(activity)) {
          stretch = {
            purpose: 'stretch-boss',
            activity,
            skillIds: frag.skillTags,
            families: familiesFor(inputs, frag.skillTags),
            reason: `Boss Challenge — a taste of "${stretchSong.title}"`,
            priority: 0.1,
          };
        }
      }
    }
  }

  return { familiarWin, newMaterial, due, song, transfer, stretch };
}

function songReason(m: SongMastery, title: string): string {
  switch (m.level) {
    case 1:
      return `Song time — get every section of ${title} clean`;
    case 2:
      return `Song time — connect ${title}'s sections in one take`;
    case 3:
      return `Song time — a full run of ${title} at tempo`;
    default:
      return `Song time — keep ${title} performance-ready`;
  }
}

// ─── Assembly: ordering template + ratio + interleaving ─────────────────────

function assembleQueue(pools: CandidatePools, target: number): Candidate[] {
  const queue: Candidate[] = [];
  const used = new Set<string>();
  const take = (c: Candidate | null | undefined): boolean => {
    if (!c) return false;
    const ref = activityRef(c.activity);
    if (used.has(ref)) return false;
    used.add(ref);
    queue.push(c);
    return true;
  };
  const nextFrom = (pool: Candidate[], filter?: (c: Candidate) => boolean): Candidate | undefined =>
    pool.find((c) => !used.has(activityRef(c.activity)) && (filter?.(c) ?? true));

  // The §7.1 ordering template (empty slots simply skip).
  take(pools.familiarWin);
  take(pools.newMaterial);
  take(nextFrom(pools.due, (c) => c.purpose === 'due-review'));
  take(nextFrom(pools.due, (c) => c.purpose === 'theory-ear'));
  take(nextFrom(pools.song, (c) => c.purpose === 'section-drill') ?? nextFrom(pools.song));
  take(nextFrom(pools.due));
  take(nextFrom(pools.transfer));
  take(pools.stretch);

  // Fill remaining capacity by priority, respecting the due-review ceiling.
  const leftovers = [...pools.due, ...pools.song, ...pools.transfer].sort(
    (a, b) => b.priority - a.priority,
  );
  for (const c of leftovers) {
    if (queue.length >= target) break;
    const isReview = REVIEW_PURPOSES.includes(c.purpose);
    if (isReview && (reviewCount(queue) + 1) / (queue.length + 1) > DUE_REVIEW_MAX) continue;
    take(c);
  }

  // Floor: if the review share is short and due work remains, append it.
  while (
    queue.length > 0 &&
    reviewCount(queue) / queue.length < DUE_REVIEW_MIN &&
    take(nextFrom(pools.due))
  ) {
    /* keep appending until the floor holds or the pool runs dry */
  }

  // Ceiling: swap surplus reviews for the best non-review leftovers, if any.
  while (queue.length > 0 && reviewCount(queue) / queue.length > DUE_REVIEW_MAX) {
    const replacement = nextFrom(
      [...pools.song, ...pools.transfer].sort((a, b) => b.priority - a.priority),
    );
    if (!replacement) break; // nothing to swap in — an all-review day is honest
    const idx = lowestPriorityReviewIndex(queue);
    if (idx < 0) break;
    used.add(activityRef(replacement.activity));
    queue.splice(idx, 1, replacement);
  }

  return interleaveRepair(queue);
}

function reviewCount(queue: readonly Candidate[]): number {
  return queue.filter((c) => REVIEW_PURPOSES.includes(c.purpose)).length;
}

function lowestPriorityReviewIndex(queue: readonly Candidate[]): number {
  let idx = -1;
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (!REVIEW_PURPOSES.includes(c.purpose)) continue;
    if (idx < 0 || c.priority < queue[idx].priority) idx = i;
  }
  return idx;
}

const primaryFamily = (c: Candidate): SkillFamily | undefined => c.families[0];

/**
 * Greedy interleaving repair: no two adjacent segments share a primary skill
 * family when a swap with a later segment can fix it (doc 06 §3.5
 * interleaving). Index 0 (the warm-up) never moves.
 */
export function interleaveRepair<T extends Pick<Candidate, 'families'>>(queue: T[]): T[] {
  const out = [...queue];
  const fam = (c: T | undefined) => c?.families[0];
  for (let pass = 0; pass < out.length; pass++) {
    let swapped = false;
    for (let i = 1; i < out.length; i++) {
      const prev = fam(out[i - 1]);
      if (prev === undefined || fam(out[i]) !== prev) continue;
      for (let j = i + 1; j < out.length; j++) {
        if (fam(out[j]) === prev) continue;
        // The swap must not create a new clash where j sat. When j is right
        // after i, the moved item's new predecessor is the swapped-in one.
        const jPrev = j - 1 === i ? fam(out[j]) : fam(out[j - 1]);
        const jNext = j + 1 < out.length ? fam(out[j + 1]) : undefined;
        const moved = fam(out[i]);
        if (moved !== undefined && (moved === jPrev || moved === jNext)) continue;
        [out[i], out[j]] = [out[j], out[i]];
        swapped = true;
        break;
      }
    }
    if (!swapped) break;
  }
  return out;
}

// ─── Segments + adaptation attachment ───────────────────────────────────────

function toSegment(
  inputs: SessionInputs,
  plan: Pick<SessionPlan, 'sessionId'>,
  seq: number,
  c: Candidate,
): SessionSegment {
  const segment: SessionSegment = {
    id: `${plan.sessionId}-${seq}`,
    purpose: c.purpose,
    activity: c.activity,
    skillIds: c.skillIds,
    families: c.families,
    reason: c.reason,
  };
  // Resume prior adaptive settings — explicitly, never silently.
  if (c.activity.kind === 'lesson') {
    const lesson = inputs.content.getLesson(c.activity.lessonId);
    const state = inputs.adaptationByRef.get(c.activity.lessonId);
    if (lesson && state) {
      const override = policyOverrideFor(lesson, state);
      const baseline = initialAdaptation(state.refId, lesson, inputs.nowMs);
      if (
        override &&
        (state.tempoPct !== baseline.tempoPct || state.assistLevel !== baseline.assistLevel)
      ) {
        segment.adaptation = {
          tempoPct: override.tempoPct,
          assists: override.fallingNotes,
          message: `Starting at ${Math.round(override.tempoPct * 100)}% tempo — picking up where you left off.`,
        };
      }
    }
  }
  return segment;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function buildSession(inputs: SessionInputs): SessionPlan {
  const sessionId = `s${inputs.nowMs.toString(36)}${Math.floor(inputs.rand() * 46_656).toString(36)}`;
  const pools = collectCandidates(inputs, new Set(), { allowStretch: true });
  const candidates = assembleQueue(pools, QUEUE_TARGET);
  const plan: SessionPlan = { sessionId, startedAt: inputs.nowMs, queue: [], nextSeq: 0 };
  plan.queue = candidates.map((c) => toSegment(inputs, plan, plan.nextSeq++, c));
  return plan;
}

export interface AdvanceResult {
  plan: SessionPlan;
  state: SessionRunState;
  /** The remediation segment injected at the head of the queue, if any. */
  injected?: SessionSegment;
}

/**
 * Record a segment outcome: updates fail-run tracking, bars an item after two
 * consecutive fails, and injects exactly ONE remediation segment (a smaller
 * prerequisite, never an identical retry) after a meaningful failure.
 */
export function advanceSession(
  plan: SessionPlan,
  state: SessionRunState,
  outcome: SegmentOutcome,
  inputs: SessionInputs,
): AdvanceResult {
  const segment = plan.queue.find((s) => s.id === outcome.segmentId);
  if (!segment) return { plan, state };

  const ref = activityRef(segment.activity);
  const failedMeaningfully =
    !outcome.passed && outcome.skippedByUser !== true && segment.purpose !== 'stretch-boss';

  const failRunCount = failedMeaningfully ? (state.failRunRef === ref ? state.failRunCount + 1 : 1) : 0;
  const barredRefs =
    failRunCount >= 2 && !state.barredRefs.includes(ref)
      ? [...state.barredRefs, ref]
      : state.barredRefs;

  let queue = plan.queue.filter(
    (s) => s.id !== outcome.segmentId && !barredRefs.includes(activityRef(s.activity)),
  );

  let injected: SessionSegment | undefined;
  let nextSeq = plan.nextSeq;
  if (failedMeaningfully) {
    const candidate = remediationFor(segment, plan, state, inputs, barredRefs);
    if (candidate) {
      injected = toSegment(inputs, plan, nextSeq++, candidate);
      queue = [injected, ...queue];
    }
  }

  return {
    plan: { ...plan, queue, nextSeq },
    state: {
      completed: [...state.completed, { segment, outcome }],
      failRunRef: failedMeaningfully ? ref : undefined,
      failRunCount,
      barredRefs,
    },
    injected,
  };
}

/** A smaller prerequisite for a failed segment (doc 06 §3.4). */
function remediationFor(
  failed: SessionSegment,
  plan: SessionPlan,
  state: SessionRunState,
  inputs: SessionInputs,
  barredRefs: readonly string[],
): Candidate | null {
  const { content } = inputs;
  const taken = new Set<string>([
    ...plan.queue.map((s) => activityRef(s.activity)),
    ...state.completed.map((c) => activityRef(c.segment.activity)),
    ...barredRefs,
  ]);
  const failedRef = activityRef(failed.activity);

  const asCandidate = (activity: SegmentActivity, skillIds: string[], reason: string): Candidate | null => {
    const ref = activityRef(activity);
    if (ref === failedRef || taken.has(ref)) return null;
    return {
      purpose: 'remediation',
      activity,
      skillIds,
      families: familiesFor(inputs, skillIds),
      reason,
      priority: 1,
    };
  };

  if (failed.activity.kind === 'lesson') {
    const lessonId = failed.activity.lessonId;
    // Authored remediation first (the assessment's own prescription)…
    for (const a of content.assessments) {
      if (a.lessonId !== lessonId) continue;
      for (const rid of a.remediationLessonIds) {
        const lesson = content.getLesson(rid);
        if (!lesson) continue;
        const c = asCandidate(
          { kind: 'lesson', lessonId: rid, moduleId: lesson.moduleId },
          lesson.skillIds,
          'A smaller step first — this one feeds what just fell apart',
        );
        if (c) return c;
      }
    }
    // …else the nearest earlier lesson in the module that shares a skill.
    const failedLesson = content.getLesson(lessonId);
    if (failedLesson) {
      const earlier = content
        .lessonsForModule(failedLesson.moduleId)
        .filter(
          (l) =>
            l.order < failedLesson.order &&
            l.exerciseType !== 'listen' &&
            l.skillIds.some((s) => failedLesson.skillIds.includes(s)),
        )
        .sort((a, b) => b.order - a.order);
      for (const l of earlier) {
        const c = asCandidate(
          { kind: 'lesson', lessonId: l.id, moduleId: l.moduleId },
          l.skillIds,
          'A smaller step first — rebuild the piece this leans on',
        );
        if (c) return c;
      }
    }
    return null;
  }

  // Chart work: drill the weakest section instead of re-running the whole take.
  if (failed.activity.kind === 'full-chart' || failed.activity.kind === 'section-drill') {
    const { songId, chartId } = failed.activity;
    const chart = content.getChart(chartId);
    const failedSection = failed.activity.kind === 'section-drill' ? failed.activity.sectionId : null;
    const weak = inputs.songMasteryById
      .get(songId)
      ?.weakSectionIds.find(
        (id) => id !== failedSection && chart?.sections?.some((s) => s.id === id),
      );
    if (chart && weak !== undefined) {
      return asCandidate(
        { kind: 'section-drill', songId, chartId, sectionId: weak },
        failed.skillIds,
        'Zoom in — fix the weakest bars before the full take',
      );
    }
  }
  return null;
}

/**
 * The open-endedness mechanism: when fewer than REFILL_THRESHOLD segments
 * remain, rebuild candidates against CURRENT inputs and top the queue back up
 * to ~REFILL_TO. Stretch appears at most once per session.
 */
export function extendSession(
  plan: SessionPlan,
  state: SessionRunState,
  inputs: SessionInputs,
): SessionPlan {
  if (plan.queue.length >= REFILL_THRESHOLD) return plan;

  const exclude = new Set<string>([
    ...plan.queue.map((s) => activityRef(s.activity)),
    ...state.completed.map((c) => activityRef(c.segment.activity)),
    ...state.barredRefs,
  ]);
  const stretchSeen =
    plan.queue.some((s) => s.purpose === 'stretch-boss') ||
    state.completed.some((c) => c.segment.purpose === 'stretch-boss');

  const pools = collectCandidates(inputs, exclude, { allowStretch: !stretchSeen });
  const additions = assembleQueue(pools, Math.max(0, REFILL_TO - plan.queue.length));
  if (additions.length === 0) return plan;

  let nextSeq = plan.nextSeq;
  const appended = additions.map((c) => toSegment(inputs, plan, nextSeq++, c));
  return { ...plan, queue: interleaveRepair([...plan.queue, ...appended]), nextSeq };
}
