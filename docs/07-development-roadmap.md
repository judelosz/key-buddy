# Piano Pro — Development Roadmap

*The living delivery plan from the current MVP through the intended curriculum, Woodshed/AFK mode, and functional piano fluency experience.*

Prepared July 2026. This document answers three questions for every phase:

1. What exists when the phase begins?
2. What will be built and how will we know it works?
3. What should be tested and adjusted before the next phase starts?

This is the delivery roadmap. The design documents remain the source of truth for product intent and guardrails:

- [01 — Curriculum and learning design](./01-curriculum-and-learning-design.md)
- [02 — Song library](./02-song-library.md)
- [03 — Gamification design](./03-gamification-design.md)
- [04 — AFK mode design](./04-afk-mode-design.md)
- [05 — Build spec](./05-build-spec.md)
- [06 — Comprehensive curriculum plan](./06-comprehensive-curriculum-plan.md)

## 1. Current state

### Product state: MVP exists, but MVP hardening is not complete

The app currently has a credible vertical slice:

- React/Vite/TypeScript application scaffold;
- strict TypeScript, Tailwind, Zustand, Dexie, Vitest, and Playwright wiring;
- source-agnostic input service with virtual keyboard and MIDI providers;
- calibration flow and input-debug surface;
- Tone.js sampled piano fallback, woodblock metronome, and Transport clock;
- pure scoring engine with pitch/timing judgment, timing histogram, stars, mastery-star logic, and live grading;
- playable song loop with count-in, falling notes, chord symbols, optional staff notation, pause/restart, and session report;
- progression, XP, Riffs, streaks, FSRS, two-lock skill progress, skill-gated song unlocking, and IndexedDB persistence;
- guardrail tests and persistence e2e coverage;
- Parlor Pastel visual system and a basic progress screen;
- a research-backed 30-tier curriculum plan and song-library direction.

The repository reports 95 passing unit tests and a passing TypeScript build check at the time of writing. The latest commits are still focused on Play-screen polish, which is appropriate for the current stage.

### Current content state: intentionally small

The content layer currently contains:

- 11 seed skills;
- 2 songs;
- 3 charts: Ode to Joy simplified, and simplified/full 12-Bar Blues in C;
- empty `fragments.json` and `minigames.json`.

This is enough to prove the MVP loop, but not enough to validate the intended curriculum. The next meaningful product risk is no longer “can a chart play?” It is “does a beginner have a coherent next thing to learn, and does the app teach it in enough different ways?”

### Product navigation decision: Path and Free Play are separate modes

The post-MVP experience should have two clearly labeled ways to play:

- **Path** — the guided curriculum roadmap. This is the default home experience and answers “what should I do next?” It funnels the user through onboarding, modules, reviews, assessments, and song unlocks.
- **Free Play** — the open practice area. This is the current song-playing experience made explicit: the user can choose any unlocked song or arrangement and practice it outside the prescribed module sequence.

Free Play should not disappear behind the curriculum, and the curriculum should not be reduced to a song picker. The two modes serve different intentions:

| Mode | User question | Progression behavior | Default experience |
|---|---|---|---|
| Path | “What should I learn next?” | Advances the guided curriculum and skill gates | Default home route |
| Free Play | “What do I want to play right now?” | Records attempts and rewards, but does not bypass skill gates | Explicit secondary route |

This separation preserves autonomy without returning the beginner to a screen full of unexplained choices.

### Current roadmap state

The older build spec labels Phases 0–3 as MVP and Phases 4–7 as future work. That is directionally correct but incomplete as a working delivery plan because:

- it does not separate technical completion from user-testing and polish;
- it puts SessionBuilder, curriculum content, adaptive difficulty, AFK, goals, and UI breadth into large phases with few intermediate checkpoints;
- it does not define a “content vertical slice” before building a generic lesson engine;
- it does not give the current MVP-hardening work a formal exit criterion;
- it does not clearly distinguish infrastructure readiness from curriculum authoring capacity;
- it does not define what “end state” means for a playable beginner journey.

