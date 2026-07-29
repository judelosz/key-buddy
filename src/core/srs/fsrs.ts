/**
 * Spaced-repetition wrapper around ts-fsrs (build-spec §6.3, doc 01 §2.4).
 *
 * FSRS is the modern default (Anki since 23.10) — ~20–30% fewer reviews than
 * SM-2 for the same retention. Every skill/theory item is a card; grading comes
 * from Attempt results, not self-report (star/accuracy → FSRS Rating). We keep a
 * serializable `FsrsState` (epoch ms, camelCase) for IndexedDB and convert to/from
 * the library's `Card` (Date objects) at the boundary.
 */
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  type Card,
  type FSRS,
  type Grade,
} from 'ts-fsrs';
import type { FsrsState } from '@/core/types';

const engine: FSRS = fsrs(generatorParameters({ enable_fuzz: false }));

function cardToState(card: Card): FsrsState {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as FsrsState['state'],
    lastReview: card.last_review ? card.last_review.getTime() : undefined,
  };
}

function stateToCard(s: FsrsState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.lastReview !== undefined ? new Date(s.lastReview) : undefined,
  };
}

export function newCard(nowMs: number): FsrsState {
  return cardToState(createEmptyCard(new Date(nowMs)));
}

/** Map a take's star result to an FSRS grade (no self-report). */
// Re-exported so reducers can reason about rating ceilings without
// importing ts-fsrs directly.
export { Rating };

export function starsToRating(stars: 0 | 1 | 2 | 3): Grade {
  switch (stars) {
    case 0:
      return Rating.Again;
    case 1:
      return Rating.Hard;
    case 2:
      return Rating.Good;
    case 3:
      return Rating.Easy;
  }
}

/** Map an exercise score (0–1) to an FSRS grade — the scorePct analog of
 * starsToRating, for lesson results that don't produce stars. */
export function scoreToRating(scorePct: number): Grade {
  if (scorePct >= 0.95) return Rating.Easy;
  if (scorePct >= 0.8) return Rating.Good;
  if (scorePct >= 0.6) return Rating.Hard;
  return Rating.Again;
}

/** Advance a card by a grade at `nowMs`, returning the new serialized state. */
export function reviewCard(state: FsrsState, rating: Grade, nowMs: number): FsrsState {
  const { card } = engine.next(stateToCard(state), new Date(nowMs), rating);
  return cardToState(card);
}

/** Probability the item is still recalled at `nowMs` (0–1). Lower = more due. */
export function retrievability(state: FsrsState, nowMs: number): number {
  return engine.get_retrievability(stateToCard(state), new Date(nowMs), false) as number;
}

export function isDue(state: FsrsState, nowMs: number): boolean {
  return state.due <= nowMs;
}

/** Skills whose cards are due at `nowMs`, most-overdue first. */
export function dueItems<T extends { freshness: FsrsState }>(items: T[], nowMs: number): T[] {
  return items.filter((i) => isDue(i.freshness, nowMs)).sort((a, b) => a.freshness.due - b.freshness.due);
}
