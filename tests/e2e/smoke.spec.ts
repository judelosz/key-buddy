import { test, expect } from '@playwright/test';

test('loads and shows content', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Piano Pro' })).toBeVisible();
  await expect(page.getByText('Content loaded')).toBeVisible();
});

test('navigates to the player and loads a song', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('heading', { name: 'Play a song' })).toBeVisible();

  await page.getByRole('button', { name: /Ode to Joy/ }).click();
  // Player surfaces: falling-notes canvas, chord strip, keyboard.
  await expect(page.getByTestId('falling-notes')).toBeVisible();
  await expect(page.getByTestId('chord-symbols')).toBeVisible();
  await expect(page.getByTestId('piano-keyboard')).toBeVisible();
});

test('input debug logs a virtual key press', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Input debug', exact: true }).click();
  // Click the first white key (C4).
  await page.locator('[data-pitch="60"]').first().click();
  await expect(page.getByText('C4', { exact: true })).toBeVisible();
});