This roadmap fills those gaps.

## 2. Delivery principles

### 2.1 Every phase ends in a test window

At the end of each phase, stop feature development long enough for a real test pass. The test window has four parts:

1. **Automated verification:** typecheck, unit tests, build, and relevant Playwright flows.
2. **Scripted product pass:** follow a short checklist as a first-time beginner would.
3. **Free exploration:** try odd inputs, interruptions, repeated attempts, refreshes, and unexpected navigation.
4. **Decision log:** record bugs, friction, desired changes, and “not now” decisions before starting the next phase.

The phase is complete when the app is usable, not merely when the code compiles.

### 2.2 Build one complete slice before generalizing

The first curriculum implementation should cover Tiers 1–5 end-to-end:

`module → lessons → guided exercise → chart fragment → song → assessment → progress → review`.

Only after this slice feels good should the generic lesson/content engine be expanded to all 30 tiers.

### 2.3 Keep the truth model centralized

The following must remain centrally enforced in core services:

- Hands progress comes from demonstrated playing;
- Head progress comes from Woodshed/AFK work;
- Gold requires both locks;
- song unlocks never come from Riffs or grind;
- playing tier and Player Level cannot be raised by AFK alone;
- mastery requires at-tempo, unassisted playing;
- XP is weighted by difficulty, freshness, and performance;
- timing remains part of performance quality.

### 2.4 Content quality is a product feature

More charts do not automatically create a better curriculum. Every new song or exercise should answer:

- Which skill does it teach?
- What prerequisite does it assume?
- What variation prevents screen memorization?
- What evidence proves transfer?
- Which later songs reuse the skill?

## 3. Phase map at a glance

| Phase | Name | Status | Primary outcome |
|---:|---|---|---|
| 0 | Foundation scaffold | Complete | Runnable, typed, tested project |
| 1 | Input, audio, and scoring | Complete | Fair MIDI/virtual input and timing-aware scoring |
| 2 | First playable song loop | Complete | A user can play, score, and review a chart |
| 3 | Progression and persistence | Complete | A user can earn honest progress and retain it |
| 3.5 | MVP hardening and user-test window | **Current** | Make the MVP trustworthy and pleasant before expansion |
| 4 | Curriculum/content vertical slice | Next | Tiers 1–5 implemented as real lessons and songs |
| 5 | SessionBuilder and adaptive practice | Planned | The app assembles a personalized daily path |
| 6 | Woodshed / AFK mode | Planned | Head-track learning away from the keyboard |
| 7 | Journey, goals, and long-term motivation | Planned | Clear roadmap, goals, stats, and habit support |
| 8 | Genre expansion and fluency path | Planned | Tiers 6–30 across blues, gospel, and country |
| 9 | Performance, content tools, and offline quality | Planned | Reliable authoring, playback, and local-first experience |
| 10 | Optional acoustic input and post-v1 | Deferred | Microphone mode and broader platform capabilities |

The phase numbers intentionally distinguish the current hardening period from feature development. No new major phase should begin until its previous test window is complete.

## 4. Phase 0 — Foundation scaffold

**Status: complete.**

### Delivered

- Vite + React + TypeScript strict project;
- Tailwind, Zustand, Dexie, Vitest, and Playwright setup;
- core domain types and content loader;
- initial JSON content;
- README, engineering memory, and source-of-truth documentation.

### Exit evidence

- project runs locally;
- typecheck, test, and build commands exist and pass;
- content validation rejects malformed data;
- repository has a documented architecture and conventions.

## 5. Phase 1 — Input, audio, and scoring

**Status: complete.**

### Delivered

- virtual keyboard and WEBMIDI.js providers;
- calibrated, source-agnostic note stream;
- Tone.js piano fallback and metronome/Transport clock;
- pure scoring engine with timing windows and note grades;
- input-debug and calibration surfaces.

### Exit evidence

