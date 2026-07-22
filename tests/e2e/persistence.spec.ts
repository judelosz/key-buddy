import { test, expect } from '@playwright/test';

/**
 * Plays a canned mastery take through the real progression/reward/persistence
 * path (via the dev test seam), then asserts the earned state survives a reload
 * and that the skill-gated unlock fired.
 */
// The dev seam installs via async import; wait for it before driving it.
const seamReady = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => '__pianoTest' in window);

test('progress and unlocks persist across reload', async ({ page }) => {
  await page.goto('/');
  await seamReady(page);
  // Start from a clean slate, then record a mastery take on the entry song.
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.reset();
  });
  await page.reload();
  await seamReady(page);
  const reward = await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    return window.__pianoTest.recordCanned();
  });
  expect(reward.xp).toBeGreaterThan(0);
  expect(reward.newlyUnlockedSongIds).toContain('12-bar-blues-c');

  // Progress screen reflects the earned state.
  await page.getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByText('1d')).toBeVisible(); // 1-day streak
  await expect(page.getByText('12-Bar Blues in C · unlocked')).toBeVisible();

  // Reload — state is loaded from IndexedDB, not reset.
  await page.reload();
  await seamReady(page);
  await page.getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByText('12-Bar Blues in C · unlocked')).toBeVisible();

  // The unlocked song is now playable in the picker.
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('song-12-bar-blues-c')).toBeEnabled();
});
