# Key-Buddy

A personal-use, gamified piano-learning web app for a complete beginner working toward **mastery of the piano**. It teaches through a research-backed loop: play a charted song on a MIDI keyboard, get fair note-and-timing scoring, and earn honest progression where every reward is a byproduct of actually getting better.

> **v1 input is a MIDI keyboard** connected to the computer. Microphone/acoustic listening is a deferred future capability (see `docs/05-build-spec.md` §12). A built-in on-screen **virtual keyboard** lets you run and test the app without hardware.

## Status

The MVP vertical slice (**Phases 0–3**) is implemented. The current phase is **MVP hardening and user testing (Phase 3.5)** before curriculum expansion. See [`docs/07-development-roadmap.md`](docs/07-development-roadmap.md) for the phase plan, exit criteria, and test windows; see `CLAUDE.md` for the live architecture map, decision log, and guardrails.

## Tech stack

TypeScript (strict) · React + Vite · Zustand · Tailwind · WEBMIDI.js · Tone.js · VexFlow · ts-fsrs (FSRS) · Dexie (IndexedDB) · Vitest + Playwright.

## Getting started

```bash
npm install
npm run dev        # start the app (http://localhost:5173)
npm test           # unit tests (Vitest)
npm run typecheck  # tsc -b, strict
npm run build      # production build
npm run e2e        # Playwright end-to-end tests
```

A MIDI keyboard is optional for development — use the on-screen virtual keyboard. Connect a real MIDI device for authentic feel and the most accurate scoring; run the one-time calibration in onboarding first.

## Layout

```
docs/        design source-of-truth (curriculum, song library, gamification, AFK)
src/
  ui/        React screens, components, hooks, store
  core/      pure TS: types, scoring, progression, rewards, srs, content
  audio/     Tone.js sampler + metronome/Transport (master clock)
  input/     source-agnostic InputService (MIDI + virtual providers), calibration
  data/      repository interface + Dexie/IndexedDB
  content/   skills, songs, charts, fragments, minigames (JSON)
tests/       unit/ (Vitest)  e2e/ (Playwright)
```

## Documentation

The design docs in `docs/` are the source of truth for *what* and *why*; `docs/05-build-spec.md` is the source of truth for *how*; [`docs/07-development-roadmap.md`](docs/07-development-roadmap.md) is the delivery plan with phase exit criteria and test windows. `CLAUDE.md` is the living engineering memory — read it before making changes.
