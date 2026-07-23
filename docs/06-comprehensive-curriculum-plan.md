# Piano Pro — Comprehensive Curriculum Plan

*Implementation-ready syllabus for a complete beginner learning blues, gospel, and country piano.*

Prepared July 2026. This document extends `docs/01-curriculum-and-learning-design.md`; it does not replace the existing gamification, song-library, AFK, or build-spec documents.

## 1. Curriculum promise

Piano Pro should take a user from “I have never played” to a useful, independent musician who can:

- keep a steady pulse and play with a metronome;
- locate notes, use comfortable fingering, and move around the keyboard without staring at it constantly;
- read basic treble and bass notation and chord symbols;
- hear and identify basic intervals, chord qualities, grooves, and progressions;
- build and use triads, seventh chords, inversions, and practical genre voicings;
- play a small repertoire from memory and from lead sheets;
- accompany a singer or backing track in blues, gospel, and country styles;
- transpose simple progressions using scale-degree / Nashville-number thinking;
- improvise short, musical phrases with call-and-response;
- diagnose a mistake and design a focused practice loop without the app.

“Fluency” here means functional musicianship, not conservatory virtuosity. The curriculum deliberately prioritizes time, listening, pattern recognition, chord literacy, groove, and usable repertoire while steadily building conventional reading and technique.

## 2. What the repository already gets right

The existing direction should be retained:

1. **Songs and exercises are interleaved.** A song supplies meaning and motivation; a micro-skill supplies the repetitions needed to make the song playable.
2. **The shared trunk comes before genre specialization.** Blues is the recommended first branch because it produces an authentic sound with a small vocabulary, but country and gospel should become available early enough for autonomy.
3. **The two-lock model is honest.** Head progress measures knowledge/ear understanding; Hands progress requires demonstrated keyboard performance. Gold requires both. Song unlocks and playing tier continue to depend on Hands only, as already specified by the guardrails.
4. **Timing is a first-class outcome.** Correct pitches without pulse are not fluent piano playing, especially for the target genres.
5. **Spaced review and interleaving are product behavior, not user advice.** The session builder should construct the practice mix automatically.
6. **A stretch song is exploratory.** It should provide fragments, sounds, and long-term identity—not a second source of failure or a false mastery signal.
7. **Content is data.** Curriculum sequencing should be authorable in JSON and validated by the ContentService rather than embedded in React components.

Two refinements are required for implementation:

- The current 30 tiers are a difficulty scale, not yet a lesson syllabus. This document defines the lesson/module structure inside each tier.
- `theoryConceptId` alone is too small to express the curriculum. Future content should also attach exercise templates, assessment criteria, technique cues, ear targets, and song-fragment IDs to each skill.

The curriculum must also be **spiral rather than disposable**. Completing a module means the learner is ready to meet harder applications of its skills, not that the skills can be removed from practice. Every important item should have a future review path, and every failure should create useful resurfacing evidence.

## 3. Learning design rules

### 3.1 The unit of learning: a skill card

Every teachable item is a **skill card**. A card is small enough to practice in 2–8 minutes and specific enough to assess.

Examples:

- “Find every C on the keyboard in under 3 seconds.”
- “Play C–F–G–C as root-position triads with a steady quarter-note pulse.”
- “Hear major versus minor triads with 8/10 accuracy.”
- “Play a C shuffle bass pattern for four bars without stopping.”
- “Identify whether a timing error is rushing or dragging.”

A card has five stages:

1. **Notice** — see/hear the idea and its musical purpose.
2. **Copy** — imitate a demonstration or constrained pattern.
3. **Vary** — perform it in a changed key, rhythm, order, or context.
4. **Apply** — use it in a song or fragment.
5. **Prove** — pass an unassisted, at-tempo assessment after a delay.

The app may award practice progress at stages 1–4, but only stage 5 opens the Hands mastery gate.

### 3.2 Every module has the same Duolingo-like anatomy

A module is a short path of 6–10 lessons around one musical outcome. Do not make modules “watch a lesson” or “play a song” only. Mix exercise types so the user retrieves the idea in different ways.

Each module contains:

| Lesson | Purpose | Typical exercise types |
|---|---|---|
| 1. Discover | Establish sound, shape, and why | Listen, keyboard map, teacher demonstration, one-sentence theory |
| 2. Copy | Build the first physical representation | Echo play, one-hand drill, guided notes, slow tempo |
| 3. Recognize | Build visual and aural retrieval | Note ID, chord/interval ear ID, choose-the-groove, rhythm count |
| 4. Vary | Prevent memorizing one screen | Key change, inversion, order change, missing-note repair, tempo change |
| 5. Combine | Coordinate two or more demands | Hands together, melody + bass, chord changes, rhythm + pitch |
| 6. Apply | Make the skill musical | Song phrase, riff, turnaround, accompaniment, backing track |
| 7. Checkpoint | Verify transfer | Blind retry, no falling notes, reduced hints, fresh fragment |
| 8. Review / unlock | Close the loop | Spaced review, mastery report, next-song preview |

Not every module needs all eight lessons on the first visit. The SessionBuilder can distribute lessons over multiple days, but the authored order and exercise diversity must remain explicit.

### 3.3 Practice modes

Piano Pro should distinguish these modes in content and analytics:

- **Guided** — visual aids, note names, slowed tempo, one-hand isolation.
- **Supported** — metronome and chord symbols; limited visual assistance.
- **Independent** — no falling notes or note names; chart/chord symbols allowed.
- **Performance** — at target tempo, no assists, full score and mastery eligibility.
- **Scouting** — a curiosity fragment above tier; no mastery or tier advancement.
- **Woodshed** — AFK theory, ear, and rhythm work constrained by the two-lock model.

An assist must be visible in the Attempt and must prevent a mastery star when the existing guardrail says it should.

### 3.4 The first attempt should be easy; the assessment should not be

New material begins around 50–65% of target tempo and with a reduced arrangement. The app should remove support one dimension at a time:

1. slower tempo → target tempo;
2. one hand → hands together;
3. visual guide → chord symbols / notation;
4. short loop → full phrase;
5. known chart → fresh fragment;
6. assisted attempt → unassisted performance.

This makes failure informative rather than punitive. A miss should produce one next action (“left hand is late on beat 3”) instead of a pile of generic advice.

### 3.5 Spiral curriculum and durable retrieval

Piano Pro should use a **spiral curriculum**: old material returns at increasing levels of variation and independence as new skills are introduced.

The app should resurface:

- a skill the user missed or only passed with assistance;
- a song section with repeated weak bars or timing drift;
- a scale, chord, interval, groove, or time signature that has become due for review;
- a prerequisite that a new skill depends on;
- a previously mastered item in a new key, register, tempo, feel, or musical context;
- an item whose Head knowledge is strong but whose Hands evidence is weak, and vice versa.

The user should experience resurfacing as meaningful musical reuse rather than punishment. For example:

