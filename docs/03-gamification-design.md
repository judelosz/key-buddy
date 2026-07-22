# Piano Learning App — Gamification System Design

*A research-grounded reward, feedback, and progression system engineered so that the fun always serves the skill. Companion to the Curriculum & Learning-Design Plan.*

Prepared July 2026.

---

## 1. The one rule everything else obeys

**Every reward must be a byproduct of getting better at piano — never a substitute for it.**

This is not a slogan; it's a design constraint backed by the research. Meta-analyses of gamification in education find that points and badges used as *controlling* mechanisms can actually *undermine* intrinsic motivation, while the same mechanics used to deliver genuine *competence feedback, meaningful choice, and social connection* produce sustained engagement and real learning gains. Gamification that doesn't support the underlying psychological needs can even have negative effects.

So the app is designed around **Self-Determination Theory's three needs** — this is the north star every mechanic is checked against:

- **Competence** — "I can see myself getting better." Delivered by precise scoring, mastery levels, and adaptive difficulty. This is the need most gamification *fails* to satisfy, so it gets the most engineering attention here.
- **Autonomy** — "I'm choosing this and shaping it." Delivered by goal-setting, cosmetic customization, and meaningful choices about what to play.
- **Relatedness** — "My effort is seen." Delivered (optionally) by sharing, and by the app itself acknowledging progress warmly.

The dopamine you're after is real and we'll engineer it deliberately (Sections 4 and 6), but it's anchored to *uncertainty about a reward for good playing*, not to slot-machine mechanics detached from skill. The difference between those two is the difference between a tool that makes you a pianist and a tool that just makes you open an app.

---

## 2. System overview

Seven interlocking subsystems:

1. **Scoring & Accuracy Engine** — measures *what* you played and *when*, note by note (Section 3).
2. **XP & Leveling** — the competence signal; converts performance into visible growth (Section 4.1).
3. **Currency & Economy** — earned "Riffs" spent on cosmetics and (soft) unlocks (Section 4.2–4.4).
4. **Variable Reward Layer** — ethical surprise bonuses for that dopamine hit (Section 4.5).
5. **Streaks & Habit Engine** — drives daily return without punishment spirals (Section 5).
6. **Adaptive Difficulty (Flow) Engine** — keeps you in the challenge-skill sweet spot (Section 6).
7. **Roadmap & Goals** — progress visualization and goal-setting (Sections 7–8).

The Scoring Engine feeds everything. If scoring is accurate and *fair*, every downstream reward is meaningful. If it's noisy or lenient, the whole economy becomes hollow. So we start there.

---

## 3. The scoring & accuracy engine

This is the heart of the app. It answers two questions on every single note: **did you play the right note, and did you play it at the right time?** Your instinct to tie scoring to a metronome is exactly right — timing is half the score, not an afterthought.

### 3.1 What gets measured

- **Pitch accuracy** — right note(s)? For chords, all required notes present, no extras.
- **Timing accuracy** — how close was the note's onset to where the beat grid says it should land? Measured in milliseconds of deviation from the target, judged relative to the current metronome tempo.
- **Duration/release** (later tiers) — did you hold it the right length? Matters for phrasing and sustain.
- **Dynamics/velocity** (advanced) — MIDI gives us key velocity, so eventually we can score evenness and intended accents. Start simple; add this later.

### 3.2 Timing windows and note grades

Borrowing the proven model from rhythm games, where the full-credit window is typically around ±50ms and competitive tiers tighten to ±20ms. We make the window a function of **difficulty tier**, so scoring gets stricter as you improve (this is also how we keep you in the flow channel — Section 6).

| Grade | Beginner window | Advanced window | Feedback color |
|---|---|---|---|
| **Perfect** | ±60 ms | ±25 ms | Green |
| **Great** | ±110 ms | ±55 ms | Light green |
| **Good** | ±180 ms | ±100 ms | Yellow |
| **Early / Late** | outside Good, wrong side | same | Orange (early) / Purple (late) |
| **Miss** | wrong note or not played | same | Red |

The **early/late directional feedback** is the single most instructive signal — it's what Melodics does (green = on time, orange = early, purple = late) and it lets you self-correct on the very next note instead of just knowing you were "off." We show it per-note in real time *and* summarize the pattern afterward ("you tend to rush the turnaround").

### 3.3 Real-time vs. end-of-take feedback

Two layers, because flow research says immediate feedback is a prerequisite for the flow state, but reflection prompts improve retention:

- **In-the-moment:** each note lights up its grade color as you play. Non-punitive — a miss doesn't stop the music (that kills flow and beginners quit).
- **End-of-take report:** star rating, timing histogram (are you consistently rushing/dragging?), a heat-map of which bars were weak, and one specific, actionable tip.

