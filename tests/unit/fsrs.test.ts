import { describe, it, expect } from 'vitest';
import { newCard, reviewCard, retrievability, isDue, dueItems, starsToRating } from '@/core/srs/fsrs';
import { Rating } from 'ts-fsrs';

const DAY = 86_400_000;

describe('FSRS wrapper', () => {
  it('creates a New card that is due immediately', () => {
    const c = newCard(0);
    expect(c.state).toBe(0);
    expect(isDue(c, 0)).toBe(true);
  });

  it('schedules the next review into the future after a Good grade', () => {
    const c = reviewCard(newCard(0), Rating.Good, 0);
    expect(c.due).toBeGreaterThan(0);
    expect(c.reps).toBe(1);
  });

  it('recall probability decays as time passes', () => {
    const c = reviewCard(newCard(0), Rating.Easy, 0);
    const soon = retrievability(c, DAY);
    const later = retrievability(c, 30 * DAY);
    expect(later).toBeLessThan(soon);
  });

  it('surfaces due items most-overdue first', () => {
    const now = 100 * DAY;
    const items = [
      { id: 'fresh', freshness: reviewCard(newCard(now), Rating.Easy, now) },
      { id: 'stale', freshness: reviewCard(newCard(0), Rating.Hard, 0) },
    ];
    const due = dueItems(items, now);
    expect(due[0].id).toBe('stale'); // overdue since day 0
    expect(due.map((d) => d.id)).not.toContain('fresh'); // not yet due
  });

  it('round-trips serialized state across a review', () => {
    const c1 = reviewCard(newCard(0), Rating.Good, 0);
    const c2 = reviewCard(c1, Rating.Good, c1.due);
    expect(c2.reps).toBe(2);
    expect(Number.isFinite(c2.stability)).toBe(true);
  });

  it('maps stars to grades', () => {
    expect(starsToRating(2)).toBe(Rating.Good);
  });
});