- deterministic scoring tests cover pitch, timing, chords, misses, and tempo;
- the virtual provider can drive a complete chart without hardware;
- MIDI notes appear with calibrated timing;
- scoring does not stop playback after an error.

## 6. Phase 2 — First playable song loop

**Status: complete.**

### Delivered

- count-in → play → score → report loop;
- falling notes aligned with the keyboard;
- chord symbols and secondary staff notation;
- live grade feedback;
- pause/restart behavior;
- session report with actionable feedback;
- initial Ode to Joy and 12-Bar Blues charts.

### Exit evidence

- a first-time user can reach Play, understand the count-in, finish a take, and interpret the result;
- the same flow works with virtual input and MIDI;
- a miss, pause, restart, and completed attempt do not corrupt the session;
- e2e smoke coverage protects navigation and player rendering.

## 7. Phase 3 — Progression, rewards, and persistence

**Status: complete.**

### Delivered

- Hands/Head skill progress model;
- progression and song unlock service;
- XP/Riffs/streak rewards;
- FSRS wrapper and review state;
- pure attempt reducer;
- Dexie repository and game store;
- Progress screen;
- guardrail suite and persistence e2e.

### Exit evidence

- mastery cannot be earned from a slowed or assisted take;
- AFK/Head progress cannot raise playing tier;
- Riffs cannot buy progression;
- reload preserves progress and unlock state;
- repeated easy replays do not become an XP exploit.

## 8. Phase 3.5 — MVP hardening and user-test window

**Status: current.**

This phase is deliberately not a feature sprint. It is the “make the MVP honest, understandable, and pleasant” phase before building the curriculum engine.

### Goals

1. Remove small Play-screen friction and confusing states.
2. Verify the scoring model feels fair to an actual beginner.
3. Verify persistence, calibration, and input recovery under normal messiness.
4. Establish a repeatable manual testing checklist for all future phases.
5. Confirm that progression communicates what to do next.

### Product navigation work

- Add a default **Path** home state with one primary next action.
- Add a separate **Free Play** entry point for unlocked songs.
- Add lightweight first-run onboarding that explains the two modes, modules, skills, Riffs, song unlocking, and the role of MIDI/virtual input.
- End onboarding by launching the first Path module rather than returning the user to a dashboard.

### Suggested hardening checklist

- Test first-run flow with no MIDI device, virtual keyboard, and a connected MIDI device.
- Test a real calibration session and deliberately calibrate badly to confirm the user can recover.
- Test pause, restart, browser refresh, tab switching, and leaving the session mid-take.
- Verify audio startup behavior after browser autoplay restrictions.
- Verify sampled-piano fallback when network access is unavailable.
- Try the first song with falling notes, chord symbols, staff notation, and minimal assistance.
- Confirm the Session Report explains why a take did or did not earn the mastery star.
- Confirm the Progress screen makes the next unlock and remaining skill requirements obvious.
- Check keyboard/canvas alignment at the smallest and widest song ranges.
- Test reduced-motion behavior and keyboard-only navigation.
- Test empty, stale, and partially persisted IndexedDB state.
- Test duplicate attempts and repeated reloads for accidental double rewards.
- Test the current timing thresholds with intentionally early, late, wrong, missing, and extra notes.

### Exit criteria

- No known data-loss, stuck-session, duplicate-reward, or impossible-navigation bugs.
- All automated checks pass: `npm run typecheck`, `npm test`, `npm run build`, and `npm run e2e`.
- A user can explain what to do next without reading the design docs.
- A first-time user is funneled directly from onboarding into the first module.
- A returning user sees one recommended Path action and can intentionally choose Free Play.
- The difference between Path progress and Free Play practice is clear before the first song attempt.
- The user can explain that Riffs are a cosmetic/convenience currency, not a way to buy stars, XP, skills, or song unlocks.
- Scoring feedback is actionable enough to choose the next practice action.
- A short manual regression checklist is stored in the repository and can be rerun after future changes.

### Recommended output

