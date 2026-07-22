# Piano Learning App — AFK Mode Design

*An off-keyboard practice mode of theory and ear-training mini-games, designed so it keeps your journey moving without ever letting your knowledge outrun your hands. Companion to the Curriculum, Gamification, and Song Library docs.*

Prepared July 2026. (Working name: **"Woodshed Mode"** — musician slang for focused practice; alternatives: "Bench Mode," "Practice Anywhere.")

---

## 1. The core problem this mode has to solve

You want to make progress on no-piano days, but you named the exact trap to avoid: a mode where you get *great at the mini-games* while your *actual playing lags behind*. If AFK progress runs on its own track, the app starts lying to you about how good a pianist you are.

The research points to the resolution. Ear training transfers to real performance more directly than abstract theory does (aural-skills ability predicts performance-related skills like error detection; pure theory study is a weaker predictor), and the strongest approach integrates theory + ear + doing rather than treating them separately. So AFK mode should:

- lean on **ear training** (the part that genuinely transfers to playing),
- keep theory **tied to what you're currently playing**, and
- be structurally **capped by your playing level**, so it can *consolidate and preview* but never *advance the journey ahead of your hands*.

That last point is the whole design, and it's implemented by the "two-lock" model below.

---

## 2. The two-lock skill model (the coupling mechanism)

Every skill in the tree already has a difficulty tier. AFK mode adds a second dimension: each skill now has **two locks that both must open before it counts as mastered.**

- 🧠 **Head lock** — *Do you know it and hear it?* Opened by AFK mini-games (recognize the chord by ear, spell it, name the interval, identify the progression).
- 🖐 **Hands lock** — *Can you play it, in time?* Opened only at the keyboard, via the scoring engine (at-tempo, un-assisted mastery star).

A skill only goes **gold** when *both* locks are open. This single rule does all the heavy lifting:

- **AFK feels like real progress** — on a no-piano day you can open the Head lock on the skills you're working on, which is genuine, visible forward motion (a half-filled skill node fills further).
- **AFK can't fake mastery** — a skill with only the Head lock open shows as "know it, can't play it yet." It's explicitly incomplete. You cannot gold a skill, unlock its dependent songs, or raise your *playing tier* from the couch.
- **The two halves reinforce each other** — because ear/theory knowledge transfers, opening the Head lock first means that when you return to the keys the Hands lock is *easier and faster* to open. AFK literally pre-loads your playing. That's the "keeping up with my journey" feeling, made real rather than illusory.

Think of it as: **playing sets the ceiling; AFK fills the room up to that ceiling.**

---

## 3. How AFK difficulty stays locked to playing skill

AFK difficulty is not an independent dial — it is a **function of your current playing tier.**

- **The question pool = what you've been taught.** The notes, intervals, chords, scales, keys, and progressions that can appear in mini-games are exactly the set the curriculum has introduced by your current playing tier. Haven't started dominant 7ths at the keys yet? They don't appear in chord-ID. Working on gospel 2-5-1s? Those show up. As your *playing* tier rises, the AFK pool auto-expands to match. You can never be quizzed on material your hands haven't met.
- **The one exception — the Preview window (+1 tier).** AFK may reach *one tier above* your current playing level, clearly labeled **"Scouting."** You can learn to *recognize* what's coming next (hear the diminished passing chord, name the turnaround) so it's familiar when you first play it. But Scouting items can't be gold-locked and don't count toward tier advancement — they just prime the pump. This is deliberate: it's the safe, motivating way to "get ahead" without actually getting ahead.
- **Result:** there is no reachable state where you're far better at the mini-games than at playing. The gap is capped at that single preview tier, and because ear training transfers, even that gap is productive rather than hollow.

---

## 4. The mini-game catalog

Grouped by the skill family they serve. All scale in difficulty with playing tier per Section 3. Ear-based games are weighted most heavily because they transfer best.

**Ear training (highest transfer value):**

- **Chord-by-ear** — hear a chord, identify quality (major / minor / dom7 / dim / extended). Genre-flavored as you advance (gospel extensions, blues dom7s).
- **"What changed?"** — hear a progression, spot the passing chord or the substitution.
- **Interval ear ID** — hear two notes, name the interval. The foundation the curriculum's theory track starts with.
- **Progression / Nashville-number by ear** — hear a I-IV-V or 2-5-1 and chart it by number (directly reinforces the country + gospel harmony skills).
- **Melodic dictation lite** — hear a short lick, tap back its shape/notes.

**Music theory (tied to current material):**

