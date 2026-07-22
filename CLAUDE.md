# CLAUDE.md — Piano Pro engineering memory

This is the **living engineering memory** for the project (build-spec §0.1). It is a map + decision log, not a duplicate of the design docs. Keep it current: at the end of any task that adds a module, changes the data model, alters a scoring/reward/algorithm parameter, or resolves an open question, update the relevant section **in the same commit**. Treat an out-of-date `CLAUDE.md` as a bug.

---

## 1. Project overview

A single-user, local-first, gamified web app that teaches a complete beginner **blues, gospel, and country** piano through an interleaved, research-backed daily loop. **v1 input is a MIDI keyboard** (WEBMIDI.js) plus an on-screen **virtual keyboard**; microphone/acoustic listening is deferred (build-spec §12).

Design source-of-truth (in `docs/`). **Note the on-disk numbering — build-spec §0/§5 cite the companion docs with swapped numbers; trust the files:**

- `docs/01-curriculum-and-learning-design.md` — pedagogy, skill taxonomy, daily loop.
- `docs/02-song-library.md` — tiered, skill-tagged repertoire + song schema (build-spec calls this "03").
- `docs/03-gamification-design.md` — scoring, XP/currency, streaks, flow, roadmap, goals, guardrails (build-spec calls this "02").
- `docs/04-afk-mode-design.md` — Woodshed/AFK two-lock model.
- `docs/05-build-spec.md` — the engineering plan (source of truth for *how*).

Scope in progress: **MVP = Phases 0–3.** Phases 4–6 (SessionBuilder, adaptive difficulty, AFK, roadmap/goals/cosmetics/onboarding) and mic input are deferred.

---

## 2. Architecture map

```
UI (React + Zustand)          src/ui/
  ↕ hooks/selectors
Core services (pure TS)       src/core/
  ContentService              content/       loads+validates skills/songs/charts JSON, queries
  types                       types.ts       the domain model (single source of truth)
  ScoringEngine               scoring/       (Chart, NotePlayed[], tempo, tier) → Attempt   [Phase 1]
  ProgressionService ★        progression/   two-lock mastery, tier, skill-gated unlocks     [Phase 3]
  RewardService ★             rewards/       XP, Riffs, streaks, variable rewards            [Phase 3]
  SpacedRepetition            srs/           ts-fsrs wrapper, due queue                       [Phase 3]
AudioService                  src/audio/     Tone.js sampler + metronome/Transport (clock)    [Phase 1]
InputService                  src/input/     source-agnostic NotePlayed stream + calibration  [Phase 1]
  providers/midiProvider                     WEBMIDI.js
  providers/virtualProvider                  on-screen / computer-key
Data layer                    src/data/      Repository interface → Dexie/IndexedDB           [Phase 3]
Content (static JSON)         src/content/   skills, songs, charts/, fragments, minigames
```

★ = modules that centrally enforce the design guardrails (§4). Data flows:
content JSON → ContentService → services; InputService → ScoringEngine → Attempt → Reward/Progression → Repository (persist) → UI via store.

**Current module status (update as built):**
- ✅ `core/types.ts`, `core/content/` (ContentService + bundled loader + validation)
- ✅ `core/scoring/` (ScoringEngine + tier timing windows) — pure, 34 unit tests
- ✅ `input/` (InputService + midi/virtual providers + calibration) — source-agnostic, calibrated stream
- ✅ `audio/audioService.ts` (Tone.Sampler sampled piano w/ synth fallback + woodblock metronome + Transport master clock, perf↔audio clock bridge)
- ✅ `ui/` debug surfaces: Input debug (note stream), Calibration, on-screen keyboard
- ✅ Phase 2 song loop: `ui/session/playSession.ts` (count-in→play→score), FallingNotes (Canvas), ChordSymbols, StaffNotation (VexFlow, secondary), SessionReport, `core/scoring/{grade,liveGrader,feedback}.ts`; charts `content/charts/*.json`
- ✅ Phase 3 progression/rewards/persistence: `core/progression/progressionService.ts` ★, `core/rewards/rewardService.ts` ★, `core/srs/fsrs.ts` (ts-fsrs), `core/session/recordAttempt.ts` (pure reducer), `data/{repository,dexieRepository}.ts`, `ui/store/gameStore.ts`, `ui/screens/Progress.tsx`. Guardrail suite `tests/unit/guardrails.test.ts`.

