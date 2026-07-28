# Key-Buddy — Visual Polish Audit & Backlog

*Audit date 2026-07-28, on a throwaway profile (fresh IndexedDB at `localhost:5199` — Jude's real profile at `:5173` untouched). Full-app screenshot sweep driven through the real UI plus the `__pianoTest` dev seams; 47 screenshots preserved in the session scratchpad (`polish-sweep/`). This is a review document — no code was changed. Items are graded **impact** (what the player feels) × **effort/risk**, and grouped into Quick wins / Worth a pass / Needs a design decision.*

**Coverage:** all 5 onboarding steps · Missions hero (new-material + review strip) + module path states · lesson takeover for listen, note-id, theory-quiz (incl. "Explain my answer"), rhythm-tap (count-in pulse + tap phase), and a chart/fragment lesson (pre-take, count-in, live play, fail result) · lesson pass + fail results incl. adaptive step-down · session intro cards (familiar-win + new-material w/ stored-adaptation notice), wrap screen · Progress (advancement checklist, tiered skills, SongMasteryCard, next unlocks) · Free Play picker · Settings (input, calibration, learning, a11y, danger zone) · AFK placeholder. **Not reached:** review-day hero flip (new material still existed on the throwaway profile), verdict-flash pill mid-take (timing), watch mode, module-complete/tier-up celebration, boss checkpoint banner.

**The one big theme.** Screen after screen, the *content* is good — warm palette, friendly type, honest copy — but the **composition abandons the lower two-thirds of the viewport**. Onboarding steps, listen lessons, choice prompts, and result screens all render a short stack of elements pinned to the top (or a small centered cluster) with a vast empty paper field below. Individually each screen reads "clean"; in sequence the app feels *unfurnished* — especially at its emotional peaks (finishing onboarding, passing a lesson), which currently look like the sparsest screens in the app. Most of the backlog below is variations on: give each surface a composed stage, and spend visual energy at the moments that deserve it.

---

## A. Quick wins (small, low-risk, do in one pass)

**A1 — Chart lessons render two stacked headers.** The lesson frame renders "‹ Missions / *First phrase, slowly* / Guided", then ChartPlayer renders its own "‹ Missions / *Ode to Joy (theme)* / foundation · tier 1 · …" immediately below — two back-links, two title rows (screenshot `…-21.jpg`). Fix: a ChartPlayer policy/prop to suppress its header row when hosted by LessonStage (`src/ui/components/ChartPlayer.tsx:268` block; host passes it from `src/ui/missions/LessonStage.tsx:112`). Keep the chart meta line (tempo/arrangement) — it's the lesson title row that's redundant. *Impact: every chart lesson, first impression of the app's core surface. Effort: small.*

**A2 — "Song mastery leveled up → Started" chip on a FAILED take.** The chart-lesson fail screen ("Not this take — and that's fine.") shows a celebratory rose mastery chip (`…-25.jpg`). It's honest (Discovered→Started fired) but emotionally contradictory on a fail. Either suppress the chip on failed lessons and fold it into the next pass result, or reframe on fail ("This song's journey started — level: Started"). *Impact: first fail a player ever sees is Tier 1. Effort: small.*

**A3 — Session header orphan punctuation.** The session runner's top-left reads "● ● ● · more ready when you are" — a leading middot with no count before it when dots are the subject (`…-42.jpg`). Read as one phrase it's fine; visually the "·" floats. Drop the middot or write "queue · more ready when you are". *Effort: trivial.*

**A4 — Progress checklist: core-skills copy confusion.** "Core skills Hands-mastered (0/4)" lists four names ending in "Common time (4/4)" — the meter name's own "(4/4)" reads like the count "(0/4)" beside it (`…-28.jpg`). Cheap fix: count as "0 of 4" and keep skill names verbatim, or drop the parenthetical from the skill's display name in this list. Related: the Tier-1 skills group says "0/5 mastered" while the gate needs 4 — one line of copy ("4 of these gate Level 2") would reconcile the two numbers a player will inevitably compare. *Effort: small.*

**A5 — Skills accordion skips Tier 9.** Tier headers run 1–8, 10, 11 (no tier-9 skills exist yet) (`…-29.jpg`). Cosmetic, but it reads like a bug. Either render an empty-tier row ("Nothing to learn here yet") or visually bridge the numbering gap. *Effort: trivial.*

**A6 — Stuck pressed-key highlight in note-id.** After answering D (wrong) then C4 (right), the D key stayed fully rose-highlighted through the next prompt (`…-9.jpg`). Likely the virtual provider's noteoff vs. the highlight's fade timing; a lingering "pressed" key misleads during a note-hunt lesson. Reproduce and fix the release path (`PianoKeyboard` + `virtualProvider`). *Impact: correctness-adjacent visual. Effort: small investigation.*

**A7 — Free Play zero-progress bars look broken.** Locked song cards show an empty track with 0% fill (`…-27.jpg`) — at zero the bar reads as a rendering error. Hide the bar at 0 and show it from the first mastered skill, or give it a faint 2% "starter" fill. *Effort: trivial.*

**A8 — GRADE_COLORS ↔ token sync check.** Design-system rule (§4a) requires `FallingNotes.tsx` GRADE_COLORS to mirror `tailwind.config.ts` `grade.*`. Diff them once and add a comment pointing each at the other (or a tiny unit test asserting the hex values match). *Effort: trivial; prevents silent drift.*

---

## B. Worth a pass (the composition theme + reward legibility)

**B1 — Lesson surfaces: give the exercise a stage.** Listen (`…-6.jpg`), note-id (`…-7.jpg`), and theory-quiz (`…-10.jpg`) all render prompt + controls top-left with ~65% of the viewport empty below. One shared fix in `ExerciseShell`: center the exercise column vertically in the available height, cap line length, and put the prompt inside a soft `bg-surface rounded-3xl shadow-soft` card so the exercise has a *place*. The keyboard-bearing surfaces (note-id, chart) fill naturally once the prompt block is vertically balanced above the keys. *Impact: every lesson, i.e. most of app time. Effort: medium, one shared component.*

**B2 — The listen lesson deserves furniture.** It's the first lesson every player sees, and it's a lone "Play it" pill (`…-6.jpg`). Minimum: a song card (title, tier chip, the chord strip it will use later) + a simple play-progress affordance (bar counter or pulsing vinyl/waveform motif in `peri-soft`) so playback has a visible body. Bonus: reuse the falling-notes canvas in a non-interactive "attract" mode — it already exists and is the app's best-looking artifact. *Effort: medium.*

**B3 — Result screens under-celebrate (and under-inform).** Pass result = badge icon + "Done — and it counted." + a small "+1 XP Head" chip (`…-14.jpg`). Two separate problems:
- *Celebration:* the pop/count-up energy the design system already owns (`animate-pop`, `useCountUp`, star pop-in) barely appears. A pass — especially first-completion, module-complete, tier-up — should visibly spend some of it. Keep it Parlor-Pastel-restrained, but the current screen is quieter than the *intro* card of a session segment.
- *Information:* chart-lesson results hide the take's timing detail entirely (no histogram, no weak-bar strip, no drag tip — all of which exist in `SessionReport` for Free Play). The fail screen tells you to "give it another try" without showing *what* was wrong. Surface at least the one actionable tip + weak-bar chips on chart-lesson results; the pedagogy research (doc-08 §3.15–3.16) independently argues for exactly this. *Effort: medium; components exist.*

**B4 — Onboarding steps 1 & 5 bookend the flow with its two emptiest screens.** Step 0/1 (`…-0/1.jpg`): three promise strips pinned top, bottom nav floating in space. Step 5 (`…-5.jpg`) is the worst offender: "Your first mission awaits." + two lines on a blank page at the moment of maximum commitment. Give step 5 a real send-off — the Module-1 card visualized (name, first three lesson nodes), a keyboard illustration, anything with mass — and vertically center every step's content block. *Effort: medium, contained to `OnboardingSteps.tsx`.*

**B5 — "+1 XP" moments: make the number legible as a system.** XP chips appear in four styles across lesson result / session compact result / wrap / Progress. Adopt one chip component (icon + count-up + track label) and reuse it, so the reward vocabulary is consistent everywhere. While there: the tiny lifetime "38 Hands XP" stat tiles on Progress (`…-28.jpg`) get more visual weight than any actual reward moment — invert that. *Effort: small-medium.*

**B6 — SongMasteryCard ladder needs labels at rest.** The six-segment ladder communicates nothing until hovered (`…-31.jpg`) — and the level names are the best copy in the system (Discovered → Started → …). Show the current level name + the next one ("Started → next: Sections learned"), keep hover for the rest. *Effort: small.*

**B7 — Rhythm-tap pulse could carry more of the load.** The beat circle + bar dots work (`…-17/18.jpg`), but the circle is small and low-contrast during count-in (beige on paper), exactly when the player must lock in. Scale it up (~2×), give the count-in state the amber fill it uses for its label, and pulse the *dots* on the graded beats too. The count-in phase label ("Count-in — feel the pulse…") is styled as small text — make the phase change unmissable. *Effort: small.*

**B8 — Session intro/wrap: good bones, one notch more presence.** The purpose chip + reason line structure is right (`…-42/43.jpg`). The wrap (`…-45.jpg`) would land better with the count-up treatment on its XP rows and the due-tomorrow line as a chip rather than body text. The stored-adaptation notice ("Starting at 55% tempo…") is exactly the right kind of honesty — keep. *Effort: small.*

---

## C. Needs a design decision (bring options, then implement)

**C1 — How loud is a celebration allowed to be?** Parlor Pastel is deliberately calm; the flip side is that tier-ups, module-completes, and the first mastery star currently look like ordinary passes. Decide the celebration ceiling (confetti-class moment for tier-up? star pop + shimmer only?) and write it into §4a so every future screen inherits the answer. Recommendation: three tiers of celebration — quiet (lesson pass), warm (module complete, song level-up), loud-once (tier gate, first mastery star) — with "loud" still motion-gated.

**C2 — Art direction for empty space.** B1/B2/B4 fix composition mechanically, but the app has no decorative vocabulary beyond soft blur blobs (used once, on the Missions hero and AFK card). Decide the motif language — keyboard geometry, chord-symbol typography, genre iconography (the piano/train/church of blues/country/gospel) — and apply it as low-contrast furniture on the big empty surfaces. This is the difference between "clean" and "designed." Prototype 2–3 directions on the onboarding finale before rolling anything wide.

**C3 — Should chart lessons surface the full take report?** B3 proposes tip + weak bars inline. The bigger question: is the full `SessionReport` (histogram, heat map) a Free-Play-only surface by design, or should a disclosure ("See the full take report") exist on every chart-lesson result? Pedagogy evidence favors exposure (error-location skill, doc-08 §3.16); the counterargument is result-screen simplicity inside the lesson loop. Decide once; both are cheap after B3.

**C4 — The Progress advancement checklist's visual hierarchy.** All five gate items render as identical sand rows (`…-28.jpg`); done vs. not-done differs only by a small icon. Options: (a) checked items go mint with a ✓ fill, unchecked keep a hollow ring + "what to do" line emphasized; (b) a vertical stepper. Also decide whether the ring should render a visible "capped" notch at the XP-band boundary — right now a nearly-full gold ring at Level 1 over-promises (`…-28.jpg`). *(The §4a rule that a full ring must never imply level-up is honored in logic but not yet in visual language.)*

**C5 — Density guard for future tiers on Progress.** At Tier 5+ the accordion works, but each tier row is heavy (full-width sand bars). With 30 tiers this page becomes a wall. Consider a compact grid of tier chips (x/y + state color) with one expanded tier at a time. Not urgent until Tier 6–10 content lands — decide before it does.

---

## D. Verification checklist for the implementation pass

- After A1: run `missions.spec.ts` + open a fragment lesson — exactly one back-link; `session.spec.ts` still green (section-drill segments also host ChartPlayer).
- After B1/B4: re-run the full onboarding e2e (`onboarding.spec.ts`) and the smoke specs — several rely on exact-text locators.
- A6: regression-test with the virtual provider (press wrong key → next prompt → no lingering highlight) — add to the manual checklist if not unit-testable.
- Reduced-motion: every new animation added under B3/B7/C1 must sit behind the existing `prefers-reduced-motion` gates in `index.css`.
- Keyboard-only pass over changed surfaces (focus rings are already promised in Settings copy — keep the promise).
- Full suite: `npm run typecheck | test | e2e` green before/after each group.

## E. What this audit did *not* find

No dark-theme regressions (§4a hold), no broken layouts at 1459×812, no color-token violations spotted in rendered UI, chord strip / falling notes / keyboard alignment all correct in live play, and the copy voice is consistently strong — the calm "Not quite. You played D3." and the zero-guilt wrap are exactly the product's personality. The gap is composition and celebratory energy, not correctness or identity.