Create `docs/manual-mvp-test-checklist.md` during this phase. It should be a living checklist, not a one-time report.

## 9. Phase 4 — Curriculum/content vertical slice

**Status: next.**

### Goal

Turn the written curriculum into a real beginner journey for Tiers 1–5. This is the highest-value next phase because the app currently proves mechanics but not teaching quality. This phase also establishes the first genuinely funneled user experience.

### Build

- Add `Module`, `CurriculumLesson`, `Assessment`, `TheoryConcept`, and `TierGate` content types, or equivalent validated JSON shapes.
- Implement the module anatomy: `discover → copy → recognize → vary → combine → apply → checkpoint`.
- Add a **Path** route as the default curriculum home. It should show one recommended next module/lesson, the current module’s progress, due review, and the next song unlock.
- Add a lightweight onboarding flow that ends at Module 1 rather than at a general-purpose dashboard.
- Explain the product vocabulary during onboarding and at first use: skills, modules, Path, Free Play, Riffs, song unlocks, Hands/Head locks, and mastery.
- Keep onboarding short enough to skip or replay later; it should orient rather than become a mandatory tutorial course.
- Add a separate **Free Play** route containing the current song player and unlocked songs/arrangements. Free Play may be entered from onboarding, Path, or the main navigation, but it must not be the default first destination.
- Make Free Play visibly distinct from a curriculum lesson: label it as practice, show whether a song is unlocked, and explain that attempts still count toward legitimate skill progress.
- Add exercises for note ID, rhythm/pulse, chord building, chord ear ID, and simple theory retrieval.
- Add scale exercises beginning with five-finger patterns, C/F/G pentascales, and the C major scale; every scale exercise must have a song, riff, fill, or ear-training application.
- Author the Tier 1–5 strand ladders for technique/movement, rhythm/groove, harmony/theory, ear/musicianship, and repertoire/creativity; each tier must converge in a cross-strand checkpoint.
- Include explicit time-signature content in the Tier 1–5 rhythm slice: 4/4 first, then 2/4 and 3/4, with visual identification, aural identification, counting/tapping, bar completion, and song application.
- Add or author Tier 1–5 charts: Ode to Joy, When the Saints, Amazing Grace, Oh! Susanna, and one additional simple accompaniment song.
- Add short fragments rather than requiring every lesson to be a full song.
- Implement a guided next-step path while preserving optional review.
- Add the first boss assessment and delayed review requirement.
- Keep all curriculum content data-driven and auto-validated.

### Exit criteria

- A new user can complete at least one complete module without developer-only seams.
- Every Tier 1–5 core skill has a guided exercise, a variation, a song application, and an assessment.
- The app explains why an exercise exists and which song it supports.
- A checkpoint can distinguish supported practice from independent performance.
- On a clean install, onboarding funnels directly into the first module and the first module has a clear next action after every lesson.
- The user can intentionally leave Path for Free Play and return to the same Path position without losing context.
- Content validation catches missing prerequisites, broken references, and impossible tier gates.

### Test window

- Play Tiers 1–5 as a complete beginner, without looking at implementation details.
- Repeat the same module on a second day and verify review feels useful rather than repetitive.
- Ask whether the user knows what to practice when they miss.
- Start from a clean install and record every moment where the user wonders what to click.
- Verify that the first onboarding explanation of Riffs is accurate and not mistaken for a progression currency.
- Verify that Free Play feels available and satisfying without pulling the user away from the guided path by accident.
- Try to game progression by replaying the easiest chart or doing only theory exercises.
- Check whether the curriculum teaches the user to listen, count, and move—not only follow falling notes.

## 10. Phase 5 — SessionBuilder and adaptive practice

**Status: planned.**

### Goal

Make the daily practice loop automatic, varied, and appropriately difficult.

### Build