### 3.4 Star rating (the headline result)

Each song/exercise attempt earns **1–3 stars**, the familiar model from Yousician and Simply Piano, where three gold stars require both correct notes *and* good timing. Our formula:

- **1 star** — completed, ≥60% notes correct (participation; you finished).
- **2 stars** — ≥85% correct notes AND ≥70% of hits at Good or better timing.
- **3 stars** — ≥95% correct AND ≥85% at Great or better.
- **Gold/"mastery" star** — 3 stars at the *target tempo* (not slowed down). This separates "I can play it slowly" from "I've mastered it."

### 3.5 Input methods (MIDI vs. microphone)

Both are supported per your requirement, but they are not equal and the app should be honest about that:

- **MIDI keyboard (preferred, most accurate):** because it's digital, there's effectively no tracking latency and we get precise note, timing, and velocity data. Best for strict scoring. Note: USB-MIDI has ~sub-millisecond transmission but the browser/OS audio stack adds latency, so the app must run a **one-time latency calibration** (tap along to a click, measure offset, subtract it from all judgments). This is essential — uncalibrated latency would make honest players look late.
- **Microphone (acoustic piano):** uses polyphonic pitch detection like Yousician's audio engine. Works with any real piano, but is less reliable, especially for dense chords and fast passages. We should widen the timing windows slightly in mic mode and be transparent that scoring is approximate.

Calibration and a clear "MIDI recommended for best feedback" nudge belong in onboarding.

### 3.6 Why timing-against-metronome matters pedagogically

Tying every score to the metronome grid isn't just for points — steady pulse and the swing/shuffle feel are foundational skills for all three of your genres (see curriculum doc). By scoring timing from day one, the app trains groove as a first-class skill rather than letting it be the thing beginners silently neglect.

---

## 4. Rewards: XP, currency, variable bonuses

### 4.1 XP — the competence signal