---

## 3. Design decisions & rationale (ADR log — append-only; supersede, don't delete)

- **2026-07-22 — Scope = MVP Phases 0–3.** A runnable, honest single-song-plus-progression loop before breadth. (build-spec §8)
- **2026-07-22 — Input: source-agnostic InputService with MIDI + virtual-keyboard providers.** Jude owns a MIDI keyboard; the virtual provider makes the app runnable + Playwright-testable without hardware and is the simulated-MIDI injection point (build-spec §9). Interface reserves `source:'mic'` for the deferred acoustic path (§12) so nothing downstream changes when it lands.
- **2026-07-22 — Chart format: custom JSON (`NoteEvent[]`), tempo-independent (beats).** Simple, full control, fast to author/test; behind a loader so MusicXML import can be added later. (build-spec §10.1)
- **2026-07-22 — Content is data (JSON), auto-discovered.** `charts/*.json` loaded via Vite glob; adding content needs no code change. (build-spec §2)
- **2026-07-22 — Single soft currency "Riffs"; no leaderboards in v1; falling-notes + chord-symbols primary, staff (VexFlow) secondary; cosmetics deferred to Phase 6; desktop-first, not a PWA.** (build-spec §10 recommendations accepted)
- **2026-07-22 — Stack pinned:** React 19 + Vite 8, TypeScript 7 (strict), Zustand 5, Tailwind 3.4 (config-based), Tone.js 15, VexFlow 5, ts-fsrs 5, Dexie 4, Vitest 4 + Playwright. TS 7 removed `baseUrl` — path aliases use relative `paths` (`"@/*": ["./src/*"]`); node-side configs need `@types/node`.

---

## 4. Key invariants / guardrails (never violate — dedicated test suite in Phase 3)

From build-spec §0.1#4, doc 03 §9, doc 04 §8:

1. **`playerLevel` / `currentPlayingTier` derive ONLY from Hands progress + playing attempts.** `headTrackXP` is a separate accumulator and can never feed them. (Encoded in `PlayerState`, enforced in ProgressionService.)
2. **No buying stars/XP/skill unlocks with Riffs** — currency touches cosmetics & convenience only (streak freezes, hints, slow-downs).
3. **Song unlocks require demonstrated skill** (all required skills mastered via Hands), never currency/grind.
4. **Mastery = at-tempo, un-assisted.** Assists (`Assist[]`) and tempo are tracked on every Attempt; the mastery star requires `atTempo && assistsUsed.length === 0`.
5. **XP scales with difficulty × freshness × performance** — replaying easy/mastered content pays ~nothing.
6. **Variable rewards trigger only on good playing** — never on app-open or payment.
7. **AFK/Head progress cannot raise Player Level or playing tier; Scouting preview cap = +1 tier** (designed into Phase-3 services; AFK games built Phase 5).
8. Scoring measures **timing, not just notes**; the timing-improvement graph is the un-gameable progress measure.

---

## 4a. Design system ("Parlor Pastel", light theme)