- Create a typed `SessionSegment` model.
- Implement session composition: warm-up, new card, due review, movement lab, theory/ear, song application, independent check, and wrap.
- Enforce interleaving across skill families.
- Integrate FSRS due items and freshness into session selection.
- Add the stretch-song fragment selector with the +10-tier exploration intent and no mastery pressure.
- Implement adaptive tempo, arrangement, assist removal, and remediation.
- Add session-length options around 5, 10, 20, and 30 minutes.
- Preserve a clear recommended “next” action even when optional choices exist.

### Exit criteria

- Generated sessions fit the requested duration within a small tolerance.
- No two consecutive segments unnecessarily repeat the same skill family.
- Due review appears reliably and does not crowd out new learning.
- Adaptive difficulty responds to repeated success and failure without changing the user’s target invisibly.
- Stretch fragments are exploratory and cannot advance tier or award mastery.

### Test window

- Run short, normal, and long sessions across weak and strong synthetic player profiles.
- Miss repeatedly and confirm the system remediates rather than punishes.
- Succeed repeatedly and confirm support is removed gradually.
- Skip several days and confirm review load remains manageable.
- Confirm the daily path remains understandable despite personalization.

## 11. Phase 6 — Woodshed / AFK mode

**Status: planned.**

### Goal

Let the user make useful progress away from the keyboard without letting knowledge outrun demonstrated playing ability.

### Build

- Implement the mini-game engine and generator contract.
- Start with rhythm tap/count, note ID, major/minor/dom7 chord ear ID, build-a-chord, and interval direction.
- Add melody playback and progression recognition after the basic games are reliable.
- Couple Head-lock contributions to the existing ProgressionService.
- Enforce the playing-tier pool and +1 Scouting cap.
- Add AFK session composition and 60–90 second micro-sessions.
- Make the “ready to play” queue visible when Head progress is waiting for Hands progress.
- Keep AFK rewards separate from Player Level and playing tier.

### Exit criteria

- A user can complete a Woodshed session without a keyboard.
- AFK content is tied to introduced/current skills and never silently jumps ahead.
- Strong AFK performance opens Head progress but cannot unlock a song by itself.
- Rhythm tap uses a timing model consistent with keyboard scoring, including input-latency handling.
- Returning to the keyboard makes the Head-to-Hands handoff obvious.

### Test window

- Use AFK mode for a day, then return to the keyboard and assess whether it prepared the user.
- Try to reach advanced content using AFK only.
- Test touch/spacebar rhythm input latency and accidental double taps.
- Verify ear-game audio is clear and answer feedback is understandable.
- Check whether micro-sessions feel useful rather than like low-value quizzes.

## 12. Phase 7 — Journey, goals, stats, and motivation

**Status: planned.**

### Goal

Give the user a durable view of where they are going and why today’s practice matters.

### Build

- Add the Journey Map as the default guided path.
- Add skill-tree visualization with Hands, Head, Gold, due state, and prerequisites.
- Add session, weekly, and long-term goals with explicit acceptance.
- Add timing-improvement graph, weak-skill trends, groove/tempo history, and repertoire history.
- Add a clear “next unlock” and “why this unlock matters” panel.
- Add cosmetics and sound-pack sinks only after the core path is useful.
- Add onboarding for goals, input setup, calibration, and expectations.

### Exit criteria

- The user can answer: “What am I learning, why, what is next, and what proves I learned it?”
- Stats show musical improvement rather than only app activity.
- Goals support autonomy and do not become a second grind system.
- Cosmetics do not obscure or compete with the learning path.

### Test window

- Navigate the app after a week away and see whether the next action is still obvious.
- Create, skip, edit, and complete goals.
- Check whether streak loss or missed goals create discouragement.
- Verify the timing graph produces useful insight from synthetic and real attempts.

## 13. Phase 8 — Genre expansion and the 30-tier curriculum

**Status: planned.**

### Goal

Expand from the starter slice into the full curriculum described in `docs/06-comprehensive-curriculum-plan.md`.

### Content order