XP is the direct "I'm growing" feedback, awarded **the instant a take completes, before the screen closes**, so the reward is tightly coupled to the behavior (this coupling is what makes Duolingo's XP work). But we make one crucial change to avoid the classic failure mode where players grind easy content:

> **XP scales with difficulty × freshness × performance.**

- **Difficulty** — harder tiers pay more.
- **Freshness** — a skill that's decaying in your spaced-review queue is worth a large multiplier; a skill you already mastered and replay is worth almost nothing. This points the incentive squarely at *real learning* and defuses the "optimize the game, not the skill" risk that the gamification literature warns about.
- **Performance** — more stars, more XP.

XP accumulates into **Player Level** (overall) and per-skill **Mastery Crowns** (like Duolingo's crown levels), so progress is visible both globally and granularly.

### 4.2 Currency — "Riffs"

A single soft currency, earned through play, spent on customization and convenience. (Name is a placeholder — "Riffs," "Notes," "Keys," your call.) Earned currency gives learners a tangible sense of reward that boosts engagement more than abstract points. Sources and sinks:

**Earning Riffs:**

| Action | Reward | Rationale |
|---|---|---|
| Complete a daily session | Base amount | Rewards showing up |
| Earn a new star on any item | Bonus | Rewards *improvement*, not repetition |
| First 3-star of a song | Larger one-time bonus | Milestone |
| Hit a weekly goal (Section 8) | Bonus | Goal commitment |
| Clear a decaying review item | Bonus | Reinforces spaced repetition |
| Maintain streak milestones (7/30/100 days) | Escalating bonus | Habit |

**Spending Riffs:** cosmetics (Section 4.3), a limited number of **streak freezes**, and *optional* "practice boosts" (e.g., a hint, a slow-down assist). Note there is **no way to buy stars, XP, or skill unlocks with Riffs** — you cannot pay to skip getting good. This is the firewall that keeps the economy honest.

### 4.3 Cosmetics (the autonomy lever)

Cosmetics are the ideal reward sink because they're motivating *and* harmless to the learning mission — they satisfy autonomy (self-expression) without letting anyone buy their way past skill. Candidate cosmetic categories:

- **Keyboard skins / themes** (wood, neon, vintage Rhodes, etc.).
- **App themes and note-visualizer styles.**
- **An avatar or "band"** that grows/gains members as you progress.
- **Sound packs** — different piano/organ/Rhodes/Wurlitzer tones (fits the blues/gospel/country palette beautifully and doubles as ear training).
- **Milestone trophies** for your profile shelf.

### 4.4 Song unlocks — skill-gated, not grind-gated

This is a deliberate and important design choice. New songs unlock based on **demonstrated skill**, not on spending currency or hours grinding:

- A song becomes available when you've mastered its prerequisite micro-skills (from the curriculum's skill tags).
- This means unlocking a song is itself *proof of competence* — the unlock is the reward, and it's earned by getting better, exactly as you specified.
- Currency can unlock **cosmetic variations** of songs (a fancier arrangement, a new backing-track style) but never the core learning content.

The gating uses the endowed-progress and goal-gradient effects (Section 7): the app always shows the *next* locked song with a visible "3 skills away" progress bar, so you can see what to practice to earn it.

### 4.5 The variable reward layer (ethical dopamine)

Here's where we get the dopamine firing — deliberately and responsibly. The neuroscience: dopamine spikes more on *uncertain* rewards, and more in *anticipation* than in receipt. Variable-ratio reinforcement is the most powerful engagement schedule known — and also the one behind slot machines and infinite scroll, so we use it *only* to reinforce genuine practice, following the responsible-design principle that variable rewards must enhance real value, never mask a shallow experience.

Concrete, ethical implementations:

- **Surprise "encore" bonuses** — occasionally (variable), a great take triggers a bonus Riff drop, a rare cosmetic, or a fanfare. The *trigger is always good playing*; only the size/appearance of the reward is uncertain.
- **"Mystery challenge" of the day** — a randomized bonus objective ("nail three turnarounds") with an uncertain reward.
- **Loot-style unlocks tied to milestones** (à la Habitica's surprise pets/costumes on task completion) — you know you'll get *something* for practicing; you don't know exactly what.

The bright line we do **not** cross: no paid loot boxes, no rewards for merely opening the app, no fake urgency, no manipulative notifications, no hiding progress to force grinding. Anticipation is aimed at "did my hard practice earn a surprise?" not "will the machine pay out?"

---

## 5. Streaks & the habit engine

Streaks drive daily return via loss aversion, but the research on habit formation says raw streaks can backfire (one miss → shame → quit). So we build in resilience:

- **Daily streak** with a realistic target (the curriculum's 20–30 min session, which the research ties to steady progress).
- **Streak freeze** — earned or bought with Riffs, so one missed day doesn't reset you to zero. This deepens ownership and prevents the discouragement spiral.
- **Implementation intentions / habit stacking** — during onboarding and goal-setting, prompt "When will you practice? After ___." Anchoring the practice to an existing daily habit (habit stacking, per Fogg/Clear) is one of the most reliable ways to make it automatic — far more so than willpower.
- **Gentle, honest reminders** — a single well-timed reminder at the user's chosen practice time. No guilt-bombing, no fake notifications.
- **Streak repair** — a missed streak can be "earned back" with a strong session, rather than lost forever.

---

## 6. The adaptive difficulty (flow) engine

To keep practice enjoyable *and* effective, the app continuously steers you into the **flow channel** — the zone where challenge slightly exceeds current skill. Below it you're bored; above it you're anxious; flow requires clear goals, immediate feedback, and challenge-just-above-skill simultaneously. Levers the engine adjusts automatically:

- **Tempo** — the primary dial. Start every new item slow (~50% per deliberate-practice research), auto-nudge tempo up as accuracy passes thresholds, ease off if you're struggling.
- **Timing-window strictness** — widens for strugglers, tightens for the confident (Section 3.2).
- **Note density / arrangement** — offer simplified vs. full arrangements of the same song.
- **Assist toggles** — falling-note visualizer, note names, one-hand mode — all reducible as you improve so you're weaned off scaffolding.

The engine's goal is measurable: keep your success rate in a target band (roughly 70–85%) — high enough to feel competent, hard enough to grow. The **stretch song** (curriculum doc) deliberately sits *above* the flow channel as a curiosity object, which is fine precisely because it's not scored for mastery.

---

## 7. The roadmap & progress visualization

Progress must be *visible* to be motivating. The relevant psychology: the **goal-gradient effect** (people accelerate as they see the goal nearing) and the **endowed-progress effect** (starting a bar partway filled boosts follow-through). We apply both.

Proposed roadmap surfaces:

- **The Journey Map** — the primary view: a Duolingo-style guided path of upcoming lessons/songs with a clear "you are here" and "what's next," running along the curriculum's skill tree. One obvious next step at all times to prevent decision paralysis.
- **Skill Tree view** — the richer graph underneath, showing mastered skills (with crowns), in-progress skills, and locked skills, so you get both a sense of accomplishment and a clear picture of where to focus.
- **Song progress bars** — every locked song shows "X skills to unlock," partly pre-filled (endowed progress) so the next unlock always feels close.
- **Stats dashboard** — practice minutes, streak, XP/level, per-skill mastery, and a **timing-improvement graph** (average ms deviation trending toward zero over weeks). This timing curve is the single most honest picture of you actually becoming a better player, and it's deeply satisfying to watch fall.
- **Milestone timeline** — first 3-star, first song learned, first blues improv, etc. — a highlight reel of real achievements.

---

## 8. The goal-setting system

Goal-setting is a strong feature and the research strongly supports it: specific, difficult (but achievable) goals produce dramatically higher performance than vague "do your best" goals — Locke & Latham found difficult specific goals drove performance ~250% higher than easy ones. Goals work by directing attention, mobilizing effort, sustaining persistence, and prompting strategy. Design details:

- **Learning goals, not just performance goals, for new material.** This is a subtle but research-backed distinction: for genuinely new skills, a *learning goal* ("work out the shuffle-bass fingering and play it hands-together") beats a pure *performance goal* ("score 95%"), because a performance target can push you to fake a result before you understand the method. The app should frame early-tier goals as process/mastery goals and reserve performance goals for consolidation.
- **SMART framing** — every goal specific, measurable, achievable, relevant, time-bound. The app helps shape vague intentions ("get good at blues") into SMART goals ("earn 3 stars on a 12-bar blues at 90 BPM within 3 weeks").
- **Three horizons:**
  - *Session goals* — auto-suggested each day ("clear 3 review items + one new skill").
  - *Weekly goals* — user-set and/or suggested ("practice 5 days," "learn the turnaround"). Tied to Riff bonuses.
  - *Long-term goals* — the big "why" ("play a full gospel song for my family by December"). The roadmap orients toward these.
- **Difficulty calibrated to the individual** — goals should stretch but stay achievable; the app uses your recent performance data to propose goals in the right zone (this is the same flow-channel logic as Section 6).
- **Commitment & feedback** — the research says goals only work with commitment and feedback, so the app asks you to explicitly *accept* each goal and shows continuous progress toward it.

---

## 9. How the whole system stays honest (guardrails summary)

Because the explicit mission is *you learning piano fast*, here are the firewalls that keep engagement mechanics from drifting into empty addiction:

1. **XP is weighted by difficulty and freshness** — grinding easy content pays almost nothing.
2. **You cannot buy stars, XP, or skill unlocks** — currency only touches cosmetics and convenience.
3. **Song unlocks require demonstrated skill** — the unlock *is* proof you got better.
4. **Variable rewards trigger only on good playing** — never on merely showing up or paying.
5. **Scoring measures timing, not just notes** — you can't three-star by playing right notes sloppily.
6. **Mastery = at-tempo, un-assisted** — scaffolding and slow-downs are tracked separately so you can't fool yourself.
7. **No dark patterns** — no fake urgency, no guilt notifications, no paid loot boxes, honest reminders only.
8. **The timing-improvement graph** gives you an un-gameable, objective measure of real progress.

---

## 10. Concrete daily loop with gamification hooks

Tying it to the curriculum's interleaved session (20–30 min):

1. **Open → streak claim + today's goal** shown (endowed-progress bar already partly filled).
2. **Warm-up take** → immediate green/orange/purple feedback, small XP, dopamine primed.
3. **New micro-skill** at slow tempo → adaptive engine nudges tempo up as you succeed.
4. **Spaced review** of decaying items → high XP multiplier (freshness).
5. **Stretch-song fragment** → exploration, no score pressure, occasional surprise bonus.
6. **Theory quiz** → fast, XP + Riffs.
7. **Song time** → star attempt on the on-level song; chance of an "encore" variable bonus on a great take.
8. **Wrap** → session report (timing histogram, tip), XP/level update, Riffs earned, streak advanced, progress toward weekly goal, preview of what tomorrow unlocks.

---

## 11. Open questions to resolve before the build spec

1. **Currency name & single vs. dual currency** — recommend a single soft currency ("Riffs") for simplicity; a premium currency only matters if you commercialize later.
2. **Social/relatedness scope** — for a personal prototype, skip leaderboards; but SDT's relatedness need is real, so consider a lightweight "share a milestone" or a solo-friendly acknowledgment. Want any social layer in v1?
3. **Mic-mode strictness** — how transparent/lenient should scoring be when it's less reliable? Recommend clearly labeling mic scores as approximate.
4. **Latency calibration UX** — needs a clean onboarding flow; flag as a first-run requirement for MIDI.
5. **Cosmetic art scope** — cosmetics need art assets; decide how much to invest for a prototype (themes/sound packs are cheap and high-value; avatars cost more).

## 12. Post-MVP scope adjustment: XP and learning levels first

For the next product pass, Streaks and Riffs are deferred. They remain historical design concepts and may remain in persisted MVP data, but they should not be required by the new onboarding or Missions UI.

The primary visible reward loop should be:

`validated practice → Hands/Head evidence → XP → Level/tier meter → mastery gates → new curriculum access`

XP is a competence/progress signal, not a currency. The user-facing system has only two XP tracks: Hands XP and Head XP. Context transfer is recorded as evidence attached to the relevant track rather than exposed as a third XP type. Hands XP may fill the user-facing learning-level meter; Head XP can strengthen knowledge locks and SongMastery evidence but cannot raise the playing tier alone. Level advancement still requires mastery gates, delayed review, and a tier checkpoint.

The detailed XP table, SongMastery model, and stretch-song Boss Challenge rules live in `docs/06-comprehensive-curriculum-plan.md` and `docs/07-development-roadmap.md`.

---

## Sources

Self-Determination Theory & gamification:
- [Gamification enhances intrinsic motivation, autonomy and relatedness: a meta-analysis (Springer, ETR&D)](https://link.springer.com/article/10.1007/s11423-023-10337-7)
- [Intrinsic and extrinsic motivation from an SDT perspective (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0361476X20300254)
- [Self-Determination Theory: Deci & Ryan's mini-theories (Yu-kai Chou)](https://yukaichou.com/gamification-analysis/self-determination-theory-guide-to-ryan-and-decis-motivation-framework/)

Goal-setting theory:
- [Locke's Goal-Setting Theory (MindTools)](https://www.mindtools.com/azazlu3/lockes-goal-setting-theory/)
- [Goal Setting Theory: Locke & Latham Explained (Goals and Progress)](https://goalsandprogress.com/goal-setting-theory-locke-latham-explained/)
- [Locke & Latham's Five-Principle Framework (Strategic Management Insight)](https://strategicmanagementinsight.com/tools/locke-lathams-five-principle-framework/)

Flow theory & adaptive difficulty:
- [Flow Theory: Csikszentmihalyi's 9 Components (Yu-kai Chou)](https://yukaichou.com/gamification-analysis/flow-theory-complete-guide-csikszentmihalyi-optimal-experience/)
- [Flow State in Learning (Structural Learning)](https://www.structural-learning.com/post/flow-state)
- [Being enjoyably challenged is key to enjoyable gaming (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5954478/)

Variable rewards, dopamine & ethical design:
- [Variable rewards in product design (Appcues)](https://www.appcues.com/blog/variable-rewards)
- [Variable Reinforcement & Ethical Growth Loops (Build Better)](https://buildbetterhq.substack.com/p/variable-reinforcement-why-infinite-wins)
- [Designing for Dopamine (UX Magazine)](https://uxmag.medium.com/designing-for-dopamine-540224fb0979)

Scoring, timing & music apps:
- [Guitar Hero Precision Mode / timing windows (WikiHero)](https://guitarhero.fandom.com/wiki/Precision_Mode)
- [Melodics: best apps to learn piano / feedback model](https://melodics.com/blog/the-best-apps-to-learn-piano)
- [Melodics Review — timing/feedback detail (Deviant Noise)](https://deviantnoise.net/education/piano/melodics-review/)
- [Yousician song scoring and leaderboards (Yousician Support)](https://support.yousician.com/hc/en-us/articles/208014795-Song-scoring-and-leaderboards)
- [Yousician song end screen (Yousician Support)](https://support.yousician.com/hc/en-us/articles/201558472-Song-end-screen)
- [Web MIDI API for musical instrument interaction (DEV)](https://dev.to/omriluz1/web-midi-api-for-musical-instrument-interaction-309g)

Currency, progress visualization & habit formation:
- [How virtual currencies in apps and games work (Corefy)](https://corefy.com/blog/how-do-virtual-currencies-in-apps-and-games-work)
- [Gamification in Learning Apps: examples & features (Riseapps)](https://riseapps.co/gamification-in-learning-apps/)
- [The Goal-Gradient Effect (Learnnovators)](https://learnnovators.com/blog/the-goal-gradient-effect-why-visible-progress-sustains-motivation/)
- [Endowed Progress Effect (Medium — David Teodorescu)](https://medium.com/@davidteodorescu/design-perfect-ux-tasks-the-endowed-progress-effect-7461ca20076c)
- [Implementation intentions & habit formation (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10585941/)
- [An Evidence-Based Approach to Goal Setting and Behavior Change (Stronger by Science)](https://www.strongerbyscience.com/goal-setting/)
