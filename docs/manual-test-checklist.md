# Piano Pro — manual test checklist

*A living checklist (roadmap §8/§9): rerun the relevant sections after any change to input, scoring, progression, the curriculum engine, or the shell. Automated coverage (`npm run typecheck | test | e2e`) must be green before starting a manual pass.*

Last full pass: 2026-07-22 (Phase 4 — partial: first-run funnel, listen + note-id lessons, Missions path, Progress checklist verified in-browser; items marked ⏳ still need a human pass, ideally with a MIDI keyboard).

## First run & onboarding

- [x] Clean install (or Settings → Danger zone → reset) lands on the landing onboarding, not the shell.
- [x] Input step: pressing an on-screen key shows "We heard you — input works!".
- [ ] ⏳ Input step: connecting a real MIDI keyboard shows the device name; MIDI notes trigger the confirmation.
- [ ] ⏳ Calibration step: run a real tap-along; deliberately calibrate badly, then re-run from Settings and confirm recovery.
- [x] Final step launches directly into the first lesson — never a blank dashboard.
- [x] Reload after onboarding goes straight to the shell.
- [x] Settings → Learning → "Replay the intro tour" works and Close returns to the shell.

## Missions & lessons

- [x] Fresh player: hero recommends Module 1 Lesson 1; the path shows done/current/locked nodes with mode chips.
- [x] Listen lesson: playback sounds, "Got it — continue" appears after it ends, result screen awards Head XP.
- [x] Note-id lesson: on-screen keys answer prompts; wrong key shows the calm "You played X" line; result awards Hands XP.
- [ ] ⏳ Rhythm-tap lesson: count-in clicks, taps graded against the click (test with computer keys AND MIDI; watch for latency skew if uncalibrated).
- [ ] ⏳ Theory quiz + interval-ear: audio prompts audible, explanations shown on a miss.
- [ ] ⏳ Chord-build (Tier 4): any inversion accepted; wrong tone named; "Check my chord" evaluates a partial answer.
- [ ] ⏳ Fragment/chart lessons: guided mode forces falling notes + slow tempo; independent hides the falling-notes toggle; performance pins 100% and shows the Checkpoint banner.
- [ ] ⏳ Checkpoint honesty: 3★ WITH falling notes on a performance lesson must FAIL the lesson (attempt still recorded).
- [ ] ⏳ Failed lesson: result offers "Try again" and a calm next step; retry generates fresh prompts.
- [x] Closing a lesson returns to the Missions path position; reload preserves it.
- [ ] ⏳ Stretch Boss Challenge (end of Tier 5): scouting framing, no fail state, no mastery/lock movement.
- [ ] ⏳ After finishing all available lessons with the gate closed, the hero switches to "Spaced review" (next day) or "All caught up".

## Songs & charts (musical pass)

- [ ] ⏳ Listen through each new arrangement once and flag anything musically off (they are original simplifications): When the Saints, Oh! Susanna, She'll Be Comin' 'Round the Mountain (both charts), Amazing Grace.
- [ ] ⏳ Amazing Grace (3/4): metronome accents in three, falling notes align to keys, report heat-map bars are 3 beats wide, pickup beat behaves.
- [ ] ⏳ Saints pickup: count-in then an empty beat 1 — falling notes and scoring line up.
- [ ] ⏳ Mountain full arrangement: chords + bass playable hands-together at 50% tempo; live grading colors sensible.

## Free Play & progression

- [x] Free Play picker shows unlocked/locked songs with skill-gate progress (never purchasable).
- [ ] ⏳ A Free Play mastery take on a tier boss counts toward the gate (check Progress after).
- [x] Progress: advancement checklist shows real numbers; XP ring visually capped while gates remain.
- [x] Head pip lights from ear/theory lessons; Hands pips only from playing.
- [ ] ⏳ Tier gate opens only when all five items pass; level-up banner fires once; meter resets for the new tier.
- [ ] ⏳ Duplicate-reward check: record a take, reload mid-write, confirm no double XP.

## Resilience

- [ ] ⏳ Pause/restart/refresh/tab-switch mid-take (Free Play and a chart lesson) — no stuck phase, no orphan audio.
- [ ] ⏳ Offline first load: synth fallback plays; no crash from the Salamander fetch failing.
- [ ] ⏳ Reduced-motion OS setting: animations gone, nothing broken.
- [ ] ⏳ Keyboard-only navigation with visible focus rings across the shell, onboarding, and a lesson.
- [ ] ⏳ v1 IndexedDB (pre-Phase-4) upgrade: old profile keeps XP/skills/unlocks, resumes at learning tier 1.