- Tier 2 C–F–G roots return in Tier 6 as I–IV–V blues form;
- Tier 5 C major scale degrees return in Tier 13 as Nashville-number transposition;
- Tier 8 shuffle returns in Tier 18 as walking-bass and gospel groove work;
- a weak bar from a song returns as a two-bar fragment before the whole song is requested again;
- a missed dom7 chord returns first as chord construction, then ear identification, then a fresh chord change.

#### Review states

Every reviewable item should be in one of these states:

| State | Meaning | Next action |
|---|---|---|
| New | Not yet introduced | Teach in the recommended Path module |
| Introduced | Seen or heard, not yet reliable | Short guided retrieval |
| Practicing | Improving with support | Repeat a focused variation |
| Functional | Usable with help | Interleave into a song or related skill |
| Mastered | Passed an unassisted checkpoint | Schedule delayed retrieval and transfer |
| Due | FSRS predicts declining recall or performance | Resurface in the next suitable session |
| Struggling | Repeated misses, weak timing, or high assistance | Remediate with a smaller prerequisite |
| Retired temporarily | Stable across several contexts | Keep a low-frequency maintenance review |

“Mastered” never means “never show again.” It means “eligible for less frequent, more varied review.”

#### Review evidence

The review scheduler should use more than the final star count. Store evidence at the smallest useful level:

- skill/card ID;
- source module, song, chart, fragment, or mini-game;
- section/bar range when applicable;
- attempt result and mode;
- pitch correctness;
- timing quality and rush/drag direction;
- tempo and arrangement level;
- assists used;
- Head versus Hands contribution;
- error category;
- timestamp and session ID;
- next due date and review history.

The same concept can therefore be reviewed through different retrieval modes. A user who missed a C7 change in a song should not only replay the same C7 chart forever; the system can ask them to build C7, hear C7, identify it in a progression, play it in an inversion, and then return to the song.

#### Resurfacing rules

The future SessionBuilder should reserve part of every session for durable retrieval:

- 20–35% due review in ordinary sessions;
- one immediate remediation item after a meaningful failure;
- one older mastered item in a changed context when available;
- prerequisite review before introducing a dependent new skill;
- a short song-section review before a full-song checkpoint if the weakness is localized;
- no more than one or two consecutive attempts on the same failing item;
- a failed review should shorten or simplify the item, not merely schedule an identical retry.

Review selection should balance four signals:

`due-ness + error severity + prerequisite relevance + transfer opportunity`

Freshness-based rewards may use this queue, but rewards must not encourage farming the easiest review. A due item is valuable because it is appropriately challenging and useful, not because it can be repeated indefinitely.

#### Tier re-entry

Each later tier should deliberately re-enter prior material. Content authors should mark these relationships with `revisits`, `prerequisiteRefreshes`, and `transferTargets`.

At minimum:

| New tier band | Required return to earlier material |
|---|---|
| Tiers 3–5 | Revisit note geography, pulse, five-finger patterns, and simple songs with new positions or meters |
| Tiers 6–10 | Revisit I–IV–V, triads, roots, and time signatures inside 12-bar and shuffle contexts |
| Tiers 11–15 | Revisit scales, inversions, chord changes, and earlier songs through fills, transposition, and call-and-response |
| Tiers 16–22 | Revisit groove, form, dom7s, and pentatonic vocabulary inside walking bass, ii–V–I, and gospel applications |
| Tiers 23–30 | Revisit the full foundation through unfamiliar fragments, arrangement, improvisation, and performance conditions |

The Path should occasionally label this positively: “Bring back a foundation skill,” “Use an old chord in a new groove,” or “Your earlier shuffle is becoming walking bass.”

## 4. The five curriculum strands

The existing six skill families remain the content taxonomy. For instructional scheduling, they are grouped into five strands that appear in every tier:

1. **Technique and movement** — posture, relaxed hand shape, finger patterns, lateral movement, rotation, voicing, coordination, release, and economy of motion. The app can coach MIDI-observable timing and velocity, but it must not claim to diagnose wrist tension or posture without video/sensor evidence.
2. **Rhythm and groove** — pulse, subdivision, meter, swing/shuffle, syncopation, backbeat, fills, and playing through mistakes.
3. **Harmony and theory** — keyboard geography, intervals, scales, key relationships, chord construction, Roman numerals, Nashville numbers, form, voicing logic, and transposition.
4. **Ear and musicianship** — pitch direction, interval/chord quality, melodic memory, rhythm echo, progression recognition, error detection, and call-and-response.
5. **Repertoire and creativity** — songs, riffs, accompaniment, fills, improvisation, memory, lead-sheet reading, transposition, and performance.

The app should not present these as five school subjects. The user should experience a module as “learn a shuffle groove,” with the theory, ear, movement, and song application woven through it.

### 4.1 Scales are a recurring musical tool, not a detached exercise track

Scales should be part of the curriculum from the beginning, but they should be taught for a musical reason rather than as pages of abstract finger drills. Every scale lesson should connect four representations: shape, sound, theory, and use in a riff, fill, bass line, melody, or improvisation.

| Scale / pattern | First use | Genre connection | Curriculum role |
|---|---|---|---|
| Five-finger patterns | Tiers 1–2 | All genres | Keyboard geography, finger control, simple melodies |
| C, F, and G major pentascales | Tiers 2–4 | All genres | Position shifts, I–IV–V songs, basic reading |
| C major scale | Tiers 4–6 | All genres | Scale degrees, Nashville numbers, chord construction |
| G and F major scales | Tiers 7–10 | Country and gospel | Transposition, key signatures, accompaniment in common keys |
| Minor pentatonic | Tiers 8–12 | Blues and country | Blues vocabulary, fills, call-and-response |
| Blues scale | Tiers 10–14 | Blues, gospel, country crossover | Improvisation, blue notes, turnarounds, expressive tension |
| Major pentatonic | Tiers 11–15 | Country and gospel | Melodic fills, hymn/country phrasing, consonant improvisation |
| D and B♭ major scales | Tiers 13–18 | Country and gospel | More key fluency and black-key geography |
| Natural minor / relative minor pairs | Tiers 15–20 | Blues and gospel | Minor songs, modal color, chord/scale hearing |
| Additional major/minor scales by circle of fifths | Tiers 20–30 | All genres | Transposition, lead-sheet fluency, arranging, improvisation |

The app should not require all twelve major scales before the user can make meaningful music. It should require the next scale when it unlocks a real musical capability, then revisit the scale through spaced practice and varied applications.

### 4.2 Scale lesson anatomy

A scale module should use this sequence: locate the tonic; play the pattern slowly hands separately; hear its direction and color; say scale degrees or finger numbers; coordinate hands; vary rhythm, direction, register, or key; apply the scale to a riff or fill; then perform it evenly at target tempo without assists and use it in a fresh fragment.

### 4.3 Genre-specific scale applications

- **Blues:** minor pentatonic and blues scale for two-bar call-and-response, turnarounds, and phrase endings. Emphasize resolving blue-note tension toward stable chord tones.
- **Country:** major pentatonic for melody, fills, and “money licks,” connected to scale degrees 1, 3, 5, and 6 and Nashville numbers. Later combine major pentatonic with blues vocabulary.
- **Gospel:** major scales for chord tones, passing motion, and melodic fills; later natural minor and chromatic approaches around ii–V–I progressions.

