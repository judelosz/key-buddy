import type { Page } from '@playwright/test';

/** The dev seam installs via async import; wait for it before driving it. */
export const seamReady = (page: Page) => page.waitForFunction(() => '__pianoTest' in window);

/**
 * Fresh Playwright contexts have an empty IndexedDB, so the first-run
 * onboarding gate is up. Complete it via the seam so shell-focused specs can
 * get straight to the tabs (onboarding.spec.ts covers the real flow).
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await seamReady(page);
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.completeOnboarding();
  });
}