Warm, genre-grounded light UI (tokens in `tailwind.config.ts`; globals in `src/index.css`). **Never reintroduce dark-theme classes** (`bg-ink*` as surfaces, `text-neutral-*`, `border-ink-line`).
- **Color:** `paper` (app bg), `sand` (insets/tracks), `surface` (cards), `ink`/`ink.soft` (text), `line` (borders). Accents `rose`/`amber`/`mint`/`peri`, each `-soft`/DEFAULT/`-deep`. `rose` = primary action, `amber` = hero "Play". `grade.*` stays functional (scoring) — mirror any change in `FallingNotes.tsx` GRADE_COLORS.
- **Type:** `font-display` = Fredoka (headings, numbers, buttons, chips); body = Nunito. Loaded via `@fontsource` in `main.tsx` (offline, no CDN).
- **Shape/elevation:** cards `rounded-3xl` + `shadow-soft` (hover `shadow-lift`); buttons/toggles are `rounded-full` pills; segmented controls = `bg-sand p-1` container with `bg-surface shadow-soft` active. Borders are subtle `border-line`.
- **Motion:** CSS keyframes `pop`/`fade-up`/`shimmer` (tailwind `animate-*`); tactile button press (`active:translate-y-px`), hover lift; `useCountUp` hook for reward/stat numbers. All gated by `prefers-reduced-motion` (index.css). `:focus-visible` ring for a11y.
- **Canvas** (`FallingNotes.tsx`) is hand-colored (not Tailwind): light ivory lane, rose hit line, peri/warm-neutral notes — keep in sync with the tokens if the palette changes.
- **Key alignment:** `core/pianoLayout.ts` (`keyRects`, `octaveRange`) is the SINGLE source of key geometry — both `PianoKeyboard` (CSS %) and `FallingNotes` (canvas px) use it over the same pitch range, and SessionPlayer stacks them in one full-width container so a falling note drops onto its key. If you change key layout, change it here.

## 5. Conventions

- **TypeScript strict, no `any`.** Use `unknown` + narrowing for external data. `interface` for object shapes, `type` for unions.
- **Testable core, thin UI.** Scoring/progression/rewards/srs are pure modules independent of React; UI is a thin layer over the store.
- **Functional React components**, named prop `interface`s (no `React.FC`), immutable state updates.
- **Tailwind utility classes only.** Lucide icons. Minimal emoji, light/clean visuals (build-spec §7).
- **Path alias** `@/` → `src/`.
- **Content is JSON** under `src/content/`; validate on load (`validateContent`).
- **Tests:** Vitest unit tests in `tests/unit/**` (`*.test.ts[x]`), Playwright e2e in `tests/e2e/**`. Simulate MIDI via the virtual provider for deterministic e2e.
- **Run/build/test:** `npm run dev | test | typecheck | build | e2e`.
- **Commits:** conventional commits (`type(scope): description`); commit CLAUDE.md updates alongside the change.

---

## 6. Open questions & TODOs

- **Piano sample assets.** Now a `Tone.Sampler` playing the Salamander grand piano (14 samples, every minor third A2–C6) fetched from `https://tonejs.github.io/audio/salamander/`, with the `Tone.PolySynth` synth as fallback until samples load / when offline. **Caveat: needs internet on first load** (browser-cached after). To go fully offline-first, bundle the samples locally (`public/samples/`) and repoint `baseUrl`. Organ/Rhodes/Wurli sound packs = Phase 6 cosmetics.
- **Bundle size.** Tone.js **and VexFlow** dominate the single JS chunk (~1.8 MB). Lazy-load AudioService (first audio use) and StaffNotation/VexFlow (only when the staff toggle is on), and code-split, before shipping. Fonts are separate ~20 kB woff/woff2 assets (fine). OK for local dev now.
- **Deferred: microphone / acoustic input** (build-spec §12). Not in v1. The app must clearly tell a user without a MIDI device that MIDI (or the virtual keyboard) is required. Do not assume mic support exists.
- **Chart authoring** proceeds as phases need it: Ode to Joy + 12-Bar Blues in C first, expanding toward the doc-02 §8 eight-song v1 set.
- Notation depth, mic-scoring transparency, PWA/mobile, cosmetic art budget, social layer — revisit in later phases (build-spec §10).

---

## 7. Changelog (dated, human-readable)