This keeps scales tightly connected to the app’s preferred genres instead of imitating a purely classical technical syllabus.

### 4.4 Strand ladders across the 30 tiers

The tier table gives each tier a headline outcome. These ladders define what must be happening underneath that headline so a strand does not disappear for several tiers and then reappear at an unrealistic difficulty.

#### Technique and movement ladder

| Tiers | Physical capability | What the app can observe | Required application |
|---|---|---|---|
| 1–2 | Comfortable seated setup, finger numbers, relaxed five-finger shape, independent finger lifts | Correct pitches, consistent onset spacing, excessive repeated-note timing variance | One-hand melody and LH root notes without stopping |
| 3–5 | Position changes, first thumb tuck, legato/staccato contrast, basic release | Evenness across a position shift, note overlap, release timing | Pentascale pattern plus melody/accompaniment in C, F, and G |
| 6–10 | Chord shape changes, relaxed repeated chords, hands-together pulse, basic inversion movement | Chord onset alignment, missed/extra chord tones, change latency, timing drift | I–IV–V and dom7 changes through a full 12-bar form |
| 11–15 | Voice-leading between inversions, RH phrase movement, LH/RH role separation | Distance between selected voicings, change consistency, melody timing over accompaniment | Comping, fills, turnaround, and boom-chick patterns |
| 16–22 | Walking-bass movement, guide-tone control, spread voicings, controlled chromatic approaches | Bass-line continuity, chord-tone accuracy, timing under independence, velocity balance proxy | Bass plus comping, ii–V–I, gospel passing motion, transposition |
| 23–30 | Efficient repetition, faster pattern recovery, register/texture control, expressive release and pedal decisions | Stable timing at multiple tempos, recovery after misses, dynamic/velocity trends where reliable | Boogie, arrangement, improvisation, one-take performance |

The product must be careful with physical coaching. MIDI can support feedback about timing, pitch, duration, velocity, and coordination proxies; it cannot reliably determine wrist tension, posture, fingering quality, or injury risk. Those remain instructional cues and user self-checks unless a future sensor/video feature supports them.

#### Rhythm and groove ladder

| Tiers | Rhythmic capability | Ear / counting target | Required application |
|---|---|---|---|
| 1–2 | Beat, downbeat, quarter notes, simple 2/4 and 4/4 | Count 1–2–3–4; identify whether a phrase starts together | Melody with metronome and LH roots on beat 1 |
| 3–5 | Eighth notes, rests, phrase boundaries, 3/4 waltz, and time-signature reading | Identify 2/4, 3/4, and 4/4 from notation/audio; tap the beat while counting the measure | Simple accompaniment and Amazing Grace/Home on the Range |
| 6–10 | Shuffle/swing ratio, backbeat, harmonic rhythm, playing through a miss | Distinguish straight vs shuffle; maintain 12-bar count | Shuffle bass, chord comping, full blues form |
| 11–15 | Syncopation, anticipations, space, fills that land on form boundaries | Hear whether a fill supports or crowds the phrase | Country boom-chick, blues turnaround, gospel groove |
| 16–22 | Walking-bass subdivision, ii–V–I cadence timing, groove switching | Identify meter/feel and track form while texture changes | Three-style medley and transposed accompaniment |
| 23–30 | Faster subdivisions, dynamic groove, rubato within a pulse, recovery | Maintain internal pulse through errors and listen critically to rush/drag | Boogie, backing-track improvisation, performance take |

Rhythm mastery should use more than note-onset percentages. A player must also demonstrate continuity: keep the pulse, complete the form, and recover on the next beat after an error. Rhythm-tap exercises should reuse the same calibration and timing concepts as keyboard play.

#### Time-signature progression

Time signatures are a foundational literacy skill and should be taught explicitly rather than appearing only as metadata on a chart. The learner should understand that the top number describes the number of beats or pulses in a measure, while the bottom number identifies the note-value reference used by the notation. The app should teach this through counting and sound, not definition-only quizzes.

| Tier band | Time-signature outcome | Exercise types | Musical application |
|---|---|---|---|
| 1–2 | Recognize the bar line, downbeat, and 4/4; count four quarter-note beats | Count aloud, tap steady pulse, choose the downbeat, complete a missing beat | Ode to Joy and simple 4/4 melodies |
| 3–5 | Distinguish 2/4, 3/4, and 4/4; feel strong/weak beat patterns | Hear-and-identify, tap one measure, conduct with directional gestures, place notes into a bar | March-like 2/4, waltz/3/4 Amazing Grace, common-time songs |
| 6–10 | Read meter while tracking a 12-bar form and shuffle subdivision | Count-in selection, bar-completion, straight/shuffle comparison, rhythm clapback | 4/4 blues and shuffle; preserve the form across 12 bars |
| 11–15 | Maintain meter through syncopation, anticipations, and fills | Tap the pulse while clapping offbeats; identify whether a fill begins before or after the beat | Country boom-chick, blues turnarounds, gospel syncopation |
| 16–22 | Switch feel without losing the underlying meter; recognize compound or triplet-based subdivision when introduced | Meter/feel identification, phrase-length prediction, groove switching, form tracking | Walking bass, gospel grooves, medley transitions |
| 23–30 | Read unfamiliar meters and make expressive rhythmic choices while preserving form | First-look rhythm reading, internal-count test, recovery after an interrupted bar, arrangement analysis | Lead sheets, backing tracks, arranging, performance |

Time-signature mastery should require three kinds of evidence: identify the meter visually or aurally, count/tap it independently, and play a musical phrase without losing the bar structure. The app should not imply that a user understands 3/4 merely because they completed a chart labeled `3/4`.

#### Harmony and theory ladder

| Tiers | Knowledge capability | Retrieval / construction target | Required application |
|---|---|---|---|
| 1–2 | Keyboard geography, steps/skips, tonic awareness, basic notation symbols | Find named notes; identify same/different and up/down | Five-finger melodies and simple roots |
| 3–5 | Major scale degrees, I–IV–V, major triad construction, chord symbols | Build/name C, F, and G triads; identify tonic vs away | Melody with I–IV–V accompaniment |
| 6–10 | 12-bar form, dom7 construction, Nashville numbers, key center | Label bars by number; build C7/F7/G7; hear major vs dom7 | Blues form and shuffle comping |
| 11–15 | Inversions, pentatonic/blues formulas, diatonic triad qualities, transposition | Select nearest inversion; spell scale tones; convert letters to numbers | Fills, turnarounds, country 1–4–5 in C and G |
| 16–22 | Diatonic sevenths, ii–V–I, extensions, secondary dominants, passing chords | Identify function and target; explain why a passing chord resolves | Gospel voicings, walking bass, three-key jam |
| 23–30 | Reharmonization, slash chords, form/arrangement, chord-scale choices | Explain and compare substitutions; read unfamiliar lead sheets | Arrangement, improvisation, teaching-back, capstone |

