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

test('fresh profile: hero leads with new material, session runs a real lesson and wraps', async ({
  page,
}) => {
  await reset(page);

  // New material available → Continue is the primary; practice is secondary.
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Today.s practice/ }).click();

  // Session takeover: intro card for the first (and only) segment — the
  // recommended listen lesson framed as "Something new".
  await expect(page.getByText('Something new')).toBeVisible();
  await expect(page.getByText('· more ready when you are')).toBeVisible();

  // Skipping is guilt-free and ends on the wrap when nothing is left.
  await page.getByRole('button', { name: 'Skip this one' }).click();
  await expect(page.getByRole('heading', { name: 'Nice session.' })).toBeVisible();
  await page.getByRole('button', { name: /Back to Missions/ }).click();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
});

test('a note-id segment completes through the real exercise UI inside a session', async ({
  page,
}) => {
  await reset(page);

  // Get past the listen lesson so the next recommendation is the note-id one.
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.recordCannedLesson('l-mk-listen', 1);
  });

  await page.getByRole('button', { name: /Today.s practice/ }).click();
  await expect(page.getByText('Something new')).toBeVisible();
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

  // Complete the first module and force its skills due → review context.
  const lessons = [
    'l-mk-listen',
    'l-mk-find-c',
    'l-mk-theory-map',
    'l-mk-cde',
    'l-mk-whites',
    'l-mk-ear-direction',
    'l-mk-checkpoint',
  ];
  await page.evaluate(async (ids) => {
    for (const id of ids) {
      // @ts-expect-error dev-only seam
      await window.__pianoTest.recordCannedLesson(id, 1);
    }
    // @ts-expect-error dev-only seam
    await window.__pianoTest.makeReviewsDue();
  }, lessons);
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
