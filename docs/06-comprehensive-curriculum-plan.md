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

## 4. The five curriculum strands

The existing six skill families remain the content taxonomy. For instructional scheduling, they are grouped into five strands that appear in every tier:

1. **Technique and movement** — posture, relaxed hand shape, finger patterns, lateral movement, rotation, voicing, coordination, release, and economy of motion. The app can coach MIDI-observable timing and velocity, but it must not claim to diagnose wrist tension or posture without video/sensor evidence.
2. **Rhythm and groove** — pulse, subdivision, meter, swing/shuffle, syncopation, backbeat, fills, and playing through mistakes.
3. **Harmony and theory** — keyboard geography, intervals, scales, key relationships, chord construction, Roman numerals, Nashville numbers, form, voicing logic, and transposition.
4. **Ear and musicianship** — pitch direction, interval/chord quality, melodic memory, rhythm echo, progression recognition, error detection, and call-and-response.
5. **Repertoire and creativity** — songs, riffs, accompaniment, fills, improvisation, memory, lead-sheet reading, transposition, and performance.

The app should not present these as five school subjects. The user should experience a module as “learn a shuffle groove,” with the theory, ear, movement, and song application woven through it.

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

### 5.2 Tier advancement

A player advances to the next tier when:

- all **core gate skills** in the current tier are Hands-mastered;
- the tier’s **boss song** has a mastery star at target tempo and no assists;
- the user has passed the tier’s theory/ear checkpoint at ≥80%;
- at least one previously learned skill has passed a spaced review after a delay.

The gold requirement is not needed to advance the playing tier. Gold is a durable musicianship badge and improves review rewards, but it must not make a user wait for AFK access before continuing to play.

### 5.3 No single metric can pass a tier

The gate deliberately combines performance, knowledge, retention, and transfer. A user cannot advance by grinding one easy chart, memorizing one screen, or answering theory questions without playing.

### 5.4 Adaptive difficulty

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
| 5 | Coordinate melody and simple accompaniment | Chord symbols C, F, G; phrase and cadence; hear “home” | LH root notes on beat 1; RH melody legato; basic dynamics | Amazing Grace or Home on the Range | Boss: full song/arrangement at target tempo, no falling notes |

**Arc unlock:** the user has a playable foundation and may choose a first branch. Blues is recommended, but country and gospel preview modules are available.

### Arc II — Make it sound like music (Tiers 6–10)

| Tier | Core outcome | Theory / ear | Movement / rhythm | Song or applied task | Gate |
|---:|---|---|---|---|---|
| 6 | Feel and remember the 12-bar form | I–IV–V map: bars 1–4 / 5–6 / 1–2 / 5–6 / 1–2; hear turnaround to I | Quarter-note chord comping; count 12 bars without losing place | **12-Bar Blues in C**, plain triads | Complete three 12-bar choruses; name each chord by number |
| 7 | Introduce dominant 7ths | Dom7 = 1–3–5–♭7; major vs dom7 by ear | Add the seventh without squeezing; release together | 12-Bar Blues with C7/F7/G7 | Build and play three dom7s; 80% chord-ear accuracy |
| 8 | Establish shuffle feel | Straight vs swung eighths; shuffle notation; beat 2/4 backbeat | LH long-short root/fifth; no accent on every note | Frankie and Johnny or a shuffle fragment | Four bars of shuffle at 80% target tempo, then full 12-bar loop |
| 9 | Apply chord changes without stopping | Harmonic rhythm; phrase endings; hear I→IV and V→I | RH chord inversions for minimal movement; steady LH root | C.C. Rider or a 12-bar song | Three choruses with ≥85% correct chord onsets |
| 10 | First branch checkpoint: groove + form | Nashville numbers 1, 4, 5; identify I–IV–V by ear | LH shuffle + RH dom7 comping; recover after a miss | **Blues boss: 12-bar Blues full arrangement** | Mastery star at target tempo; theory/ear checkpoint ≥80% |

### Arc III — Vocabulary and independence (Tiers 11–15)

| Tier | Core outcome | Theory / ear | Movement / rhythm | Song or applied task | Gate |
|---:|---|---|---|---|---|
| 11 | Use inversions as a movement strategy | Root position, 1st/2nd inversion; hear bass movement | LH root + RH close-position chords; relaxed pivots | When the Saints gospel arrangement | Play I–IV–V in two inversion sets with no hand jump over 8 bars |
| 12 | Play the major pentatonic and blues scale | Scale formula; ♭3/♭5/♭7 blues color; hear tension/resolution | RH five-note shapes in C and F; even finger crossing | Careless Love riff or 2-bar blues answer | Improvise four 2-bar answers using only allowed notes |
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
- `TheoryConcept`: explanation, examples, linked skills, linked songs, AFK exercise IDs;
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

1. **Content foundation:** replace the seed skill list with the Tier 1–10 trunk and Blues starter path; add module/lesson/assessment schemas and validation.
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