Theory is passed through retrieval and application, not recognition alone. “I have seen C7” is not enough; the user should be able to build it, hear it, locate it in a progression, and use it in a song.

#### Ear and musicianship ladder

| Tiers | Listening capability | Exercise progression | Transfer requirement |
|---|---|---|---|
| 1–2 | Pitch direction, repetition, pulse, short melodic memory | Up/down, same/different, clap or tap back two beats | Copy a short melody and keep a steady pulse |
| 3–5 | Steps/skips, phrase ending, tonic, major triad color | Interval direction, melody playback, tonic/home identification | Predict or sing/play the ending of a simple phrase |
| 6–10 | Form, I–IV–V, dom7 color, straight/shuffle feel | Chord-quality ID, progression-by-number, feel ID, 12-bar count | Choose a matching accompaniment and recover after a miss |
| 11–15 | Inversion/bass movement, pentatonic/blues color, call-and-response | Hear bass direction, identify scale color, echo two-bar phrases | Improvise an answer and resolve to a chord tone |
| 16–22 | ii–V–I, extensions, passing chords, genre distinction | Progression ID, “what changed?”, voice-leading hearing, groove ID | Choose a gospel/country/blues treatment from audio alone |
| 23–30 | Phrase, tension/release, arrangement, self-diagnosis | Melodic dictation, harmonic analysis by ear, motif memory, playback | Create, record, and critique a coherent multi-chorus performance |

The Head lock should move from recognition to prediction and production. At later tiers, the strongest evidence is not merely naming what was heard but reproducing it, choosing a useful response, or explaining the musical function.

#### Repertoire and creativity ladder

| Tiers | Repertoire capability | Arrangement progression | Creative requirement |
|---|---|---|---|
| 1–2 | Finish a short melody with support | RH melody, then LH pulse/root | Choose a starting note or ending and perform without restarting |
| 3–5 | Play a complete simple song | Melody plus roots/triads; basic dynamics | Memorize a short phrase and make one musical choice |
| 6–10 | Hold a repeated form | 12-bar triads → dom7s → shuffle comping | Add a simple turnaround or two-bar response |
| 11–15 | Use vocabulary in context | Inversions, fills, boom-chick, transposed fragments | Improvise within a restricted scale and leave space |
| 16–22 | Accompany and switch styles | Walking bass, gospel extensions, ii–V–I, lead-sheet form | Sustain a groove while melody or app guidance drops out |
| 23–30 | Arrange and perform independently | Reharmonization, backing track, intros/outros, texture | Multi-chorus improvisation, one-take performance, teach-back |

Repertoire should maintain three simultaneous roles: **current song** for achievable mastery, **review songs** for durable retention, and **stretch fragments** for aspiration. Free Play can draw from current and review songs but must not be confused with a curriculum checkpoint.

### 4.5 Cross-strand gates

Each major tier checkpoint should require the strands to meet in one task. The gate is not complete if the user can pass only one component:

| Checkpoint | Technique | Rhythm | Harmony / scale | Ear | Musical proof |
|---|---|---|---|---|---|
| Tier 5 foundation | Melody + root/chord coordination | Steady pulse through full song | C scale degrees and I–IV–V | Hear phrase ending / tonic | Complete simple song without restart |
| Tier 10 first branch | Shuffle bass + chord changes | Maintain 12-bar form and swing | Dom7s, numbers, minor pentatonic preview | Hear straight/shuffle and chord color | Full blues chorus at target tempo |
| Tier 15 vocabulary | Inversion changes + fills | Syncopation and intentional space | Pentatonic/blues scale, transposition | Hear bass movement and phrase response | Song plus transposed fragment |
| Tier 22 genre fluency | Independent accompaniment | Switch groove without losing pulse | ii–V–I, extensions, passing motion | Distinguish genre treatments | Three-style medley |
| Tier 30 functional fluency | Efficient, expressive performance | Hold form through errors | Explain key, progression, scale, and voicing | Identify and reproduce a short idea | Play, transpose, improvise, and teach-back |

This cross-strand structure prevents a player from advancing by grinding charts, memorizing theory answers, or completing isolated scale drills without musical transfer.

## 5. Mastery and progression rules

### 5.1 Skill mastery rubric

Each skill card has a measurable rubric. Defaults below are authoring defaults, not immutable global constants:

| State | Requirement | User-facing meaning |
|---|---|---|
| Introduced | Complete Discover + Copy | “You have met this.” |
| Practicing | 2 successful guided or supported attempts | “Your hands are learning the shape.” |
| Functional | 3 attempts at ≥85% pitch correctness and ≥70% Good-or-better timing | “You can use it with help.” |
| Hands-ready | 3 separate attempts, on different sessions, at ≥90% pitch correctness and ≥75% Good-or-better timing | “You can perform it reliably.” |
| Hands-mastered | 3-star, target tempo, zero assists on a dedicated checkpoint | “You can play it.” |
| Gold | Hands-mastered + Head threshold ≥0.85 | “You can play, hear, and explain it.” |

The current `HANDS_THRESHOLD = 0.85`, `HEAD_THRESHOLD = 0.85`, and at-tempo/unassisted mastery rule remain the authoritative implementation guardrails. The repeated-attempt rubric is curriculum guidance for how to fill the lock; it should be encoded only when the progression service is extended to support evidence history.

### 5.2 Song mastery is separate from attempt stars

An attempt-level **mastery star** means “this take met the current performance threshold.” It must not mean “the user is fluent in this song.” A song is a larger, durable object with multiple sections, transitions, tempos, arrangements, and retrieval contexts. A user can earn a mastery star on a song and still have weak bars, unreliable transitions, or no evidence that they can reproduce it later.

Every unlocked song should therefore have its own **Song Mastery** track. Song Mastery can be advanced from both Path and Free Play, but it should require evidence across time and contexts.

#### Song Mastery levels

| Level | Name | Evidence |
|---:|---|---|
| 0 | Discovered | Song is visible and the user has heard or previewed it |
| 1 | Started | At least one section completed with support; weak sections identified |
| 2 | Sections learned | Every required section has a successful section attempt; no section remains unplayed |
| 3 | Connected | Transitions between sections work in sequence at a reduced or adaptive tempo |
| 4 | Performance-ready | Full arrangement completed at target tempo, unassisted, on two separate sessions |
| 5 | Durable mastery | Performance-ready evidence plus delayed retrieval, changed-context transfer, and sustained quality across a longer practice history |

Full Song Mastery should be difficult by design. It should normally require several sessions over multiple days, not one excellent take. The user should see progress toward mastery without being told they are “fluent” prematurely.

#### Durable mastery requirements

The exact thresholds can be tuned after playtesting, but the default Song Mastery gate should require:

- every required section passed at least once;
- all critical transitions passed in sequence;
- at least five qualifying full-song performances across at least five separate sessions/days;
- at least three of those performances at target tempo;
- no assists on the qualifying performances;
- no section below the minimum quality threshold on the latest performance;
- one delayed retrieval after the song has left the immediate practice queue;
- one transfer performance, such as a new key, alternate arrangement, backing track, reduced visual guidance, or memory/lead-sheet mode, when the song supports it;
- evidence that quality remains stable after at least one intervening session focused on other material.

Free Play attempts contribute normally to this track when they meet the evidence requirements. Free Play is not a shortcut; it is one of the legitimate places where durable song evidence can accumulate.

#### Song Mastery evidence model

Persist Song Mastery separately from `Attempt`:

```ts
interface SongMastery {
  songId: string;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  sectionProgress: Record<string, SectionMastery>;
  transitionProgress: Record<string, TransitionMastery>;
  qualifyingSessionIds: string[];
  bestAttemptId?: string;
  lastAttemptId?: string;
  delayedReviewDue?: number;
  transferEvidence: TransferEvidence[];
  weakSectionIds: string[];
  lastAdvancedAt?: number;
}
```

The existing Attempt remains the detailed result of one take. SongMastery is a reducer over many Attempts and should never be inferred from the best score alone.

#### Song Mastery and progression

- Song unlocks remain skill-gated by demonstrated Hands progress.
- A song may be unlocked and playable without being Song-Mastered.
- Song Mastery should contribute to repertoire goals, badges, confidence, and Free Play recommendations.
- Song Mastery should not replace skill mastery or allow currency to bypass skill gates.
- A tier boss song can be required for tier advancement at **Performance-ready** or an equivalent durable checkpoint, but the full Song Mastery level 5 should not block the learner from continuing. This prevents the curriculum from becoming an unnecessarily rigid song-completion wall.
- Mastered songs should remain in low-frequency maintenance review and can return as changed-context review.

### 5.3 Stretch-song boss challenges

The stretch song remains roughly ten tiers above the user’s current playing tier. It is not unlocked, it is not a normal Free Play song, and the user is not expected to complete it. It is a source of curiosity and carefully bounded desirable difficulty.

The stretch song should appear as a recurring **Boss Challenge** inside relevant modules. Each Boss Challenge extracts one small challenge from the stretch song that mirrors the current curriculum target:

| Current lesson target | Stretch Boss Challenge |
|---|---|
| Keep a steady pulse | Tap or play one repeated note in the stretch song’s groove for two bars |
| Learn a scale shape | Identify or play the scale fragment used in one stretch riff |
| Change I–IV–V chords | Recognize, build, or play one stretch-song chord transition |
| Practice shuffle | Perform the stretch song’s two-beat shuffle cell at a safe tempo |
| Learn a turnaround | Play or identify the final measure only |
| Hear a pitch/interval | Identify the interval or chord tone in a short isolated excerpt |
| Practice a passing chord | Resolve one extracted passing movement, without the surrounding arrangement |
| Improvise call-and-response | Answer a two-bar stretch phrase using the currently learned scale |

Boss Challenges should:

- use only a measure, phrase, chord, voicing, rhythm cell, or ear prompt;
- connect explicitly to the current module’s skill;
- be playable with a safe, adaptive tempo;
- provide curiosity-oriented feedback rather than a normal fail state;
- award exploration progress or a small skill-transfer signal, never Song Mastery;
- never unlock the full stretch song;
- be revisited later so the user can notice that a once-impossible fragment has become familiar.

The user-facing framing should be: “Here is where today’s skill appears in a much bigger piece.” It should not be: “You failed the advanced song.”

Stretch Boss progress should track **fragments explored**, **skills previewed**, and **successful transfer into current-tier material**, not percentage of the full song completed.

### 5.4 Tier advancement

A player advances to the next tier when:

- all **core gate skills** in the current tier are Hands-mastered;
- the tier’s **boss song** has a mastery star at target tempo and no assists;
- the user has passed the tier’s theory/ear checkpoint at ≥80%;
- at least one previously learned skill has passed a spaced review after a delay.

The gold requirement is not needed to advance the playing tier. Gold is a durable musicianship badge and improves review rewards, but it must not make a user wait for AFK access before continuing to play.

### 5.5 No single metric can pass a tier

The gate deliberately combines performance, knowledge, retention, and transfer. A user cannot advance by grinding one easy chart, memorizing one screen, or answering theory questions without playing.

### 5.6 Adaptive difficulty

The current flow target of roughly 70–85% success is appropriate. Adapt one variable at a time and never silently change the assessment target:

- below 70%: reduce tempo or arrangement complexity;
- 70–85%: repeat with one small variation;
- above 85% twice: increase tempo by 4–6 BPM, add a variation, or remove one assist;
- three-star at target tempo: offer the independent checkpoint;
- repeated failures: split the card into a smaller prerequisite, not endless retries.

## 6. Tier-by-tier syllabus

The 30 tiers are grouped into five arcs. Each tier has a **core outcome**, a **theory/ear target**, **movement/rhythm work**, **repertoire application**, and a **gate**. Song titles are examples; content authors may substitute equivalent public-domain arrangements without changing the skill gate.

### Arc I — Find the instrument (Tiers 1–5)

| Tier | Core outcome | Theory / ear | Movement / rhythm | Song or applied task | Gate |
|---:|---|---|---|---|---|
| 1 | Orient at the keyboard; play a 5-finger melody | Name C, D, E, F, G; hear up/down; quarter-note pulse | Curved fingers, relaxed shoulders, finger numbers 1–5; four beats per bar | **Ode to Joy** or Mary Had a Little Lamb, RH | Play the melody twice at 96 BPM with ≥90% correct notes and steady pulse |
| 2 | Add the left hand as a timekeeper | Staff direction, bar lines, 2/4 and 4/4; hear same/different | LH single roots; hands separately, then together in parallel rhythms | When the Saints, RH melody + LH roots | 8 bars hands together at ≥80 BPM without stopping |
| 3 | Move beyond one 5-finger position | Step vs skip; C major pentascale; recognize repeated phrase | Thumb tuck introduction; controlled position shift; eighth-note counting | Twinkle / ABC or Oh! Susanna | Locate/play a 5-note pattern starting on C, F, and G |
| 4 | Play primary chords in a real song | I, IV, V in C; major triad = 1–3–5; hear tonic vs away | Blocked triads, relaxed chord release, LH root + RH chord | She’ll Be Comin’ ’Round the Mountain | Identify/play I–IV–V in C with 75% variation accuracy |
| 5 | Coordinate melody and simple accompaniment | C major scale degrees 1–7; chord symbols C, F, G; phrase and cadence; hear “home” | LH root notes on beat 1; RH melody legato; basic dynamics | Amazing Grace or Home on the Range | Play C major slowly and use its tones in a short melody/fill; boss song at target tempo |

**Arc unlock:** the user has a playable foundation and may choose a first branch. Blues is recommended, but country and gospel preview modules are available.

### Arc II — Make it sound like music (Tiers 6–10)

