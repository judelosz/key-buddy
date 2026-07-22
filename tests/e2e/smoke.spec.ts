import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

test('loads and shows the Missions hub with a recommended next lesson', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await expect(page.getByRole('heading', { name: 'Piano Pro' })).toBeVisible();
  // Fresh player → the first lesson of Module 1 is the dominant action.
  await expect(page.getByRole('heading', { name: "Hear where you're going" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('navigates to Free Play and loads a song', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await page.getByRole('button', { name: 'Free Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Play a song' })).toBeVisible();

  await page.getByRole('button', { name: /Ode to Joy/ }).click();
  // Player surfaces: falling-notes canvas, chord strip, keyboard.
  await expect(page.getByTestId('falling-notes')).toBeVisible();
  await expect(page.getByTestId('chord-symbols')).toBeVisible();
  await expect(page.getByTestId('piano-keyboard')).toBeVisible();
});

test('AFK tab shows the Woodshed explainer', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await page.getByRole('button', { name: 'AFK Mode', exact: true }).click();
  await expect(page.getByRole('heading', { name: /The Woodshed/ })).toBeVisible();
});

test('settings input monitor logs a virtual key press', async ({ page }) => {
  await page.goto('/');
  await skipOnboarding(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Input monitor/ }).click();
  // Click the first white key (C4) inside the expanded monitor.
  await page.locator('[data-pitch="60"]').first().click();
  // The logged event appears in the incoming-notes table.
  await expect(page.getByRole('cell', { name: 'C4', exact: true })).toBeVisible();
});
