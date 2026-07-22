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
- ✅ `audio/audioService.ts` (Tone.js PolySynth + metronome/Transport master clock, perf↔audio clock bridge)
- ✅ `ui/` debug surfaces: Input debug (note stream), Calibration, on-screen keyboard
- ✅ Phase 2 song loop: `ui/session/playSession.ts` (count-in→play→score), FallingNotes (Canvas), ChordSymbols, StaffNotation (VexFlow, secondary), SessionReport, `core/scoring/{grade,liveGrader,feedback}.ts`; charts `content/charts/*.json`
- ⛔ progression / rewards / srs / data — not yet implemented (Phase 3)

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

- **Piano sample assets.** Tone.Sampler needs samples; v1 currently uses a `Tone.PolySynth` (triangle) placeholder. Add a lightweight sampled piano, then organ/Rhodes/Wurli sound packs = Phase 6 cosmetics. (Sourcing TBD.)
- **Bundle size.** Tone.js pushes the JS bundle >500 kB (141 kB gzip). Lazy-load AudioService (dynamic import on first audio use) before shipping; fine for local dev now.
- **Deferred: microphone / acoustic input** (build-spec §12). Not in v1. The app must clearly tell a user without a MIDI device that MIDI (or the virtual keyboard) is required. Do not assume mic support exists.
- **Chart authoring** proceeds as phases need it: Ode to Joy + 12-Bar Blues in C first, expanding toward the doc-02 §8 eight-song v1 set.
- Notation depth, mic-scoring transparency, PWA/mobile, cosmetic art budget, social layer — revisit in later phases (build-spec §10).

---

## 7. Changelog (dated, human-readable)

- **2026-07-22 — Phase 2 (Single playable song loop).** Full take loop: `PlaySession` orchestrates count-in → play (metronome clock) → offline scoring → report. FallingNotes Canvas visualizer synced to Transport; ChordSymbols strip (primary notation) with current-bar highlight; StaffNotation (VexFlow treble staff, secondary/best-effort, toggle off by default, defensive try/catch); LiveGrader for real-time per-note colour; SessionReport with star rating, timing histogram, weak-bar heat-map, and one actionable tip (`core/scoring/feedback.ts`, tested). Authored charts: Ode to Joy (simplified) + 12-Bar Blues in C (simplified triads / full dom7). 3 Playwright smoke e2e (nav, player render, input log). **Key fix:** metronome beat ticks now drive off a rAF loop reading the Transport clock (was `Tone.getDraw()`, which didn't reliably fire app-state callbacks and left the play phase stuck). Verified full loop in-browser incl. report. Falling-notes visualizer is treated as an `assist` (mastery star withheld while on) — honest per guardrail #4.
- **2026-07-22 — Phase 1 (Input + Audio + Scoring core).** ScoringEngine (pure `(Chart, NotePlayed[], tempo, tier) → Attempt`) with tier-interpolated timing windows, per-note grades, timing histogram, 1–3 stars + at-tempo/un-assisted mastery star — 34 deterministic unit tests. Source-agnostic InputService with WEBMIDI.js + virtual-keyboard providers (shared `performance.now()` clock), one-time latency calibration (pure median-offset computation). AudioService (Tone.js PolySynth + metronome/Transport as master clock, audio↔perf clock bridge for Phase-2 alignment). Input-debug + calibration screens + on-screen keyboard; verified in-browser (clean calibrated note stream). Decisions: timing windows interpolate linearly tier 1↔30; match window capped at ~1 beat (beyond = Miss); XP/Riffs left 0 by ScoringEngine (RewardService fills). Note: Tone.js pushes the bundle >500 kB — lazy-load later (added to TODOs).
- **2026-07-22 — Phase 0 (Scaffold).** Vite+React+TS(strict), Tailwind, Zustand, Dexie, Vitest, Playwright wired. Domain model (`core/types.ts`), ContentService with validation + Vite-glob chart loading, seed `skills.json`/`songs.json`, placeholder shell. dev/test/typecheck/build all green. git initialized.