| Tier | Core outcome | Theory / ear | Movement / rhythm | Song or applied task | Gate |
|---:|---|---|---|---|---|
| 6 | Feel and remember the 12-bar form | I–IV–V map: bars 1–4 / 5–6 / 1–2 / 5–6 / 1–2; hear turnaround to I | Quarter-note chord comping; count 12 bars without losing place | **12-Bar Blues in C**, plain triads | Complete three 12-bar choruses; name each chord by number |
| 7 | Introduce dominant 7ths | Dom7 = 1–3–5–♭7; major vs dom7 by ear | Add the seventh without squeezing; release together | 12-Bar Blues with C7/F7/G7 | Build and play three dom7s; 80% chord-ear accuracy |
| 8 | Establish shuffle feel | Straight vs swung eighths; shuffle notation; beat 2/4 backbeat; minor pentatonic sound | LH long-short root/fifth; no accent on every note | Frankie and Johnny or a shuffle fragment | Four bars of shuffle at 80% target tempo, then answer a 2-bar phrase with minor-pentatonic notes |
| 9 | Apply chord changes without stopping | Harmonic rhythm; phrase endings; hear I→IV and V→I | RH chord inversions for minimal movement; steady LH root | C.C. Rider or a 12-bar song | Three choruses with ≥85% correct chord onsets |
| 10 | First branch checkpoint: groove + form | Nashville numbers 1, 4, 5; identify I–IV–V by ear | LH shuffle + RH dom7 comping; recover after a miss | **Blues boss: 12-bar Blues full arrangement** | Mastery star at target tempo; theory/ear checkpoint ≥80% |

### Arc III — Vocabulary and independence (Tiers 11–15)

| Tier | Core outcome | Theory / ear | Movement / rhythm | Song or applied task | Gate |
|---:|---|---|---|---|---|
| 11 | Use inversions as a movement strategy | Root position, 1st/2nd inversion; hear bass movement | LH root + RH close-position chords; relaxed pivots | When the Saints gospel arrangement | Play I–IV–V in two inversion sets with no hand jump over 8 bars |
| 12 | Play the major pentatonic and blues scale | Major vs minor pentatonic; ♭3/♭5/♭7 blues color; hear tension/resolution | RH scale shapes in C and F; even finger crossing; relaxed lateral movement | Careless Love riff or 2-bar blues answer | Improvise four 2-bar answers using allowed notes and resolve two phrases to chord tones |
| 13 | Build a country accompaniment | Nashville numbers in C/G; diatonic triad qualities | Boom-chick: LH bass then RH chord; consistent release | Red River Valley or Wildwood Flower | Play 1–4–5 in C and G from numbers, not letter prompts |
| 14 | Add a turnaround and fill | Dominant-to-tonic resolution; phrase space; call/response | RH fills between phrases; avoid filling over the melody | Blues with a Turnaround | Perform 3 different endings and leave intentional space |
| 15 | Branch checkpoint: accompaniment + vocabulary | Transpose I–IV–V to F; hear major/minor/dom7 | Hands-independent groove; dynamic accents | **Country/gospel/blues choice boss** | One song in C plus one transposed fragment in F or G |

### Arc IV — Genre fluency (Tiers 16–22)

| Tier | Core outcome | Theory / ear | Movement / rhythm | Song or applied task | Gate |
|---:|---|---|---|---|---|
| 16 | Walk a bass line | Chord tones and approach tones; hear bass direction | LH stepwise walking bass; RH sparse comping | Walking-bass Blues | Four bars walking bass in C, then eight bars under chords |
| 17 | Understand the ii–V–I | Roman numerals ii–V–I; diatonic seventh chords; hear cadence | Smooth voice leading; guide tones 3rd/7th | ii–V–I études in C and F | Identify/play ii–V–I in three keys with 80% ear accuracy |
| 18 | Add gospel color with extensions | 9ths and 13ths; chord symbols C9, F13; hear open/full sound | Spread voicings; omit nonessential tones safely; balanced voicing | Amazing Grace — gospel style | Apply one extension to each chord in a full chorus |
| 19 | Add passing motion | Secondary dominants; chromatic approach; diminished passing chord concept | Half-step approach with controlled hand movement | Down by the Riverside gospel arrangement | Hear and resolve three passing chords; no loss of pulse |
| 20 | Transpose by number | Nashville numbers beyond 1/4/5; 1–5–6–4; key center | Same pattern in C, G, F; lateral movement without tension | Nashville-number jam | Play one progression in three keys at ≥80% target tempo |
| 21 | Comp while melody continues | Lead-sheet form, intro/verse/turnaround; chord substitution basics | RH melody + LH roots, then RH chord shells + melody fragment | This Little Light of Mine or equivalent | Maintain accompaniment while app melody drops out for 4 bars |
| 22 | Genre checkpoint | Distinguish blues, gospel, and country groove/voicing by ear | Choose appropriate comp pattern under pressure | **Three-style medley boss** | 12 bars each in three styles; ear checkpoint ≥85% |

### Arc V — Become your own player (Tiers 23–30)

| Tier | Core outcome | Theory / ear | Movement / rhythm | Song or applied task | Gate |
|---:|---|---|---|---|---|
| 23 | Play faster without tightening | Tempo map, subdivision at faster BPM; hear rushing | Efficient repeated patterns, rotation, controlled accents | Honky-tonk pattern song | Target groove at three tempos with stable timing histogram |
| 24 | Use boogie / 8-to-the-bar motion | Repeating ostinato; chord-tone map | LH boogie pattern, endurance, hand relaxation | Pinetop’s Boogie Woogie fragment | 8-bar ostinato + RH break, no assist |
| 25 | Reharmonize a simple melody | Secondary dominants, vi substitution, passing diminished | Voice-leading over large jumps; sustain/pedal awareness | Amazing Grace reharmonization | Two valid reharmonizations and explanation of each target chord |
| 26 | Improvise over form | Blues scale extensions, motifs, tension/release | Motif repetition, register choice, dynamic contour | 12-bar improvisation over backing track | Four choruses: statement, variation, contrast, ending |
| 27 | Read and play unfamiliar material | Lead-sheet shorthand, slash chords, repeats, coda | First-look strategy; keep pulse through mistakes | Fresh public-domain lead sheet | 8-bar sight-read at a safe tempo with ≥75% correct notes |
| 28 | Arrange for a listener | Intro/outro, texture, dynamics, register, pedal decisions | Balance melody and accompaniment; intentional silence | User-selected arrangement | Record a complete arrangement and self-identify one improvement |
| 29 | Perform under conditions | Memory retrieval, recovery, count-in, stage routine | No restart after errors; expressive timing within pulse | Capstone medley: blues + gospel + country | One-take performance; no assists; timing and pitch thresholds met |
| 30 | Demonstrate functional fluency | Explain form, key, progression, voicing choices, and next goal | Choose technique appropriate to the music | **Piano Pro recital / free-play challenge** | Play, transpose, improvise, identify by ear, and teach-back a short idea |

Tiers 23–30 should not be interpreted as “advanced classical piano.” They define the first meaningful plateau of genre fluency. Later content can add faster keys, richer voicings, stride, gospel reharmonization, accompaniment in more meters, and more demanding repertoire without changing the trunk.

