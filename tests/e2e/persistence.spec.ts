import { test, expect } from '@playwright/test';
import { seamReady, skipOnboarding } from './helpers';

/**
 * Plays a canned mastery take through the real progression/reward/persistence
 * path (via the dev test seam), then asserts the earned state survives a reload
 * and that the skill-gated unlock fired. (12-Bar Blues now waits for its Tier-6
 * curriculum skill — the Tier-1 mastery unlock vehicle is When the Saints.)
 */
test('progress and unlocks persist across reload', async ({ page }) => {
  await page.goto('/');
  await seamReady(page);
  // Start from a clean slate, then record a mastery take on the entry song.
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.reset();
  });
  await page.reload();
  await skipOnboarding(page);
  const reward = await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    return window.__pianoTest.recordCanned();
  });
  expect(reward.xp).toBeGreaterThan(0);
  expect(reward.newlyUnlockedSongIds).toContain('when-the-saints');

  // Progress screen reflects the earned state.
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('Advancing to Level 2')).toBeVisible();
  await expect(page.getByText('When the Saints Go Marching In · unlocked')).toBeVisible();

  // Reload — state is loaded from IndexedDB, not reset (incl. onboardedAt).
  await page.reload();
  await seamReady(page);
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('When the Saints Go Marching In · unlocked')).toBeVisible();

  // The unlocked song is now playable in the picker.
  await page.getByRole('button', { name: 'Free Play' }).click();
  await expect(page.getByTestId('song-when-the-saints')).toBeEnabled();
});
