# Piano Learning App — Curriculum & Learning-Design Plan

*A research-backed foundation for a gamified, beginner-first app to master blues, gospel, and country piano. This document maps the pedagogy and curriculum. A technical build spec comes later.*

Prepared July 2026.

---

## 1. What this document is (and isn't)

This is the **learning design** — the "what to teach, in what order, and why." It translates your stated philosophies into a concrete, research-grounded curriculum that a build spec can later be written against.

Your original instincts turned out to be well-supported by the research. Four of your ideas map almost directly onto established learning science:

- **"Learn skills one at a time"** → chunking + deliberate practice on isolated components.
- **"Practice through songs"** → song-based motivation layered over targeted exercises (the modern hybrid method).
- **"Tiered difficulty songs"** → a mastery-based progression with spaced review.
- **"Always have one song ~10 tiers above my level"** → a *stretch piece* operating in the zone of proximal development; a "desirable difficulty" that accelerates transfer.

The one adjustment the research suggests: your daily practice should be **interleaved** (rotating between skills/songs within a session), not blocked (drilling one thing to fluency before moving on). This feels worse in the moment but produces more than double the long-term retention. The app should engineer this for you so it doesn't require willpower. More on this in Section 2.

---

## 2. The learning principles the app should be built on

These are the load-bearing ideas. Every game mechanic and curriculum decision below traces back to one of them.

### 2.1 Adults have a real advantage — lean into theory

Adults learn piano differently from children and it's not all downside. Adults understand music theory faster because they think abstractly and can grasp *why* a chord or scale works, so every new concept connects to a framework rather than being memorized in isolation. The app should exploit this: pair every physical skill with the "why" (the theory behind it), rather than hiding theory until later. This is the opposite of how children's methods work, and it's a genuine edge.

### 2.2 Deliberate practice + chunking ("one skill at a time")

Effective practice is systematic, focused work on a *specific* aspect of playing — deliberately isolating one problem, working in short focused blocks, slowing material to ~50% tempo, and only increasing speed after control is achieved. Pieces get broken into tiny chunks (as little as two bars). Your "one skill at a time" instinct is exactly this. The app's core unit should be a **micro-skill** small enough to master in a focused block.

### 2.3 Interleaving beats blocking (the one thing to change)

This is the most important — and least intuitive — finding. **Interleaved** practice (rapidly rotating between tasks) produces markedly better retention and transfer than **blocked** practice (finishing one task before the next). Studies put interleaving at more than twice as effective for retention. The catch: it *feels* less effective because it's harder in the moment and you don't get that satisfying sense of fluency. That false sense of fluency is exactly why people default to blocking.

**Design implication:** the app should schedule *across* days with spaced repetition but *within* a session it should interleave — mixing a bit of the current skill, a review of an older one, a snippet of the stretch song, and a theory drill. The user shouldn't have to choose this; the session builder does it automatically.

### 2.4 Spaced repetition (schedule across days)

Skills and concepts should be reintroduced just before they'd be forgotten. This is what turns short-term "I can do it today" into long-term retention, and it's the backbone of how Duolingo sequences review. Every mastered micro-skill, chord, and theory fact enters a review queue with expanding intervals. The app tracks a "freshness" decay per item and resurfaces it in daily sessions.

### 2.5 Songs + exercises, not songs *or* exercises