## 7. Standard lesson and session templates

### 7.0 The learner-facing funnel

The curriculum should be presented as a guided **Path** inside the **Missions** tab, not as a collection of equally weighted destinations. The first-run flow is:

`landing page → Get Started → input choice/calibration → what this app teaches → how Missions/Path works → XP and mastery → first Mission`

After onboarding, the default home view should have one dominant action such as **Continue Module 1** or **Start today’s practice**. Secondary actions can include Review, Progress, and Free Play, but they should not visually compete with the recommended next step.

The onboarding explanation should be brief and concrete:

- **Modules** teach one small musical outcome through several exercise types.
- **Songs** provide the musical application and reward for the skills being learned.
- **Missions / Path** decides the recommended next lesson and gradually unlocks new material through demonstrated playing.
- **Free Play** lets the user practice any already-unlocked song whenever they want.
- **XP** reflects validated learning progress. Hands XP can fill the Level meter; Head/AFK progress cannot raise the playing tier by itself.
- **Riffs** are deferred from the next UI pass and should not be required to understand or progress through the curriculum.
- **Mastery** means playing accurately, in time, at the target tempo, without assists. Knowledge/ear progress and playing progress are tracked separately.

Onboarding should end by launching the first Mission directly. It should not end on a blank dashboard or ask the user to choose among the entire skill tree. The user can replay onboarding later from Settings or Help.

### 7.0.1 Path versus Free Play

These are complementary product surfaces:

| Surface | Purpose | Song access | Recommended for |
|---|---|---|---|
| Path | Teach the next skill in sequence | Current lesson song/fragments plus eligible unlocks | Beginners and daily practice |
| Free Play | Open-ended practice and enjoyment | Any unlocked song/arrangement | Repetition, experimentation, and user choice |

Free Play uses the same player, scoring, reports, and legitimate attempt recording as Path. The difference is context: a Free Play take is not necessarily the next curriculum lesson. It may strengthen an existing Hands lock, create review evidence, or simply be enjoyable practice.

Free Play must not expose locked songs as if they are purchasable. A locked song can be previewed only through the existing Scouting/fragment rules, with a clear explanation of which demonstrated skills are missing.

### 7.1 A 20-minute keyboard session

| Time | Segment | Content |
|---:|---|---|
| 2 min | Familiar win | One mastered riff, scale shape, or groove at comfortable tempo |
| 4 min | New card | Discover/copy one micro-skill, initially supported |
| 3 min | Spaced review | One due Hands card and one due Head/ear card |
| 3 min | Movement lab | Isolate the exact hand motion or coordination problem |
| 2 min | Theory/ear | One short quiz tied to what was just played |
| 4 min | Song application | Phrase or chorus using today’s card |
| 2 min | Independent take | Small unassisted checkpoint or feedback attempt |

For a 30-minute session, add a 5-minute stretch fragment and a second song application. For a 5-minute session, use one familiar win, one due review, and one musical application; never show a guilt message for a short session.

> **Implementation decision (Phase 5, 2026-07-23).** v1 sessions are **open-ended**: the time budgets above are implemented as an *ordering* template over a prioritized, interleaved queue that refills as it drains, and the spaced-review slot generalizes to a **20–35% due-review share** of the queue composition. There is no session-length picker — the player stops whenever they like, and the wrap screen celebrates any length (the no-guilt rule above is load-bearing). See doc 07 §10 and the ADR log in AGENTS.md.

### 7.2 A module lesson as a Duolingo-style path

The UI should expose one recommended next lesson but allow optional review and branch choice. A typical path is:

`listen → identify → imitate → play slowly → vary → use in riff → use in song → boss check`.

Each node should show:

- the musical outcome in plain language;
- the skill cards it advances;
- prerequisite status;
- whether the attempt is Guided, Supported, Independent, Performance, or Scouting;
- one clear reason for a miss;
- the next available action.

### 7.3 Woodshed / AFK session

Use the existing AFK design, with this content mix:

- 30% due ear items;
- 25% rhythm tap/counting;
- 20% theory retrieval tied to current songs;
- 15% melody/chord memory;
- 10% Scouting preview, capped at playing tier +1.

AFK can open Head progress and preserve the habit, but it cannot create a Hands mastery, unlock a song, or raise playing tier.

## 8. Exercise catalog and generation rules

### 8.1 Keyboard exercises

- **Echo play:** app plays a 1–4 beat idea; user repeats it.
- **Shadow rhythm:** user plays one repeated pitch in the target rhythm.
- **Note hunt:** locate a named pitch across octaves; then play it in time.
- **Finger pattern:** five-finger, pentascale, scale fragment, or chord shape.
- **Chord builder:** play requested chord tones; later identify inversion from bass.
- **Change drill:** alternate two chords at a fixed pulse; score change onset and unnecessary movement.
- **Left-hand ostinato:** repeat root/fifth, shuffle, boom-chick, walking, or boogie pattern.
- **Melody-over-bed:** RH phrase over a repeating LH pattern.
- **Fill-the-gap:** respond to a four-bar melody with a two-bar fill.
- **Recovery rep:** intentionally omit a note or introduce a pause; continue on the next beat.

### 8.2 Visual and notation exercises

- keyboard-to-note and note-to-key mapping;
- note-name removal over time;
- chord-symbol reading;
- interval recognition on staff and keyboard;
- rhythm reading with count-in;
- time-signature identification, bar completion, and meter-switch exercises;
- lead-sheet form markers, repeats, endings, and slash chords;
- first-look sight-reading of a fresh, short fragment.

Notation is secondary to chord symbols and the playable visualizer in the early product, but it must not be omitted. Starting in Tier 1, include tiny staff-reading reps; by Tier 27, include independent fresh-material reading.

### 8.3 Ear and theory exercises

- note-name and pitch-direction identification;
- major/minor/dom7/diminished quality identification;
- interval ID and interval spelling;
- melody playback from memory;
- rhythm clapback and steady-pulse continuation;
- I–IV–V, ii–V–I, and 1–5–6–4 progression recognition;
- straight vs swing/shuffle feel identification;
- “what changed?” passing chord or inversion detection;
- build-a-chord and explain its formula;
- transpose a progression by scale degree;
- identify a lick, turnaround, voicing, or groove by sound.

The ear catalog follows a proven musicianship progression: introductory pitch direction, pitch patterns, triad quality, rhythm identification and clapback first; intervals, scales, melodies, chord degrees, and progressions later. This mirrors the structure used by established conservatory musicianship programs.

## 9. Content authoring contract for future coding agents

The current `Skill`, `Song`, `Chart`, `Fragment`, and `MiniGame` entities are a sound foundation. Extend content with optional fields rather than hardcoding lesson logic:

