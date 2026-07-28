# Key-Buddy — manual test checklist

*A living checklist (roadmap §8/§9): rerun the relevant sections after any change to input, scoring, progression, the curriculum engine, or the shell. Automated coverage (`npm run typecheck | test | e2e`) must be green before starting a manual pass.*

Last full pass: 2026-07-23 (Phase 5 — partial: session start → intro → real lesson → compact result → wrap verified in-browser and by `session.spec.ts`; items marked ⏳ still need a human pass, ideally with a MIDI keyboard).

## First run & onboarding

- [x] Clean install (or Settings → Danger zone → reset) lands on the landing onboarding, not the shell.
- [x] Input step: pressing an on-screen key shows "We heard you — input works!".
- [ ] ⏳ Input step: connecting a real MIDI keyboard shows the device name; MIDI notes trigger the confirmation.
- [ ] ⏳ Calibration (Settings only as of 2026-07-23 — removed from onboarding): run a real tap-along; deliberately calibrate badly, then re-run and confirm recovery. Onboarding's input step shows the Settings → Calibration tip instead.
- [ ] ⏳ Calibration survives reload (fixed 2026-07-28): calibrate, reload the tab, Settings shows the same offset and notes still grade with it applied.
- [x] Final step launches directly into the first lesson — never a blank dashboard.
- [x] Reload after onboarding goes straight to the shell.
- [x] Settings → Learning → "Replay the intro tour" works and Close returns to the shell.

## Missions & lessons

- [x] Fresh player: hero recommends Module 1 Lesson 1; the path shows done/current/locked nodes with mode chips.
- [x] Listen lesson: playback sounds, "Got it — continue" appears after it ends, result screen awards Head XP.
- [x] Note-id lesson: on-screen keys answer prompts; wrong key shows the calm "You played X" line; result awards Hands XP.
- [ ] ⏳ Rhythm-tap lesson (RETEST after 2026-07-28 fixes, round 2): tap along with the count-in (self-calibrates latency bias) and confirm graded beats feel fair on MIDI; verdict pills should read grades ("✓ synced" → Perfect/Great/Good/Early/Late), NEVER a stream of "Extra tap" — that was multi-port MIDI double-delivery, now deduped at InputService (same pitch <10 ms) and collapsed in the engine (<80 ms = one intent). Settings shows all attached MIDI port names — a two-port controller listing twice confirms the diagnosis. Only re-tune `TAP_WINDOW_SCALE` if the human pass still feels tight.
- [ ] ⏳ Theory quiz + interval-ear: audio prompts audible, explanations shown on a miss.
- [ ] ⏳ Chord-build (Tier 4): any inversion accepted; wrong tone named; "Check my chord" evaluates a partial answer.
- [ ] ⏳ Fragment/chart lessons: guided mode forces falling notes + slow tempo; independent hides the falling-notes toggle; performance pins 100% and shows the Checkpoint banner.
- [ ] ⏳ Checkpoint honesty: 3★ WITH falling notes on a performance lesson must FAIL the lesson (attempt still recorded).
- [ ] ⏳ Tier-1 boss passability (re-test after 2026-07-23 fixes): a clean, steady Ode take at 96 BPM earns the mastery star; an anticipated first note is graded Early, not missed; a consistently-late report tip points at calibration.
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

## Practice sessions (Phase 5)

- [x] Missions hero with new material: Continue is primary, "Today's practice" is the secondary pill.
- [x] Session intro card: purpose framing chip, reason line, "Let's go" / "Skip this one" / "Wrap up for today".
- [x] A real lesson runs inside the session and its result shows the compact card (+XP, "Keep going" / "Wrap up").
- [x] Wrap screen: "Nice session." with XP by track; skipping everything still wraps without guilt copy.
- [ ] ⏳ Review-day hero: once every Tier-1 skill is due (next-day play), "Start today's practice" becomes primary.
- [ ] ⏳ Session ordering feel: familiar win first, then new material; no two adjacent segments of the same skill family.
- [ ] ⏳ Fail a session lesson: step-down offer appears ("Try at N% tempo" / "Try with guides on"), the retry visibly changes (banner + slower/guided run), and after a second fail a remediation segment is injected next.
- [ ] ⏳ Song-time segment: full take records; a weak section later produces a "Zoom in" section-drill segment playing only those bars.
- [ ] ⏳ Stretch Boss Challenge in a session: curiosity framing, no fail state, no mastery movement (Progress unchanged for the stretch song).
- [ ] ⏳ Module-path failed lesson (outside sessions): "Go Back" + "Try Again" + amber step-down; checkpoint step-down is labeled "(practice run)" and can't pass the checkpoint.
- [ ] ⏳ SongMasteryCard: ladder fills as evidence accrues; weak-section chips appear after a rough take; "Next:" line matches what the reducer actually needs.
- [ ] ⏳ Wrap "Due tomorrow" count sanity-check against Progress the next day.
- [ ] ⏳ Adaptive pacing feel (MIDI): repeated ≥85% runs step tempo up ~5% with the message shown; repeated failure eases tempo before adding guides — never silently.

## Resilience

- [ ] ⏳ Pause/restart/refresh/tab-switch mid-take (Free Play and a chart lesson) — no stuck phase, no orphan audio. (2026-07-28: the hidden-tab freeze is fixed — beat ticks now also flow from a low-frequency interval, since rAF pauses entirely in background tabs; verify a tab-switched take still completes with honest grading.)
- [ ] ⏳ Offline first load: synth fallback plays; no crash from the Salamander fetch failing.
- [ ] ⏳ Reduced-motion OS setting: animations gone, nothing broken.
- [ ] ⏳ Keyboard-only navigation with visible focus rings across the shell, onboarding, and a lesson.
- [ ] ⏳ v1 IndexedDB (pre-Phase-4) upgrade: old profile keeps XP/skills/unlocks, resumes at learning tier 1.
