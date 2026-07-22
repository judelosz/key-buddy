import { test, expect } from '@playwright/test';
import { seamReady, skipOnboarding } from './helpers';

/**
 * The Tier-1 curriculum slice: the path recommends lessons in order, a lesson
 * can be completed for real through the UI, position persists across reload,
 * and canned reducers drive the same path the UI uses.
 */
test('note-id lesson completes through the UI and advances the path', async ({ page }) => {
  await page.goto('/');
  await seamReady(page);
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.reset();
  });
  await page.reload();
  await skipOnboarding(page);

  // Skip the listen lesson via the seam (audio autoplay is flaky headless).
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.recordCannedLesson('l-mk-listen', 1);
  });

  // The hero now recommends "Find every C" — open it.
  await expect(page.getByRole('heading', { name: 'Find every C' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Answer the 4 note-id prompts by clicking C4 on the on-screen keyboard.
  for (let i = 0; i < 4; i++) {
    await expect(page.getByText(/Find and play C/)).toBeVisible();
    await page.locator('[data-pitch="60"]').first().click();
  }

  // Passed → result screen with Hands XP, continue back to Missions.
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();

  // The path advanced to the theory lesson.
  await expect(page.getByRole('heading', { name: 'The keyboard map' })).toBeVisible();

  // Reload — the position survives (lesson progress persisted).
  await page.reload();
  await seamReady(page);
  await expect(page.getByRole('heading', { name: 'The keyboard map' })).toBeVisible();
});

test('canned module completion unlocks the next module in the path', async ({ page }) => {
  await page.goto('/');
  await seamReady(page);
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.reset();
  });
  await page.reload();
  await skipOnboarding(page);

  // Complete all of Module 1 via the real reducer.
  const lessons = [
    'l-mk-listen',
    'l-mk-find-c',
    'l-mk-theory-map',
    'l-mk-cde',
    'l-mk-whites',
    'l-mk-ear-direction',
    'l-mk-checkpoint',
  ];
  for (const id of lessons) {
    await page.evaluate(async (lessonId) => {
      // @ts-expect-error dev-only seam
      await window.__pianoTest.recordCannedLesson(lessonId, 1);
    }, id);
  }

  // The recommendation moved on to Module 2's first lesson.
  await expect(page.getByRole('heading', { name: 'Feel the pulse' })).toBeVisible();
  // Module 1 shows as done in the path.
  await expect(page.getByText('Done').first()).toBeVisible();
});