```ts
interface CurriculumSkill extends Skill {
  arc: 'foundation' | 'blues' | 'country' | 'gospel' | 'fluency';
  strand: 'technique' | 'rhythm' | 'harmony' | 'ear' | 'repertoire';
  outcome: string;
  moduleId: string;
  lessonIds: string[];
  prerequisiteEvidence?: string[];
  assessment: {
    minStars: 0 | 1 | 2 | 3;
    minNotesCorrectPct: number;
    minGoodOrBetterPct: number;
    requiresAtTempo: boolean;
    requiresNoAssists: boolean;
    repeatedSessions?: number;
  };
  strandEvidence: {
    technique?: string[];
    rhythm?: string[];
    harmony?: string[];
    ear?: string[];
    repertoire?: string[];
  };
  transferTargets: string[];
  commonErrors: string[];
}

interface CurriculumLesson {
  id: string;
  moduleId: string;
  order: number;
  mode: 'guided' | 'supported' | 'independent' | 'performance' | 'scouting' | 'woodshed';
  exerciseType: MiniGameType | 'play-chart' | 'fragment' | 'listen';
  skillIds: string[];
  prompt: string;
  successRule: string;
  assistOptions: Assist[];
  chartId?: string;
  fragmentId?: string;
  generatorParams?: Record<string, unknown>;
}
```

Recommended additional content entities:

- `Module`: arc, title, promise, prerequisite modules, lesson IDs, core skill IDs, boss lesson ID;
- `Assessment`: skill/tier, evidence requirements, attempts allowed, pass feedback, remediation lesson IDs;
- `TheoryConcept`: explanation, examples, linked skills, linked songs, AFK exercise IDs. **Rule (2026-07-23): every multiple-choice question — authored or generated — ships `choiceExplanations`, one line per choice explaining why the right answer is right and why each wrong one is wrong (powers the learner's "Explain my answer" panel; enforced by content validation);**
- `TechniqueCue`: plain-language cue, observable proxy, contraindicated claim, related exercise;
- `TierGate`: core skills, boss song/chart, theory/ear checkpoint, retention requirement;
- `SongVariant`: arrangement level, taught skills, required Hands skills, assist policy, target tempo;
- `Fragment`: source song, bars, skill tags, difficulty, lesson mode, and transfer target.

The ContentService should validate:

- every prerequisite and skill reference exists;
- lesson order has no impossible prerequisite cycle;
- every tier has at least one core gate and one assessment;
- every skill has at least one keyboard application and one Head/ear or theory exercise where appropriate;
- every boss song is playable by the preceding skill set;
- every song unlock is based on `requiredSkills`, never XP or Riffs;
- every Scouting fragment is at most one tier above the current playing tier at runtime.

## 10. Feedback language and motivation rules

Feedback should be specific, calm, and action-oriented:

- “You’re landing late on the chord change. Try the same loop at 72 BPM.”
- “Your notes are correct; the pulse drifts after bar 8. Count the backbeat aloud once.”
- “You know this chord by ear. Play it next to its nearest inversion.”
- “The groove is stable. Now remove falling notes for one independent rep.”

Avoid claims the input system cannot observe:

- do not say “your wrist is tense” from MIDI alone;
- do not imply a missed note means the user lacks talent;
- do not equate XP, streak length, or app time with musicianship;
- do not make the user replay an already-mastered easy chart for progression.

The app should celebrate concrete capability: “You held a 12-bar form,” “you changed chords without losing the beat,” “you heard the dominant seventh,” or “you recovered without restarting.”

## 11. Recommended implementation order

1. **Content foundation:** replace the seed skill list with the Tier 1–10 trunk and Blues starter path; add module/lesson/assessment schemas and validation. Author at least one skill card per strand in every tier band.
2. **Exercise primitives:** implement note ID, rhythm tap, chord builder, chord ear ID, progression ID, and fragment playback.
3. **SessionBuilder:** assemble the standard lesson anatomy and enforce interleaving across skill families.
4. **Mastery evidence:** keep current guardrails, then add repeated-session evidence and tier-gate checkpoints without allowing Head progress to raise playing tier.
5. **Starter repertoire:** build the public-domain Tier 1–10 set: Ode to Joy, When the Saints, Amazing Grace, Oh! Susanna, 12-Bar Blues, Frankie and Johnny, C.C. Rider, Red River Valley, and This Little Light of Mine.
6. **AFK/Woodshed:** populate ear and rhythm content only after the same skills exist in keyboard lessons.
7. **Genre expansion:** add Tiers 11–22 across blues, gospel, and country, reusing shared skills and fragments.
8. **Fluency arc:** add Tiers 23–30, backing tracks, improvisation, transposition, sight-reading, and capstone performance.

## 12. Research basis and design interpretation

The curriculum uses the following converging evidence and established practice structures:

- Deliberate practice is represented by small, measurable cards, slow-to-fast progression, targeted feedback, and focused remediation.
- Interleaving is used between related skills and songs; the user should not confuse the harder feeling of interleaving with lack of progress.
- Established piano assessment frameworks repeatedly combine repertoire, technical work, ear tests, rhythm, and sight-reading rather than treating repertoire as the entire curriculum. The Royal Conservatory’s preparatory requirements, for example, include repertoire, technical tests, clapback, chord work, playback, rhythm, and playing; its higher levels continue with intervals and progression work.
- Beginner piano pedagogy emphasizes learning by ear and by reading, tone/technique, and accumulated repertoire. This supports the app’s hybrid rather than purely visual or purely theory-first design.
- Ear training should begin with pitch direction, patterns, basic chord quality, and rhythm, then grow into intervals, melody, chord degrees, and progressions.

The app should treat these sources as guidance, not as a claim that a game score is equivalent to a teacher’s physical observation. The curriculum is strongest when it makes musical outcomes observable, keeps technical claims modest, and leaves room for teacher or self-reflection outside the MIDI signal.

## Sources

- [Royal Conservatory of Music Piano Syllabus 2022](https://teacherportal.rcmusic.com/getattachment/57f3734d-97e5-4777-b67e-4b1111ee31a3/piano-syllabus-2022-edition.pdf) — repertoire, technical tests, ear tests, rhythm, and sight-reading requirements.
- [Royal Conservatory Online Ear Training](https://www.rcmusic.com/learning/digital-learning/rcm-online-ear-training-rcm-online-sight-reading/ear-training) — progression of melody, pitch, rhythm, interval, chord, and progression exercises.
- [ABRSM Piano](https://www.abrsm.org/en-gb/piano) — the established combination of repertoire, scales/arpeggios, sight-reading, and aural tests.
- [Fundamentals of Piano Pedagogy](https://link.springer.com/book/10.1007/978-3-319-65533-8) — beginner pedagogy connecting ear, reading, tone, technique, and accumulated repertoire.
- [Optimizing Music Learning: Blocked and Interleaved Practice](https://pubmed.ncbi.nlm.nih.gov/27588014/) — practice-schedule evidence motivating interleaved curriculum sessions.
- Existing project sources: `docs/01-curriculum-and-learning-design.md`, `docs/02-song-library.md`, `docs/03-gamification-design.md`, `docs/04-afk-mode-design.md`, and `docs/05-build-spec.md`.
