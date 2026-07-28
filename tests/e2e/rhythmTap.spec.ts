import { test, expect } from '@playwright/test';
import { seamReady, skipOnboarding } from './helpers';

/**
 * The Tap Along mission, end to end through the REAL audio/engine stack: the
 * player's own tap launches the count-in, count-in taps self-calibrate the
 * take's timing bias (doc-08 §3.9 — the fix for the unpassable mission), the
 * live verdict pill renders, and a steady tapper passes.
 *
 * The tapper runs at a fixed cadence that matches the lesson BPM but at an
 * arbitrary phase vs the metronome grid — exactly an "uncalibrated device"
 * profile. Without the count-in fold this fails; with it, it passes.
 */
test('a steady but phase-offset tapper passes the tap mission', async ({ page }) => {
  test.slow(); // the take runs in real time (~14 s of metronome)

  await page.goto('/');
  await seamReady(page);
  await page.evaluate(async () => {
    // @ts-expect-error dev-only seam
    await window.__pianoTest.reset();
  });
  await page.reload();
  await skipOnboarding(page);

  // Walk the path to the tap mission via the seam (module 1 + the listen
  // lesson before it).
  await page.evaluate(async () => {
    const ids = [
      'l-mk-listen',
      'l-mk-find-c',
      'l-mk-theory-map',
      'l-mk-cde',
      'l-mk-whites',
      'l-mk-ear-direction',
      'l-mk-checkpoint',
      'l-sb-listen',
    ];
    // @ts-expect-error dev-only seam
    for (const id of ids) await window.__pianoTest.recordCannedLesson(id, 1);
  });
  await page.reload();
  await seamReady(page);

  await expect(page.getByRole('heading', { name: 'Tap with the click' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(/your first tap starts the count-in/)).toBeVisible();

  // Steady tapper: 750 ms cadence = 80 BPM (the lesson tempo), phase-blind.
  // First tap launches the count-in; the next few land during the count-in
  // (free + self-calibrating); the rest cover the 8 graded beats. Every tap
  // is deliberately DOUBLED (press-release-press within a few ms) to model a
  // multi-port MIDI controller — the dedup/collapse stack must absorb it.
  await page.evaluate(() => {
    const press = () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
    };
    let n = 0;
    const iv = setInterval(() => {
      press();
      setTimeout(press, 4); // the second port's copy of the same press
      if (++n > 17) clearInterval(iv);
    }, 750);
  });

  // Live feedback: the pulse card appears, and per-tap verdict pills flash
  // ("✓ synced" during the count-in, grades once taps count).
  await expect(page.getByText(/Tap along with the count-in/)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/✓ synced|Perfect!|Great|Good|Early|Late/).first()).toBeVisible({
    timeout: 10_000,
  });

  // The take commits after ~(4 count-in + 7 + 1.5 grace) beats — then the
  // result screen shows a PASS (Hands XP + Continue).
  await expect(page.getByTestId('lesson-result')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();
});
