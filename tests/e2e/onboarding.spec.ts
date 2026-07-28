import { test, expect } from '@playwright/test';
import { seamReady } from './helpers';

test('first run lands on onboarding and Get Started walks into the shell', async ({ page }) => {
  await page.goto('/');
  await seamReady(page);
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.reset();
  });
  await page.reload();

  // Clean install → the landing onboarding, not the shell.
  await expect(
    page.getByRole('heading', { name: /Learn blues, gospel & country piano/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Missions' })).not.toBeVisible();

  // Walk the five steps (calibration lives in Settings, not onboarding).
  await page.getByRole('button', { name: /Get Started/ }).click();
  await expect(page.getByRole('heading', { name: 'How will you play?' })).toBeVisible();
  // The input check responds to a key press.
  await page.locator('[data-pitch="60"]').first().click();
  await expect(page.getByText(/We heard you/)).toBeVisible();

  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await expect(page.getByRole('heading', { name: "What you'll learn" })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await expect(
    page.getByRole('heading', { name: /How Missions, XP, and mastery work/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await page.getByRole('button', { name: /Start your first mission/ }).click();

  // Lands directly inside the first lesson — never a blank dashboard.
  await expect(page.getByRole('heading', { name: "Hear where you're going" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Missions' }).first()).toBeVisible();

  // Reload → straight to the shell; onboarding is done and persisted.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Key-Buddy' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Learn blues, gospel & country piano/ }),
  ).not.toBeVisible();
});

test('onboarding can be replayed from Settings', async ({ page }) => {
  await page.goto('/');
  await seamReady(page);
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.completeOnboarding();
  });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Replay the intro tour/ }).click();
  await expect(
    page.getByRole('heading', { name: /Learn blues, gospel & country piano/ }),
  ).toBeVisible();
  // Replay offers a Close escape hatch that returns to the shell.
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Free Play' })).toBeVisible();
});
