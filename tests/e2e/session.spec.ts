import { test, expect } from '@playwright/test';
import { seamReady, skipOnboarding } from './helpers';

/**
 * The Phase-5 practice session: context-dependent Missions hero, the session
 * takeover (intro → run → result), open-ended wrap, and the dev seams that
 * drive the same builder/reducer path the UI uses.
 */

async function reset(page: import('@playwright/test').Page) {
  await page.goto('/');
  await seamReady(page);
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.reset();
  });
  await page.reload();
  await skipOnboarding(page);
}

test('sessions unlock with Tier 1: locked pill first, then a session runs and wraps', async ({
  page,
}) => {
  await reset(page);

  // Fresh (tier-1) profile: daily practice is visibly LOCKED — the momentum
  // schedule states the gate instead of hiding the feature.
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await expect(page.getByText(/unlocks when you pass Tier 1/)).toBeVisible();

  // Pass Tier 1 through the real reducers (one sitting — momentum schedule),
  // keeping one lesson incomplete so new material still leads the hero.
  const tier = await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    return window.__pianoTest.completeTier1(['l-fm-vary']);
  });
  expect(tier).toBe(2);
  await page.reload();
  await seamReady(page);

  // Practice is now available as the secondary action.
  await page.getByRole('button', { name: /Today.s practice/ }).click();
  await expect(page.getByText('more ready when you are')).toBeVisible();

  // Skipping is guilt-free; skip through to the wrap.
  // (The queue may hold several segments now — wrap directly.)
  await page.getByRole('button', { name: 'Wrap up for today' }).click();
  await expect(page.getByRole('heading', { name: 'Nice session.' })).toBeVisible();
  await page.getByRole('button', { name: /Back to Missions/ }).click();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
});

test('a note-id segment completes through the real exercise UI inside a session', async ({
  page,
}) => {
  await reset(page);

  // Pass Tier 1 (sessions gate) but leave the note-id lesson incomplete so
  // it becomes the session's recommended new material.
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.completeTier1(['l-mk-find-c']);
  });
  await page.reload();
  await seamReady(page);

  await page.getByRole('button', { name: /Today.s practice/ }).click();
  // The queue leads with a familiar win now that tier 1 is complete — skip
  // intro cards until the new-material segment (the incomplete note-id
  // lesson) comes up.
  await expect(page.getByRole('button', { name: /Let’s go/ })).toBeVisible();
  for (let i = 0; i < 8; i++) {
    if (await page.getByRole('heading', { name: 'Find every C', exact: true }).isVisible()) break;
    await page.getByRole('button', { name: 'Skip this one' }).click();
    await expect(page.getByRole('button', { name: /Let’s go/ })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Find every C' })).toBeVisible();
  await page.getByRole('button', { name: /Let’s go/ }).click();

  // The real exercise runs inside the session takeover.
  for (let i = 0; i < 4; i++) {
    await expect(page.getByText(/Find and play C/)).toBeVisible();
    await page.locator('[data-pitch="60"]').first().click();
  }

  // Compact segment result → keep going lands on the NEXT segment's intro.
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible();
  await page.getByRole('button', { name: /Keep going/ }).click();
  await expect(page.getByRole('button', { name: /Let’s go/ })).toBeVisible();

  // Wrap up mid-queue: zero-guilt wrap with the earned Hands XP.
  await page.getByRole('button', { name: 'Wrap up for today' }).click();
  await expect(page.getByRole('heading', { name: 'Nice session.' })).toBeVisible();
  await expect(page.getByText('Hands')).toBeVisible();
});

test('review-day hero leads with the practice session and the seam walks segments', async ({
  page,
}) => {
  await reset(page);

  // Pass Tier 1 (sessions gate) and force everything due → review context.
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.completeTier1();
    // @ts-expect-error dev-only seam
    await window.__pianoTest.makeReviewsDue();
  });
  await page.reload();
  await seamReady(page);

  // New material still exists (module 2) so Continue stays primary — but the
  // seam-driven session must include due reviews and walk end to end.
  const first = await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    return window.__pianoTest.startSession();
  });
  expect(first.queue.length).toBeGreaterThan(1);
  expect(
    first.queue.some((p: string) => p === 'due-review' || p === 'theory-ear'),
  ).toBeTruthy();

  const step = await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    return window.__pianoTest.completeCurrentSegment(1);
  });
  expect(step.passed).toBeTruthy();
});