- **2026-07-22 — Wrong-note feedback in the Session Report.** ScoringEngine now attributes each wrong note to the bar it landed in (`Attempt.wrongNotes: {pitch,bar}[]`; `extraNotes = wrongNotes.length`). `feedback.barAccuracies` adds per-bar `wrong` count and a penalized `score = correct ÷ (events + wrong)`; the weak-spot tip uses `score`. Report's heat-map ("Trouble spots by bar") is colored by that score with a red count **badge** on bars that had wrong notes, a "N wrong notes" chip, and a legend — so the report shows how many wrong notes and *where*. Verified in-browser (4 wrong clicks → badges on the right bars).
- **2026-07-22 — Wrong/extra notes now penalize the score.** ScoringEngine counts **wrong notes** (played notes not matched to an event whose pitch isn't expected nearby in time — so a mistimed correct-pitch note or a double isn't double-penalized) as `Attempt.extraNotes`, and accuracy is now `correct ÷ (expected + wrong)`, which gates stars. Report tile renamed "Notes correct" → **"Accuracy"** with an "N extra notes" sub; a new feedback tip fires when extras are high. Previously extra notes were ignored, inflating scores. 3 new unit tests; verified in the shipped bundle (4 correct + 3 wrong → accuracy 57%, 0 stars, vs 100%/3★ before).
- **2026-07-22 — Slimmer notes + Preview + Pause/Restart.** (1) Falling notes now draw as a slim bar centered on each key (~60% white / ~86% black) so a note clearly maps to one key. (2) **Preview ("Watch") mode**: `PlaySession` gained a `'preview'` mode that plays the chart back on the sampled piano (`AudioService.scheduleChartAudio`, scheduled on the Transport so it stops/pauses cleanly) with the notes falling, no input scoring, finishing back to `idle` (never `done`, so no attempt is recorded). (3) **Pause/Resume + Restart** during a scored take: `PlaySession.pause/resume/restart` + a `'paused'` phase (input ignored while paused); `AudioService.pause/resumeTransport`. SessionPlayer shows phase-driven controls (Watch/Play when idle · Stop during preview · Restart+Pause/Resume during a take). Verified all three in-browser.
- **2026-07-22 — Multi-octave keyboard + live key highlighting.** Play view now shows a comfortable minimum window of ~3 octaves (`displayRange`, default C3–B5, widened to fit songs that reach further) instead of a tight single octave. PianoKeyboard now highlights the pressed key from the **unified input stream** (`inputService.onNote`), so MIDI, computer keys, and on-screen taps all light the key (was: only on-screen/computer-key via the component's own handler; MIDI didn't highlight).
- **2026-07-22 — Falling-notes/keyboard alignment + MIDI-on-Play.** New `core/pianoLayout.ts` (shared key geometry) so falling notes drop exactly onto their keys; PianoKeyboard rewritten to position keys by % from `keyRects`, FallingNotes places note columns from the same rects, SessionPlayer derives a shared whole-octave range (`octaveRange`) from the chart (now includes LH bass that used to fall outside the fixed C4–C6 keyboard) and stacks canvas + keyboard in one full-width container. Reusable `MidiConnectButton` added to the Play toolbar (and InputDebug) — MIDI connects alongside the always-on virtual keyboard and reaches scoring while playing.
- **2026-07-22 — Audio + input polish.** (1) Metronome is now a **woodblock** (dry pitched "tok" + band-passed pink-noise transient, accented downbeat) instead of the bass MembraneSynth. (2) Note playback uses a **sampled grand piano** (Tone.Sampler, Salamander via CDN) with the synth as fallback while loading / offline — verified all 14 samples fetch 200. (3) InputService now supports **concurrent providers**: the virtual (on-screen + computer-key) keyboard is always active, so laptop-key play works with no MIDI and continues alongside a connected device (was single-provider, replaced on MIDI select). Computer-key map lives in `virtualProvider.ts` (`COMPUTER_KEY_MAP`: Z–M white / S,D,G,H,J black / Q–U octave up); new `KeyboardHint` shown on Play + Input; InputDebug reworked to a "Connect MIDI" toggle. `appStore.providerKind` → `midiEnabled`.
- **2026-07-22 — UI restyle ("Parlor Pastel", light theme + game feel).** Visual/motion-only pass (no logic changes; all 92 unit + 4 e2e still green). Dark near-black theme → warm ivory light theme with genre-grounded pastels; Fredoka + Nunito via @fontsource; rounded-3xl cards + soft shadows + pill buttons; tactile/hover motion, star pop-in, XP/Riffs count-up (`useCountUp`), animated bars, all reduced-motion-gated. Home rebuilt as a game **hub** (hero + HUD chips + amber Play + next-unlock teaser). FallingNotes canvas re-derived for the light lane. New design-system section (§4a). Verified all screens in-browser.
- **2026-07-22 — Phase 3 (Progression + rewards + persistence) — MVP complete.** Two-lock ProgressionService ★ (Hands from playing, Head reserved for AFK; playing tier & unlocks read Hands only), RewardService ★ (XP = difficulty×freshness×performance, Riffs firewall with cosmetic/convenience-only sinks, streaks+freezes, ethical encore bonus that only fires on good playing), FSRS wrapper (ts-fsrs; star→grade, retrievability, due queue). `recordChartAttempt` pure reducer composes all three; `gameStore` persists via Repository→Dexie/IndexedDB. Progress screen (tier/level/XP/Riffs/streak, two-lock skill nodes, next-unlock endowed-progress bars); SongPicker gates locked songs with "N skills to unlock"; SessionReport shows XP/Riffs/level-up/unlocks/encore. **Dedicated guardrail suite** proves invariants 1–7. Persistence e2e (canned mastery take → unlock → reload → still unlocked → playable) via a dev-only `__pianoTest` seam (`ui/devTest.ts`, DEV-only). Decisions: HANDS_THRESHOLD 0.85 so only the mastery star Hands-masters a skill; song unlock = required skills Hands-mastered (Head/AFK & Riffs can never unlock); entry songs have empty requiredSkills (Ode teaches the basics that gate the 12-bar blues, giving a real 2-song unlock chain). 92 unit + 4 e2e tests green.
- **2026-07-22 — Phase 2 (Single playable song loop).** Full take loop: `PlaySession` orchestrates count-in → play (metronome clock) → offline scoring → report. FallingNotes Canvas visualizer synced to Transport; ChordSymbols strip (primary notation) with current-bar highlight; StaffNotation (VexFlow treble staff, secondary/best-effort, toggle off by default, defensive try/catch); LiveGrader for real-time per-note colour; SessionReport with star rating, timing histogram, weak-bar heat-map, and one actionable tip (`core/scoring/feedback.ts`, tested). Authored charts: Ode to Joy (simplified) + 12-Bar Blues in C (simplified triads / full dom7). 3 Playwright smoke e2e (nav, player render, input log). **Key fix:** metronome beat ticks now drive off a rAF loop reading the Transport clock (was `Tone.getDraw()`, which didn't reliably fire app-state callbacks and left the play phase stuck). Verified full loop in-browser incl. report. Falling-notes visualizer is treated as an `assist` (mastery star withheld while on) — honest per guardrail #4.
- **2026-07-22 — Phase 1 (Input + Audio + Scoring core).** ScoringEngine (pure `(Chart, NotePlayed[], tempo, tier) → Attempt`) with tier-interpolated timing windows, per-note grades, timing histogram, 1–3 stars + at-tempo/un-assisted mastery star — 34 deterministic unit tests. Source-agnostic InputService with WEBMIDI.js + virtual-keyboard providers (shared `performance.now()` clock), one-time latency calibration (pure median-offset computation). AudioService (Tone.js PolySynth + metronome/Transport as master clock, audio↔perf clock bridge for Phase-2 alignment). Input-debug + calibration screens + on-screen keyboard; verified in-browser (clean calibrated note stream). Decisions: timing windows interpolate linearly tier 1↔30; match window capped at ~1 beat (beyond = Miss); XP/Riffs left 0 by ScoringEngine (RewardService fills). Note: Tone.js pushes the bundle >500 kB — lazy-load later (added to TODOs).
- **2026-07-22 — Phase 0 (Scaffold).** Vite+React+TS(strict), Tailwind, Zustand, Dexie, Vitest, Playwright wired. Domain model (`core/types.ts`), ContentService with validation + Vite-glob chart loading, seed `skills.json`/`songs.json`, placeholder shell. dev/test/typecheck/build all green. git initialized.
