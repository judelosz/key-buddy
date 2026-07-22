# Piano Learning App — Technical Build Spec

*The engineering plan that turns the four design documents into a working web app. Written to be handed directly to Claude Code.*

Prepared July 2026. Companion to: `01-curriculum-and-learning-design`, `02-gamification-design`, `03-song-library`, `04-afk-mode-design`.

---

## 0. Instructions to the coding agent (read first)

You are building a **personal-use, gamified piano-learning web app** for a complete beginner whose goals are blues, gospel, and country. The four companion design docs in `docs/` are the **source of truth** for *what* and *why*; this spec is the source of truth for *how*. When they conflict, flag it rather than guessing.

**v1 scope — input is MIDI-only.** The initial build wires up a **MIDI keyboard connected to the computer running the app** as the sole input. Do **not** build microphone / acoustic-audio note detection in v1. The design docs describe a microphone path (hearing an acoustic piano through the computer's audio input) — that is a **deferred future capability**, explicitly out of scope for the first build. Everything in v1 assumes a connected MIDI device. See §12 for the deferred audio/listening work.

**Before writing code:** you (the agent) initialize git and write the `README.md` yourself, then complete the mandatory `CLAUDE.md` step below.

### 0.1 MANDATORY: create and maintain `CLAUDE.md`

Create a `CLAUDE.md` at the repo root as the **living engineering memory** of this project. This file is how current and future coding agents stay aligned. It is not optional and it is not write-once.

`CLAUDE.md` must contain and keep current:

1. **Project overview** — one paragraph on what the app is and its goal, and pointers to the four design docs.
2. **Architecture map** — the module structure, what each module owns, and how data flows between them. Update whenever a module is added or its responsibility changes.
3. **Design decisions & rationale (ADR-style log)** — a dated, append-only list of every non-trivial technical decision (library choices, data-model shapes, scoring formulas, algorithm parameters), each with a one-line rationale. When a decision is reversed, add a new entry that supersedes the old one — do not delete history.
4. **Key invariants / guardrails** — the non-negotiable rules from the design docs that code must never violate (e.g., "AFK XP can never raise Player Level or playing tier"; "you cannot buy stars/XP/skill unlocks with currency"; "mastery requires at-tempo, un-assisted play"). Any agent must check changes against this list.
5. **Conventions** — coding style, naming, state-management patterns, test conventions, how to run/build/test.
6. **Open questions & TODOs** — the current known unknowns and deferred work.
7. **Changelog of significant changes** — dated, human-readable.

**The update discipline (state this in `CLAUDE.md` itself so future agents follow it):** at the end of any task that adds a module, changes the data model, alters a scoring/reward/algorithm parameter, or resolves an open question, update the relevant `CLAUDE.md` section in the same commit. Treat an out-of-date `CLAUDE.md` as a bug.

Keep `CLAUDE.md` concise and navigable — it's a map and a decision log, not a duplicate of the design docs (link to those).

---

## 1. Product summary (recap)

A single-user web app that teaches piano through a gamified, research-backed loop. **v1 input is a MIDI keyboard connected to the host computer**; microphone/acoustic listening is a deferred future capability (§12). Core pillars, each detailed in its design doc:

- **Curriculum** — a 30-tier skill tree across a shared foundation + blues/gospel/country branches; interleaved daily sessions; spaced review; a "stretch song" ~10 tiers up.
- **Gamification** — precise note+timing scoring, XP weighted by difficulty × freshness, a "Riffs" currency for cosmetics only, skill-gated song unlocks, ethical variable rewards, streaks, adaptive difficulty (flow), roadmap, and goal-setting.
- **Song library** — a tiered, skill-tagged, mostly public-domain repertoire.
- **AFK ("Woodshed") mode** — off-keyboard theory/ear/rhythm mini-games, coupled to playing skill via the two-lock model.

---

## 2. Guiding engineering principles

- **Local-first, no backend for v1.** It's a personal prototype; persist everything on-device (IndexedDB). This removes auth, servers, and privacy concerns and makes the app instantly runnable. Design the data layer behind an interface so a sync backend can be added later without rewrites.
- **The scoring engine is the foundation.** Everything downstream (XP, stars, mastery, unlocks) depends on it being accurate and *fair*. Build and test it first and hardest.
- **Enforce the design guardrails in code, centrally.** The honesty rules (Section 0.1 #4) should live in one place (e.g., a rewards/progression service), not be scattered, so they can't be accidentally bypassed.
- **Data-driven content.** Skills, songs, and mini-games are data (JSON), not hardcoded logic, so the curriculum can grow without code changes.
- **TypeScript everywhere**, strict mode. Model the domain with real types.
- **Testable core, thin UI.** Put scoring, spaced-repetition, progression, and reward logic in pure, unit-tested modules independent of React.

---

## 3. Recommended tech stack

All choices validated as current best-in-class (July 2026). Record final picks in `CLAUDE.md` decision log.

| Concern | Recommendation | Rationale |
|---|---|---|
| Language | TypeScript (strict) | Domain safety |
| Framework | React + Vite | Fast dev, artifact-friendly, huge ecosystem |
| State | Zustand (or Redux Toolkit) | Simple, testable stores |
| Styling | Tailwind CSS | Fast, consistent; matches design-system work |
| MIDI input **(v1)** | **WEBMIDI.js** (wraps Web MIDI API) | Ergonomic device handling; the sole v1 input |
| Mic pitch detection **(deferred — §12)** | **pitchy** (McLeod Pitch Method) or **pitchfinder** (YIN) in an **AudioWorklet** | Not built in v1. Listed so the InputService interface is designed to accept it later without rework |
| Audio / playback / metronome | **Tone.js** (Tone.Sampler, Tone.Transport) | Sampled piano/organ/Rhodes; Transport is the master clock |
| Notation rendering | **VexFlow** (or **OpenSheetMusicDisplay** if using MusicXML) | Standard, browser-native engraving |
| Falling-notes visualizer | Custom Canvas/WebGL synced to Tone.Transport | Core gameplay view |
| Spaced repetition | **FSRS** (open-source JS impl) | Now the standard (Anki default since 23.10); ~20–30% fewer reviews than SM-2 for same retention |
| Persistence | IndexedDB via **Dexie.js** | Structured local storage behind a repository interface |
| Testing | Vitest (unit) + Playwright (e2e) | Fast unit loop; browser e2e for audio/MIDI flows |

**Latency note:** even over near-instant USB-MIDI, the browser/OS audio stack adds output latency, so the app must run a **one-time input calibration** (tap to a click, measure offset, subtract from all timing judgments). This is a v1 requirement, not a nicety — see design doc 02 §3.5. (Calibration matters even more for the deferred mic path, but v1 calibrates MIDI only.)

---

## 4. High-level architecture

```
┌─────────────────────────── UI (React) ───────────────────────────┐
│  Screens: Journey Map · Session Player · Woodshed(AFK) ·          │
│           Roadmap/Skill Tree · Goals · Stats · Shop/Cosmetics ·   │
│           Onboarding/Calibration                                  │
└───────────────┬───────────────────────────────────────────────────┘
                │ (hooks/selectors)
┌───────────────▼──────────── Core services (pure TS) ─────────────┐
│  InputService (MIDI + Mic + Calibration)                          │
│  ScoringEngine (pitch + timing → grades, stars)                   │
│  SessionBuilder (interleaving + spaced review + stretch fragments)│
│  ProgressionService (two-lock mastery, tier, unlocks) ★guardrails │
│  SpacedRepetition (FSRS wrapper)                                  │
│  AdaptiveDifficulty (flow engine: tempo/window/assist)            │
│  RewardService (XP, Riffs, variable bonuses, streaks) ★guardrails │
│  GoalService (SMART goals, learning vs performance)               │
│  AudioService (Tone.js sampler, metronome/Transport)              │
│  ContentService (loads skills/songs/minigames JSON)               │
└───────────────┬───────────────────────────────────────────────────┘
                │
┌───────────────▼──────────── Data layer ──────────────────────────┐
│  Repository interface → Dexie/IndexedDB (v1)                      │
│  Content (static JSON): skills, songs, fragments, minigames       │
│  User state: progress, review queue, goals, streak, wallet, prefs │
└───────────────────────────────────────────────────────────────────┘
```

★ = modules that centrally enforce the design guardrails.

---

## 5. Data model (core entities)

Model these as typed entities; persist user-state entities, ship content entities as JSON. This mirrors design doc 03 §7 (extend, don't contradict).

- **Skill** — `id, name, family (6 curriculum families), tier (1–30), genre, prerequisites[], theoryConceptId?, description`.
- **SkillProgress** (per user) — `skillId, headLock (0–1), handsLock (0–1), masteredAt?, freshness (FSRS state), lastReviewed`. *Gold = both locks ≥ threshold.*
- **Song** — full schema from design doc 03 §7: `id, title, source, year, publicDomain, licenseNote, genre, tier, key, tempoTargetBPM, timeSignature, feel, requiredSkills[], taughtSkills[], arrangementLevels[], fragments[], backingTrackId`.
- **Chart** — the playable representation of a song/arrangement: an ordered list of `NoteEvent { pitch(es), startBeat, durationBeats, hand }`. This is what the ScoringEngine judges against and the visualizer renders. (Decide format: custom JSON vs MusicXML — see Open Decisions.)
- **Fragment** — extractable riff/voicing/groove from a stretch song; a mini-Chart plus `sourceSongId, skillTags[]`.
- **MiniGame** — `id, type (chord-ear, interval, note-id, build-chord, rhythm-tap, progression-ear, feel-id, name-that-lick, …), skillFamily, generatorParams`. Difficulty is derived at runtime from playing tier (design doc 04 §3), not stored per item.
- **Attempt** — result of a take (song or mini-game): `refId, timestamp, perNoteGrades[], timingHistogram, stars, tempo, assistsUsed[], xpAwarded, riffsAwarded`.
- **SongMastery** — durable multi-session song progress separate from one Attempt: section/transition evidence, qualifying session IDs, delayed review, transfer evidence, weak sections, and mastery level.
- **ReviewItem** — FSRS card wrapping a skill or theory/ear concept.
- **Goal** — `id, horizon (session|weekly|long), type (learning|performance), text (SMART), target, progress, accepted (bool), deadline?`.
- **Wallet / PlayerState** — `playerLevel, totalXP, headTrackXP, riffs, streak, streakFreezes, currentPlayingTier, cosmeticsOwned[], equippedCosmetics`.

> Guardrail encoded in types: `playerLevel`/`currentPlayingTier` derive from **Hands** progress and playing attempts only. `headTrackXP` is separate and cannot feed them. Put the derivation in `ProgressionService` and unit-test it.

---

## 6. Subsystems — responsibilities & acceptance criteria

### 6.1 InputService
**v1: MIDI only.** Handle MIDI via WEBMIDI.js: device discovery, connect/disconnect, and emit a unified `NotePlayed { pitch, velocity, timestampMs, source: 'midi' }` stream. Own the **calibration** routine and apply the offset to all timestamps. Handle no-device and device-lost states gracefully (prompt to connect a keyboard).

**Design for the future without building it:** define the `NotePlayed` stream and the InputService interface as **source-agnostic** so a `source: 'mic'` provider (AudioWorklet + pitchy, with widened windows and an "approximate scoring" flag) can be slotted in later (§12) without touching the ScoringEngine or anything downstream. Do not implement the mic provider in v1.
*Done when:* a connected MIDI keyboard produces a clean, calibrated event stream; a debug view shows incoming notes + measured latency; missing/disconnected devices are handled with a clear prompt.

### 6.2 ScoringEngine
Pure function: `(Chart, NotePlayed[], tempo, tier) → Attempt`. Judges **pitch** (right notes, chord completeness) and **timing** (ms deviation from beat grid) using tier-dependent windows (design doc 02 §3.2). Produces per-note grades (Perfect/Great/Good/Early/Late/Miss), a timing histogram (rush/drag), and a 1–3 star rating with the at-tempo "mastery" star (§3.4).
*Done when:* deterministic unit tests cover exact-hit, early, late, wrong-note, missing chord-tone, and at-tempo-vs-slowed cases; scoring never blocks the music on a miss.

### 6.3 SpacedRepetition (FSRS)
Wrap an FSRS JS implementation. Every skill, theory item, scale, groove, song section, and reusable fragment is a reviewable card with difficulty/stability/retrievability. Grading comes from Attempt results, not self-report where possible (map star/accuracy, timing, assists, and mode → FSRS grade). Store section-level error evidence and expose due, struggling, prerequisite-refresh, and transfer-review queues to the SessionBuilder.
*Done when:* due-queue is correct across simulated multi-day histories; freshness values are readable by RewardService; a failed song section can generate a smaller remediation item; a previously mastered skill can return in a changed key, feel, or retrieval mode; review selection does not repeatedly serve the same failing attempt unchanged.

### 6.4 SessionBuilder
Assemble an interleaved, spiral session (design doc 01 §9 and doc 06 §3.5): warm-up → new micro-skill → immediate remediation or prerequisite refresh → 1–3 due reviews → changed-context maintenance item → stretch-song Boss Challenge → theory/ear quiz → song time → wrap. Enforce interleaving (no two consecutive segments on the same skill), bounded retries, tier re-entry, and song-section resurfacing. Produce an equivalent **AFK session** when no input device / user chooses Woodshed.
*Done when:* generated sessions respect interleaving, pull correct due and struggling items, include at least one previous-tier retrieval when suitable, include exactly one stretch Boss Challenge, update SongMastery from qualifying Path or Free Play attempts, avoid identical retry loops, and fit the target minutes.

### 6.5 AdaptiveDifficulty (flow engine)
Adjust tempo (start ~50%, auto-nudge on success), timing-window strictness, arrangement level, and assists to keep success rate in ~70–85% (design doc 02 §6). The stretch song is exempt (sits above the channel by design).
*Done when:* simulated strong/weak players converge into the target success band; tempo ramps and eases correctly.

### 6.6 ProgressionService ★
Owns the **two-lock model** (design doc 04 §2): Hands lock from playing attempts, Head lock from AFK attempts; skill goes gold only when both pass threshold. Computes playing tier, gates **song unlocks on required-skill mastery** (design doc 02 §4.4), and enforces the **+1 Scouting preview cap** for AFK (design doc 04 §3).
*Done when:* tests prove a skill cannot gold, a song cannot unlock, and tier cannot rise from AFK/Head progress alone; preview never exceeds +1 tier.

### 6.7 RewardService ★
Award XP = `f(difficulty × freshness × performance)` (design doc 02 §4.1) so easy replays pay ~nothing. Manage Riffs (earn/spend), **cosmetics-and-convenience-only** sinks, streaks + freezes, and the **ethical variable-reward layer** (bonuses trigger only on good playing). Central home for the "cannot buy stars/XP/unlocks" and "AFK XP can't raise Player Level/tier" invariants.
*Done when:* tests prove the currency firewall, the difficulty×freshness weighting, and that no reward path is triggered by mere app-open or payment.

### 6.8 GoalService
Create/track session, weekly, and long-term goals; frame new-material goals as **learning goals**, consolidation as **performance goals** (design doc 02 §8); require explicit acceptance; feed progress to the roadmap; propose goals calibrated to recent performance.

### 6.9 AudioService
Tone.js: sampled instruments (piano + organ/Rhodes/Wurli sound packs doubling as cosmetics/ear-training), **metronome/Transport as the master clock** the ScoringEngine and visualizer sync to, backing tracks for jam/improv modes, and playback of prompts for ear-training mini-games.

### 6.10 ContentService
Load and validate skills/songs/charts/fragments/minigames JSON; expose queries the other services need (by tier, genre, skill, due, etc.).

---

## 7. Screen inventory (UI)

**Landing onboarding** (input setup, what the app teaches, Missions/Free Play/AFK/Progress/Settings, XP/levels, unlocks, mastery, then launch the first Mission) · **Missions** (guided modules, current lesson, future unlocks, available songs, Boss Challenges, next action) · **Free Play** (open practice of unlocked songs/arrangements using the same player, SongMastery, and scoring) · **AFK Mode** (tier-constrained theory, ear, rhythm, and memory challenges) · **Progress** (level/tier meter, Hands/Head skills, SongMastery, attempt history, session reports, timing trends) · **Settings** (Tune-up, input, calibration, audio, accessibility) · Session Player (falling-notes + notation + live grade colors + metronome) · Roadmap & Skill Tree (two-lock nodes, mastery and prerequisite progress) · Session Report (histogram, weak-bar heatmap, one tip).

Design-system note: a `symbolic-frontend` skill/brand may be applied for styling; keep visuals light, clean, satisfying hover/feedback, minimal emoji.

---

## 8. Build phases / milestones

Build in vertical slices so there's a runnable loop early. Update `CLAUDE.md` at the end of each phase.

**Phase 0 — Scaffold.** Vite+React+TS, Tailwind, Zustand, Dexie, test harness. Repo hygiene, `CLAUDE.md`, `README.md`, `docs/`. Load content JSON.

**Phase 1 — MIDI Input + Audio + Scoring core (the foundation).** WEBMIDI.js MIDI input (source-agnostic InputService interface), calibration, Tone.js metronome, ScoringEngine with full unit tests, a debug "play against a chart" screen. **No microphone in this phase.** *This phase must be rock-solid before proceeding.*

**Phase 2 — Single playable song loop.** One Chart end-to-end: falling-notes visualizer + notation, real-time grade colors, star rating, session report. Use the v1 starter set (design doc 03 §8), beginning with the 12-Bar Blues in C and "Ode to Joy."

**Phase 3 — Progression + rewards + persistence.** Skill tree data, ProgressionService (two-lock), RewardService (XP/Riffs/streak + guardrails), FSRS review queue, IndexedDB persistence. Skill-gated unlocks working.

**Phase 4 — Curriculum/content vertical slice and post-MVP shell.** Replace the MVP shell with landing onboarding and Missions, Free Play, AFK Mode, Progress, and Settings tabs. Implement the funneled Tier 1–5 module/song/exercise loop, XP-to-level meter, SongMastery foundation, and first stretch Boss Challenges. Defer Streaks and Riffs from the new UI.

**Phase 5 — SessionBuilder + AdaptiveDifficulty.** Interleaved daily sessions, spaced review woven in, stretch-song fragments, flow-based tempo/assist adaptation, and session lengths.

**Phase 6 — Woodshed/AFK mode.** Mini-game engine, Head-lock coupling, +1 preview cap, streak-keeps-alive, rhythm-tap reusing the timing engine.

**Phase 7 — Journey, goals, stats, cosmetics, and polish.** Expand the Path map, skill-tree UI, goal-setting, timing-improvement graph, shop/cosmetics, variable-reward flourishes, and returning-user motivation.

**Phase 8 — Content expansion.** Grow the song library beyond the Tier 1–5 vertical slice across Tiers 6–30 and blues/gospel/country; author more charts, fragments, and mini-games.

MVP = Phases 0–3 (a real, rewarding, honest single-song-plus-progression loop). Everything after deepens it.

---

## 9. Testing & verification strategy

- **Unit (Vitest):** ScoringEngine (timing/pitch edge cases), RewardService (currency firewall, XP weighting), ProgressionService (two-lock invariants, unlock gating, preview cap), FSRS scheduling, SessionBuilder interleaving.
- **Guardrail tests as first-class:** dedicate a test suite to the Section 0.1 #4 invariants; these should be the hardest to accidentally break.
- **E2E (Playwright):** onboarding+calibration, play a song with a simulated MIDI stream, earn a star, unlock a song, run an AFK session, maintain a streak. Simulate MIDI input programmatically so tests are deterministic.
- **Manual/agent verification:** after UI phases, capture screenshots of key screens and review; sanity-check the timing-improvement graph against synthetic data.
- Record the testing conventions in `CLAUDE.md`.

---

## 10. Open decisions for Jude (flag in CLAUDE.md until resolved)

1. **Chart format** — custom JSON (simple, full control) vs **MusicXML + OSMD** (import existing scores, richer notation). Recommend custom JSON for v1 speed; revisit if importing scores becomes important.
2. **Notation depth** — how much standard-notation reading to show vs. chord symbols + falling notes. Curriculum leans chord-symbol/ear-first (doc 01 §10); recommend falling-notes + chord symbols primary, staff notation secondary.
3. **Currency model** — single soft currency ("Riffs") for v1; premium currency only if commercializing later.
4. **Social/relatedness** — skip leaderboards in v1 (personal use); optional "share a milestone." Confirm.
5. **Cosmetic art budget** — themes + sound packs are cheap/high-value; avatars cost more. Decide v1 scope.
6. **PWA/offline** — Woodshed is ideal on mobile; decide whether v1 is an installable PWA. (Note: mobile likely can't use a wired MIDI keyboard, so a MIDI-only v1 is desktop-first.)

*(Deferred: microphone scoring transparency and window-widening are decisions for the future audio phase — §12 — not v1.)*

---

## 11. Suggested repository layout

```
piano-app/
  README.md                      ← (agent writes)
  CLAUDE.md                      ← (agent writes & maintains — Section 0.1)
  docs/
    01-curriculum-and-learning-design.md
    02-gamification-design.md
    03-song-library.md
    04-afk-mode-design.md
    05-build-spec.md             ← this file
  src/
    ui/            (screens, components, hooks)
    core/          (pure services: scoring, progression, rewards, srs, session, adaptive, goals)
    audio/         (Tone.js, metronome, sound packs)
    input/         (midi, mic, calibration)
    data/          (repository, dexie, schemas)
    content/       (skills.json, songs.json, charts/, fragments.json, minigames.json)
  tests/
    unit/  e2e/
  package.json  vite.config.ts  tailwind.config.ts  tsconfig.json
```

---

## 12. Deferred future capability — audio / acoustic listening

**Explicitly out of scope for v1.** This is documented here so it's a planned extension, not an afterthought, and so the v1 architecture leaves room for it.

The goal, in a later phase, is to let the app **hear an acoustic piano through the computer's microphone/audio input** and detect the notes played — so a user without a MIDI keyboard can still get scored feedback. Scope when it's picked up:

- Add a **mic input provider** to InputService (AudioWorklet + pitchy/pitchfinder, or a WASM detector like pitchlite) that emits the same source-agnostic `NotePlayed` stream with `source: 'mic'`. Because the InputService interface and ScoringEngine were built source-agnostic in v1, nothing downstream should need to change.
- Handle mic realities: **polyphony is hard** (dense chords/fast passages detect less reliably than single notes), so widen timing windows in mic mode and surface an **"approximate scoring"** label to the user.
- Extend calibration to measure round-trip mic latency.
- Resolve the deferred decisions: mic scoring strictness/transparency (moved here from §10).

Until this phase, the app assumes a connected MIDI keyboard and should clearly tell a user without one that MIDI is currently required. Record this boundary in `CLAUDE.md` under Open Questions/TODOs so future agents don't assume mic support exists.

---

## Sources

- [pitchy — npm](https://www.npmjs.com/package/pitchy)
- [pitchfinder — npm](https://www.npmjs.com/package/pitchfinder)
- [How Browser-Based Pitch Detection Works (MusicalBoard)](https://www.musicalboard.com/blog/2026-05-05-pitch-detection/)
- [FSRS: The Next Generation Spaced Repetition Algorithm (FluentCards)](https://fluentcards.org/blog/fsrs-spaced-repetition-algorithm/)
- [FSRS vs SM-2: Which Is Better? (DeckStudy)](https://deckstudy.com/blog/fsrs-vs-sm2-modern-spaced-repetition)
- [VexFlow — HTML5 Music Engraving](https://www.vexflow.com/)
- [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/)
- [Tone.js piano app example](https://imagicbell.github.io/posts/2019-6-15-piano-app)
- [WEBMIDI.js / Web MIDI API usage](https://github.com/fa-sharp/virtual-keyboard-display)
