import { test, expect } from '@playwright/test';
import { seamReady, skipOnboarding } from './helpers';

test('desktop shell uses both functional rails', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await skipOnboarding(page);

  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('navigation-rail')).toBeVisible();
  await expect(page.getByTestId('player-rail')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View your progress' })).toBeVisible();
});

test('intermediate width keeps the icon rail and drops the player rail', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await skipOnboarding(page);

  await expect(page.getByTestId('navigation-rail')).toBeVisible();
  await expect(page.getByTestId('player-rail')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Missions', exact: true })).toBeVisible();
});

test('mobile uses compact top navigation without either rail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await skipOnboarding(page);

  await expect(page.getByTestId('navigation-rail')).toBeHidden();
  await expect(page.getByTestId('player-rail')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
});

test('lesson and Free Play activity use focus mode, then restore the shell', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await skipOnboarding(page);

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('focus-shell')).toBeVisible();
  await expect(page.getByTestId('navigation-rail')).toBeHidden();
  await page.getByRole('button', { name: 'Missions', exact: true }).click();
  await expect(page.getByTestId('app-shell')).toBeVisible();

  await page.getByRole('button', { name: 'Free Play', exact: true }).click();
  await page.getByRole('button', { name: /Ode to Joy/ }).click();
  await expect(page.getByTestId('focus-shell')).toBeVisible();
  await expect(page.getByTestId('falling-notes')).toBeVisible();
  await page.getByRole('button', { name: 'Songs', exact: true }).click();
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('Missions limits the horizon and exposes the complete curriculum dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await seamReady(page);
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.reset();
    // @ts-expect-error dev-only seam
    await window.__pianoTest.completeOnboarding();
  });
  await page.reload();

  await expect(page.getByTestId('mission-horizon')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build a Chord' })).toHaveCount(0);

  const trigger = page.getByRole('button', { name: /View full curriculum/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Full curriculum' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Build a Chord' })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('dialog') !== null))
    .toBe(true);

  await page.getByRole('button', { name: 'Close curriculum' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
