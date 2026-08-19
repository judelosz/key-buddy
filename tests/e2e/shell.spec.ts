import { test, expect } from '@playwright/test';
import { seamReady, skipOnboarding } from './helpers';

test('desktop shell uses both functional rails', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await skipOnboarding(page);

  await expect(page).toHaveTitle('Key-Buddy — Learn the Piano from Scratch');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  const navigationRail = page.getByTestId('navigation-rail');
  const playerRail = page.getByTestId('player-rail');
  await expect(navigationRail).toBeVisible();
  await expect(playerRail).toBeVisible();
  await expect(navigationRail.getByTestId('rail-midi-control')).toBeVisible();
  await expect(navigationRail.getByText('Piano input')).toBeVisible();
  await expect(playerRail.getByText('Piano input')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View your progress' })).toBeVisible();
});

test('intermediate width keeps the icon rail and drops the player rail', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await skipOnboarding(page);

  await expect(page.getByTestId('navigation-rail')).toBeVisible();
  await expect(page.getByTestId('player-rail')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Missions', exact: true })).toBeVisible();
  await expect(page.getByTestId('rail-midi-control').getByRole('button', { name: 'MIDI' })).toBeVisible();
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

test('mission stepping-stone icons stay compact, semantic, and clear of copy', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await skipOnboarding(page);

  const pathSteps = page.locator('[data-testid^="path-step-"]');
  await expect(pathSteps).toHaveCount(7);
  await expect
    .poll(() =>
      pathSteps.evaluateAll((steps) =>
        steps
          .filter((step) => {
            const button = step.querySelector('button');
            const copy = step.querySelector('[data-mission-copy]');
            if (!button || !copy) return true;
            const iconBox = button.getBoundingClientRect();
            const copyBox = copy.getBoundingClientRect();
            return !(
              iconBox.right <= copyBox.left ||
              iconBox.left >= copyBox.right ||
              iconBox.bottom <= copyBox.top ||
              iconBox.top >= copyBox.bottom
            );
          })
          .map((step) => step.getAttribute('data-testid')),
      ),
    )
    .toEqual([]);

  const glyphs = await pathSteps.locator('svg[data-glyph]').evaluateAll((nodes) =>
    nodes.map((node) => ({
      kind: node.getAttribute('data-glyph'),
      width: node.getBoundingClientRect().width,
    })),
  );
  expect(glyphs.map(({ kind }) => kind)).toEqual([
    'listen',
    'keyboard',
    'theory',
    'keyboard',
    'keyboard',
    'interval-ear',
    'challenge',
  ]);
  expect(Math.max(...glyphs.map(({ width }) => width))).toBeLessThanOrEqual(20);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverlaps = await pathSteps.evaluateAll((steps) =>
    steps
      .filter((step) => {
        const button = step.querySelector('button');
        const copy = step.querySelector('[data-mission-copy]');
        if (!button || !copy) return true;
        const iconBox = button.getBoundingClientRect();
        const copyBox = copy.getBoundingClientRect();
        return iconBox.right > copyBox.left && iconBox.left < copyBox.right;
      })
      .map((step) => step.getAttribute('data-testid')),
  );
  expect(mobileOverlaps).toEqual([]);
});