1. Tiers 6–10: 12-bar form, dominant sevenths, shuffle, first blues/country/gospel branches.
2. Tiers 11–15: inversions, blues scale, Nashville numbers, fills, turnarounds.
3. Tiers 16–22: walking bass, ii–V–I, extensions, passing chords, transposition, genre medley.
4. Tiers 23–30: boogie, reharmonization, improvisation, sight-reading, arrangement, capstone performance.

### Build expectations

- Add content in vertical slices of 2–3 tiers, not a huge batch of untested charts.
- Each slice needs songs, fragments, keyboard exercises, ear/theory exercises, assessments, and review relationships.
- Reuse shared skills across genres rather than creating duplicate “blues version” and “country version” skills unnecessarily.
- Keep public-domain or properly licensed material separate from aspirational copyrighted targets.
- Add backing tracks and improvisation only when timing and form tracking are sufficiently stable.

### Exit criteria for each content slice

- The new tier has a playable boss song and at least two supporting applications.
- Each new core skill has an ear/theory representation and a keyboard representation where appropriate.
- A user can transfer the skill to a new key, rhythm, or fragment.
- Review scheduling resurfaces the skill after a delay.
- Manual tester feedback has been incorporated before the next slice.

## 14. Phase 9 — Performance quality, authoring tools, and local-first readiness

**Status: planned.**

### Build

- Lazy-load Tone.js on first audio use.
- Lazy-load VexFlow only when staff notation is enabled.
- Decide whether piano samples should be bundled under `public/samples/` for true offline use.
- Add a content-authoring validation/report command for skills, lessons, charts, and references.
- Add chart preview and fragment preview tools for future content authoring.
- Add import/export of local progress for backup.
- Add performance profiling and bundle-size budgets.
- Add resilient recovery from IndexedDB errors and stale content versions.

### Exit criteria

- First useful interaction does not require unnecessary audio or notation bundles.
- A content author can find broken references before opening the app.
- Local progress can be backed up and restored safely.
- Offline behavior is explicit and tested rather than accidental.

## 15. Phase 10 — Deferred post-v1 capabilities

These should wait until the MIDI-first curriculum is genuinely useful:

- microphone/acoustic note detection and mic calibration;
- approximate polyphonic scoring with transparent confidence indicators;
- mobile-first Woodshed experience or PWA packaging;
- richer instrument sound packs and cosmetics;
- optional sharing or social milestones;
- broader repertoire licensing;
- cloud sync or accounts.

Mic input should not be allowed to delay the core teaching loop. The source-agnostic input interface already preserves a path for it.

## 16. Definition of done for the intended end state

The app is at the intended first end state when a complete beginner can:

1. onboard, calibrate, and understand the input options;
2. follow a clear guided path from Tier 1 through the first genre branch;
3. practice songs, riffs, theory, ear, rhythm, and movement in a coordinated daily session;
4. see exactly what is known, what is playable, and what needs review;
5. progress only when performance evidence supports it;
6. practice away from the keyboard without falsifying playing progress;
7. choose between blues, gospel, and country while seeing how skills transfer;
8. play a growing repertoire from charts, chord symbols, memory, and lead sheets;
9. transpose simple material and improvise within a form;
10. inspect meaningful timing and musicality trends;
11. recover gracefully from misses, interruptions, device loss, and missed days;
12. finish a session knowing what improved and what to do next.

## 17. Immediate recommended next steps

1. Finish Phase 3.5 and create the manual MVP regression checklist.
2. Do a real beginner playtest before adding more game systems.
3. Fix only issues that affect trust, clarity, input reliability, scoring fairness, or session completion.
4. Implement the Tier 1–5 curriculum vertical slice before building a large generic lesson framework.
5. Add the minimum content schema needed for modules and assessments, then validate it in tests.
6. Revisit the roadmap after the Tier 1–5 playtest and update phase priorities based on observed friction.

The most important product question now is not “what feature can we add next?” It is “can a new player reliably understand, attempt, improve, and return to the next useful musical action?” Phase 3.5 and Phase 4 should answer that before the app grows wider.