The consensus across every major method (Alfred's, Piano Adventures, Hal Leonard, chord-based methods) is a **hybrid**: motivating, recognizable songs keep you engaged while targeted exercises build the underlying technique. Songs are the reward and the context; exercises are the reps. The app should never present a naked exercise without showing the song it unlocks, and never present a song without extracting the drillable skills inside it.

### 2.6 The stretch song (your "10 tiers up" idea)

A piece well above your level — a *stretch piece* — pulls skills forward. The point isn't to perform it; it's that reaching for complexity beyond your comfort zone develops capabilities faster and then transfers down to make your on-level songs easier. This is the zone of proximal development plus "desirable difficulty." Two guardrails from the research so it motivates rather than crushes:

1. **Decompose it.** The stretch song is only motivating if it's broken into chunks you *can* attempt (one riff, one four-bar phrase, one chord voicing). The app should auto-extract "learnable fragments" from the stretch song and feed them into interleaved practice.
2. **No mastery pressure.** Progress on the stretch song is measured in fragments explored and skills borrowed, never in "can you play the whole thing." This keeps it a source of curiosity, not failure.

---

## 3. The skill taxonomy — what "one skill at a time" means concretely

For the app to teach one skill at a time, "skill" needs a precise definition. Proposed: the atomic unit is a **micro-skill** — masterable in one focused session, testable, and reusable across songs. Micro-skills roll up into **skill families**, which roll up into the **skill tree**.

Six skill families span all three genres:

1. **Keyboard geography & hand mechanics** — note names, finger numbers, posture, five-finger positions, hand independence, evenness.
2. **Rhythm & groove** — steady pulse, subdivisions, the *shuffle/swing feel* (essential for blues), syncopation, playing to a metronome/backing track.
3. **Chords & voicings** — triads, inversions, dominant 7ths, extensions (9ths, 13ths), rootless/spread voicings.
4. **Left-hand patterns** — root-fifth, shuffle bass, walking bass, stride, gospel bass movement, country root-chord alternation.
5. **Right-hand vocabulary** — scales (major, minor, pentatonic, blues), licks/riffs, fills, ornaments, melody-over-chords.
6. **Harmony & progressions** — the 12-bar blues, 2-5-1, gospel passing/substitution chords, the Nashville number system, turnarounds.

Each micro-skill in the app carries: a genre tag (or "foundation"), a tier/difficulty, prerequisites, the theory concept it embodies, and the song fragments that use it.

---

## 4. The shared foundation (weeks 1–6, genre-agnostic)

Blues, gospel, and country share more than they differ, so the app front-loads a common trunk before branching. Everything here is a prerequisite for the genre paths.

**Physical & reading foundation:** keyboard geography and note names; correct posture and finger numbering; five-finger positions in C, G, F; simple hands-together coordination; reading enough notation/chord symbols to follow the app's prompts (chord-symbol literacy matters more than sight-reading for these genres).

**Rhythm foundation:** steady pulse with a metronome; quarter/eighth/sixteenth subdivisions; and critically, the **swing/shuffle feel**, since it underpins blues and much of gospel and country.

**Chord foundation:** major and minor triads and how they're built (1-3-5 and 1-♭3-5); all inversions; the dominant 7th chord (the single most important sound for blues); reading chord symbols.

**Harmonic foundation:** the I–IV–V relationship; the **Nashville number system** (thinking in scale degrees 1–7 rather than letter names) — this is the country backbone but pays off everywhere and lets you transpose instantly; and the **12-bar blues** form, which is the on-ramp to improvisation.

Completing the trunk should unlock all three genre branches, which the user can pursue in parallel (interleaved) rather than strictly sequentially.

---

## 5. Genre paths

Each genre is a sequence of skill families deepening over tiers. Below is the core spine of each — the "if you learn nothing else" path — from beginner outward.

### 5.1 Blues (recommended first branch)

Blues is the ideal first genre: it's built on a small, fixed toolkit and you sound authentic almost immediately, which is powerfully motivating.

The core toolkit is small: **dominant 7th chords, the blues scale, and a steady left-hand groove.** The progression:

1. Play the 12-bar form with plain major triads (I–IV–V) in C — internalize the *form* first.
2. Swap triads for **dominant 7th chords** for the real blues color.
3. Learn the **left-hand shuffle pattern** (practiced hands-separately with a metronome until it swings) in C, F, and G.
4. Combine hands: shuffle bass + right-hand chords over the full 12 bars.
5. Add **right-hand riffs/licks** from the blues scale.
6. Add a **turnaround** (the signature ending lick that resets the form).
7. Improvise over a backing track.

Later tiers: walking bass lines, more sophisticated turnarounds, call-and-response phrasing, New Orleans / boogie-woogie styles, playing in more keys.

### 5.2 Gospel

Gospel is the most harmonically rich of the three and best approached *after* the blues toolkit gives you comfort with 7th chords. Its defining feature is **passing chords** — non-essential chords that briefly connect the main chords and always resolve to a diatonic chord.

Core spine:

1. Solidify the **2–5–1 progression** (the harmonic engine of gospel and jazz).
2. Chord **extensions** — 9ths and 13ths — for the fuller gospel sound.
3. **Passing chord techniques:** the "2-5 trick" (insert the 2 and 5 of your target chord), **diminished passing chords** (each resolves up a half-step to its target), and chromatic walk-ups (e.g., II to IV, II to V).
4. **Pedal-point** textures (a held bass note under moving chords).
5. Voicing and re-harmonization — the same melody dressed in richer chords.

Later tiers: contemporary gospel/R&B voicings, rootless voicings, more advanced substitution and reharmonization.

### 5.3 Country

Country rewards the **Nashville number system** more than any other genre and has the most transparent left hand, making it very approachable. Chords quality is fixed by scale degree (1, 4, 5 major; 2, 3, 6 minor; 7 diminished), so "1–4–5" is the major-chord country backbone in any key.

Core spine:

1. **Nashville number thinking** — chart and play 1–4–5 (and 1–5–6–4) progressions in multiple keys.
2. Left-hand **root-and-chord** patterns and bass note choices, including **inversions** where the bass isn't the root (e.g., C/E, C/G) for smooth voice leading.
3. Right-hand licks built from **major chord shapes** (root position and first inversion) and the **pentatonic scale** — the source of most country riffs.
4. Fills and "money licks" between vocal phrases.
5. Playing along in a band context (comping vs. soloing).

Later tiers: honky-tonk and boogie left hands, faster pentatonic runs, crossover with blues vocabulary (they share a lot).

### 5.4 How the branches reinforce each other

These genres overlap heavily, which the app should make explicit (a skill learned in one lights up its cousins elsewhere): dominant 7ths and the shuffle feel bridge blues↔country; the blues/pentatonic scales are shared right-hand vocabulary across all three; 7th chords and extensions bridge blues↔gospel; and the Nashville number system organizes harmony in every genre. Interleaving across genres therefore isn't a distraction — it's transfer practice.

---

## 6. The music theory track

Theory runs *alongside* the physical skills, not before them, and every theory item is tied to something the user is playing (per Section 2.1). Research gives a clear beginner ordering:

1. **Intervals & steps** — distance between notes; melodies as sequences of intervals.
2. **The chromatic scale** — how the 12 notes are organized.
3. **The major scale** — the foundation everything else derives from.
4. **The circle of fifths & key signatures** — how keys relate; the fastest shortcut to knowing which chords sound good together and to transposing.
5. **Chord construction** — stacking intervals from a root (major triad 1-3-5, minor 1-♭3-5, then 7ths and extensions).

Genre-specific theory layers on top: the 12-bar form and blues scale (blues), 2-5-1s / passing chords / substitutions (gospel), and the Nashville number system and diatonic chord qualities (country). Theory is delivered as short quizzes and drills interleaved into daily sessions rather than as standalone lessons.

---

## 7. The song tier system

Songs are the spine of engagement and the delivery vehicle for skills. Proposed structure:

- **~30 tiers** from absolute beginner to advanced. Each tier corresponds to a cluster of prerequisite micro-skills.
- Every song is tagged with: genre, tier, and the specific micro-skills required to play it. This lets the app both recommend the next song *and* reverse-map a song into its practice drills.
- The user has, at any time: **(a)** an on-level song they're actively learning (at or just above current tier — the zone where mastery is achievable), and **(b)** the **stretch song**, roughly 10 tiers up, that they *explore* rather than master.

**How the stretch song works mechanically:** the app extracts learnable fragments from it (a two-bar riff, one chord voicing, one groove) and injects those fragments into interleaved daily practice. Progress is tracked as fragments explored and skills "borrowed down" into on-level songs — never as percent-of-song-completed. When the user's tier rises enough that the old stretch song is now merely on-level, a new stretch song (another ~10 tiers up) is selected.

A practical starting song library should be curated per genre and tier (public-domain and simplified arrangements for early tiers). Cataloguing that library is a follow-up task once this plan is approved.

---

## 8. Gamification design (the Duolingo layer)

The goal is Duolingo's stickiness applied to motor-skill learning. The mechanics that do the heavy lifting, and how each maps to piano:

**XP / immediate reward.** Award XP the instant a rep is completed, before the screen closes — the reward must be tightly coupled to the behavior. In piano terms: XP for each cleanly played attempt, hitting a tempo target, nailing a chord change, or answering a theory quiz.

**Streaks + loss aversion.** A daily streak with the pain-of-losing driving daily return, softened by a **streak freeze** so a single missed day doesn't reset everything (this prevents the discouragement spiral). A realistic daily target — 20–30 minutes — is what the research says produces steady progress.

**A path, not a maze.** Duolingo moved from a sprawling branching tree to a mostly **linear guided path** with review baked in. The app should present one clear "what's next," even though a richer skill graph runs underneath. This reduces decision paralysis.

**Mastery + spaced review built into the path.** Skills don't just get checked off — they decay and resurface for review at expanding intervals (Section 2.4). Visible "freshness" or crown/mastery levels per skill give a sense of durable progress.

**Challenges & quizzes.** Timed chord-recognition, "play this progression by ear," theory multiple-choice, and song "boss levels" that combine several skills. These are also the app's assessment mechanism for deciding when a tier is truly mastered.

**Achievements & (optional) social.** Badges for milestones. Leaderboards are optional for a personal prototype but are a proven retention lever if you later commercialize.

**One caution from the research:** gamification can drift into optimizing the game instead of the skill (grinding XP on easy content). Guard against it by making XP scale with *difficulty and freshness* — reviewing a decaying hard skill is worth more than replaying an easy mastered one — so the incentives point at real learning.

---

## 9. The daily practice loop

A single session (target 20–30 min) should be **interleaved** and assembled automatically:

1. **Warm-up / streak claim** — a short familiar win to start (technique or a mastered lick).
2. **New micro-skill** — one focused chunk, introduced with its theory "why," practiced slow-to-fast.
3. **Spaced review** — 1–3 previously learned items the algorithm says are decaying.
4. **Stretch-song fragment** — one small piece of the aspirational song.
5. **Theory quiz** — a 60–90 second drill tied to today's material.
6. **Song time** — apply the day's skills inside the on-level song (the reward/context).
7. **Wrap** — XP tally, streak update, preview of tomorrow.

The mix rotates so no two consecutive segments hammer the same skill — this is the interleaving from Section 2.3, engineered so the user never has to impose it themselves.

---

## 10. Proposed progression map (the skill tree)

```
FOUNDATION TRUNK (wks 1–6)
  Keyboard geography · Posture/fingering · Steady pulse · Swing/shuffle feel
  Major/minor triads + inversions · Dominant 7th · Chord-symbol reading
  I–IV–V · Nashville numbers · 12-bar blues form
        │
        ├──────────────┬──────────────────┐
     BLUES           COUNTRY             GOSPEL
   dom7 + blues     Nashville 1-4-5     2-5-1 core
   scale + shuffle  root/chord LH       extensions 9/13
   bass             pentatonic licks    passing chords
   RH riffs         inversions in bass  (2-5 trick, dim,
   turnarounds      fills/money licks    walk-ups)
   walking bass     honky-tonk LH       pedal point
   improvisation    band comping        reharmonization
        │                │                  │
        └────────── shared vocabulary ──────┘
        (pentatonic/blues scales · 7th chords · swing feel · number system)

RUNNING ALONGSIDE EVERYTHING:
  Theory track (intervals → major scale → circle of 5ths → chord construction)
  Spaced review queue (all mastered items)
  ONE stretch song (~10 tiers up) feeding fragments into daily interleaving
```

---

## 11. Open questions to settle before writing the build spec

A few decisions will shape the spec and are worth your input when we get there:

1. **Genre order** — recommend starting everyone on blues (fastest "sounds real" payoff), then branching to country and gospel in parallel. Agree, or lead with a different genre?
2. **Song library sourcing** — early tiers need simplified/public-domain arrangements to avoid licensing issues. Curating this catalog is a distinct next task.
3. **Assessment strictness** — how the app decides a skill is "mastered" (tempo target hit? N clean reps? note-accuracy threshold from MIDI/mic input?). This ties directly to your MIDI + microphone input choice.
4. **Notation vs. chord-symbol emphasis** — these genres lean on chord literacy and ear more than classical sight-reading; recommend prioritizing chord symbols and pattern recognition over staff-reading fluency early on.
5. **Session length personalization** — fixed 20–30 min, or adaptive to available time?

---

## Sources

Adult learning & practice science:
- [Learn Piano as an Adult — A Realistic Beginner's Guide (piano.org)](https://piano.org/theory/learn-piano-as-an-adult/)
- [Piano Practice for Adult Learners: How to Structure Every Session (Corinne Plays Piano)](https://corinneplayspiano.com/the-complete-guide-to-piano-practice-for-adult-learners/)
- [The Adult Learner's Roadmap to Piano Excellence (The Cross-Eyed Pianist)](https://crosseyedpianist.com/2024/08/26/the-adult-learners-roadmap-to-piano-excellence-developing-effective-practice-strategies/)
- [What Does It Take to Play the Piano? Cognito-Motor Functions in Older Adults (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11048694/)
- [Spaced repetition for musicians (Piano Practice Assistant)](http://pianopracticeassistant.com/spaced-repetition/)

Interleaved vs. blocked practice:
- [Optimizing Music Learning: Blocked and Interleaved Practice Schedules (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4989027/)
- [Interleaved practice benefits implicit sequence learning and transfer (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8476370/)
- [Perfect Practice Part 3: Interleaved Practice (Ashley Wilson Piano Studio)](https://www.ashleywilsonpiano.com/blog/2022/1/10/perfect-practice-part-3-interleaved-practice)

Songs vs. exercises / methods:
- [Which is more important: exercises or perfecting songs? (Quora)](https://www.quora.com/Which-is-more-important-in-learning-the-piano-exercises-or-perfecting-songs)
- [Best Piano Methods for Beginners (Cixi Music)](https://www.ciximusic.com/piano-methods.html)
- [Piano Learning Methods comparison (flowkey)](https://www.flowkey.com/en/piano-guide/learning-methods)

Blues piano:
- [How to Play a Blues Shuffle for Beginner Piano (Piano With Jonny)](https://pianowithjonny.com/piano-lessons/how-to-play-a-blues-shuffle-for-beginner-piano/)
- [Blues Piano Masterclass: 5 Levels from Beginner to Pro (Piano With Jonny)](https://pianowithjonny.com/piano-lessons/blues-piano-masterclass-5-levels-from-beginner-to-pro/)
- [12 Bar Blues Piano Tutorial (PianoGroove)](https://www.pianogroove.com/blues-piano-lessons/basic-12-bar-blues-tutorial/)
- [Blues Piano for Beginners (FreeJazzLessons)](https://www.freejazzlessons.com/learn-blues-piano/)

Gospel piano:
- [Play Gospel Piano — The 6-Step Beginner Guide (Piano With Jonny)](https://pianowithjonny.com/piano-lessons/play-gospel-piano-the-6-step-beginner-guide/)
- [Passing Chords: 5 Levels Beginner to Pro (Piano With Jonny)](https://pianowithjonny.com/piano-lessons/passing-chords-5-levels-beginner-to-pro/)
- [Gospel Passing Chords & Substitutions (PianoGroove)](https://www.pianogroove.com/blues-piano-lessons/gospel-passing-chords-substitutions/)
- [Gospel Chord Progressions & Transitions (Pianote)](https://www.pianote.com/blog/gospel-progressions/)

Country piano & Nashville number system:
- [The Nashville Number System for Piano: A Beginner's Guide (Pianote)](https://www.pianote.com/blog/the-number-system/)
- [Nashville Number System — Chart Chords as 1–4–5 (piano.org)](https://piano.org/theory/nashville-number-system/)
- [Learn a Famous Country Piano Lick (Piano Lessons Online)](https://www.pianolessonsonline.com/country-piano-lesson-lick/)

Music theory sequencing:
- [Music Theory Basics: What to Learn First (Pianote)](https://www.pianote.com/blog/piano-music-theory-basics/)
- [The Circle of Fifths: A Complete Guide (Hello Music Theory)](https://hellomusictheory.com/learn/circle-of-fifths/)

Gamification:
- [Duolingo Gamification Strategy: A Full Case Study (Trophy)](https://trophy.so/blog/duolingo-gamification-case-study)
- [The Psychology of Gamification: Duolingo Deep Dive (Ludaxis)](https://www.ludaxis.io/blog/gamification-in-apps-duolingo-case-study-2026)
- [Why Duolingo's Gamification Works — And When It Doesn't (DEV)](https://dev.to/pocket_linguist/why-duolingos-gamification-works-and-when-it-doesnt-1d4)

Stretch pieces / desirable difficulty:
- [What are the benefits of a "stretch" piece? (Piano World Forums)](https://forum.pianoworld.com/ubbthreads.php/topics/2476730/What_are_the_benefits_of_a_&qu.html)
- [Stretch and Challenge: A Teacher's Guide (Structural Learning)](https://www.structural-learning.com/post/stretch-and-challenge-a-teachers-guide)