- **Note ID** — name notes on the staff and on a pictured keyboard (Geography family).
- **Build-a-chord** — drag notes to spell a requested chord/inversion (reinforces chord construction; the "why" behind what you're playing).
- **Scale & key-signature ID** — identify scales and key signatures, powered by the circle of fifths.
- **Interval spelling** — construct/name intervals visually.

**Rhythm (uniquely well-suited to AFK — no pitch needed):**

- **Tap-the-rhythm** — tap a notated rhythm on screen against the metronome. This scores *timing* just like the keyboard engine does, so groove practice genuinely continues on no-piano days.
- **Swing/straight feel discrimination** — hear a groove, identify the feel (trains the shuffle/swing ear that all three genres need).
- **Count-the-beats** — subdivision drills.

**Genre-recognition (fun, identity-building):**

- **"Name that turnaround / lick / voicing"** — hear a signature blues turnaround, gospel walk-up, or country money-lick and identify it. Connects theory to the styles you actually want to play.

---

## 5. Reward and streak integration

AFK mode plugs into the existing gamification systems, with the same honesty guardrails:

- **Keeps your streak alive.** This is the biggest practical win: a no-piano day no longer breaks your streak or your habit, as long as you do an AFK session. Given how central streaks and habit-consistency are to daily return, this alone justifies the feature.
- **Earns XP into the "Head" track, plus Riffs.** AFK play pays XP toward the knowledge/ear dimension and earns currency for cosmetics — so it feels rewarding. But consistent with the gamification firewall: **AFK XP cannot raise your Player Level or playing tier past what your hands support.** It fills Head locks and the theory/ear mastery track; the Hands track (and therefore overall tier and song unlocks) still requires the keyboard.
- **Feeds spaced review.** Theory and ear items enter the same spaced-repetition queue as playing skills, so AFK sessions are a natural home for resurfacing decaying knowledge items — and the freshness XP multiplier still applies.
- **Variable-reward layer applies.** Surprise bonuses can trigger on strong AFK performance, same ethical rules (reward good performance, never mere participation).

---

## 6. Where AFK fits in the daily loop

Two roles:

1. **Full alternative session (no-piano days).** A 15–25 min interleaved set of mini-games drawn from your current skills + spaced review + one Scouting preview item. Mirrors the keyboard session's structure so the rhythm of your practice never breaks.
2. **Micro-sessions (anytime).** 60–90 second bursts for a queue, a commute, a break. Low friction, phone-first. These are ideal for the theory-quiz component that the normal keyboard sessions already pull from — same engine, same content.

When you return to the keyboard, the app highlights: *"You opened the Head lock on the shuffle turnaround while you were away — let's open the Hands lock now."* This explicitly cashes in the AFK work as a head start, closing the loop and reinforcing that the time away counted.

---

## 7. What the user sees (feeling of keeping up)

The skill tree and roadmap render both locks per node, so progress is legible at a glance:

- Node with 🧠 filled, 🖐 empty → *"You know it — play it to master it."*
- Node with both filled → gold.
- A **"Ready to play" queue** builds up while you're away: skills whose Head lock you've opened, waiting for hands. Returning to the piano, you have a satisfying list of skills primed to finish — momentum you *built* off the bench.
- A separate small **"Knowledge" stat** (theory/ear accuracy) trends upward from AFK play, so you see that dimension improving without it being confused with playing ability.

The emotional design goal: away from the piano you're not treading water, you're **scouting ahead and loading the chamber** — and the app shows you the pile of primed skills waiting for your hands.

---

## 8. Guardrails recap (why this can't be gamed)

1. **Two locks** — playing is always required to master a skill, unlock songs, or raise tier.
2. **Pool capped by playing tier** (+1 preview only) — you can't be tested on what your hands haven't met.
3. **AFK XP feeds the Head track, not Player Level/tier** — no leveling past your hands.
4. **Ear-weighted content** — the material that transfers best to real playing gets the most emphasis, so AFK time makes you a better *player*, not just a better quiz-taker.
5. **Preview is labeled and un-masterable** — the only "getting ahead" is explicitly priming, not progress.

---

## 9. Open questions for the build spec

1. **Audio for ear training** — needs a reliable sampled piano (and organ/Rhodes for genre flavor) in the browser via Web Audio; confirm the sound-pack assets cover this.
2. **Rhythm-tap scoring** — reuse the keyboard timing engine (tap onset vs. metronome grid); confirm touch/keyboard-space input latency is calibrated like MIDI.
3. **Preview scope** — is +1 tier the right Scouting window, or should some pure-ear games reach +2? Recommend keeping +1 for v1.
4. **Mobile-first framing** — AFK is the most phone-appropriate part of the app; decide whether v1 web build is responsive enough or whether AFK gets special mobile treatment.
5. **Naming** — "Woodshed," "Bench Mode," or plain "Theory & Ear"? Your call.

---

## Sources

- [The Best Ear Training Apps for Your Studio (TopMusic)](https://topmusic.co/the-best-ear-training-apps-for-your-studio/)
- [10 Great Music Theory and Ear Training Apps 2026 (Musician Wave)](https://www.musicianwave.com/music-theory-ear-training-apps/)
- [Perfect Ear: Music & Rhythm (Google Play)](https://play.google.com/store/apps/details?id=com.evilduck.musiciankit&hl=en_US)
- [Ear Training Fundamentals (Piano-ology)](https://piano-ology.com/how-music-works/ear-training-fundamentals/)
- [Piano history, aural skills, and working memory predict melodic dictation performance (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12341474/)
- [Does music training enhance auditory and linguistic processing? Meta-analysis (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0149763422002664)
- [EarMaster — Ear Training chapter](https://www.earmaster.com/music-theory-online/ch06/chapter-6-1.html)
